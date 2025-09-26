// src/components/CameraController.tsx
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CS2Physics } from '../utils/cs2Physics';

interface CameraControllerProps {
  isActive: boolean;
  onPhysicsUpdate?: (position: THREE.Vector3, velocity: THREE.Vector3, physics: CS2Physics) => void;
}

export const CameraController: React.FC<CameraControllerProps> = ({ 
  isActive,
  onPhysicsUpdate
}) => {
  const { camera } = useThree();
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const physics = useRef(new CS2Physics());
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const mouseSensitivity = 0.002;

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      // CS2-style mouse look
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= e.movementX * mouseSensitivity;
      euler.current.x -= e.movementY * mouseSensitivity;
      
      // Clamp pitch
      const maxPitch = Math.PI / 2 - 0.01;
      euler.current.x = Math.max(-maxPitch, Math.min(maxPitch, euler.current.x));
      
      camera.quaternion.setFromEuler(euler.current);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isActive, camera]);

  useFrame((state, delta) => {
    if (!isActive) return;

    // Gather input
    const input = {
      forward: (keysPressed.current['w'] ? 1 : 0) + (keysPressed.current['s'] ? -1 : 0),
      right: (keysPressed.current['d'] ? 1 : 0) + (keysPressed.current['a'] ? -1 : 0),
      jump: keysPressed.current[' '] || false,
      crouch: keysPressed.current['shift'] || keysPressed.current['control'] || false
    };

    // Update physics
    const newPosition = physics.current.updateMovement(input, camera, delta);
    camera.position.copy(newPosition);

    // Apply view bob
    const movementState = physics.current.getMovementState();
    const bob = physics.current.calculateWeaponBob(movementState.velocity, state.clock.elapsedTime, delta);
    camera.position.y += bob;

    // Notify parent of physics state
    if (onPhysicsUpdate) {
      onPhysicsUpdate(newPosition, movementState.velocity, physics.current);
    }
  });

  return null;
};