// src/components/CameraController.tsx
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraControllerProps {
  isActive: boolean;
  speed?: number;
}

export const CameraController: React.FC<CameraControllerProps> = ({ 
  isActive, 
  speed = 5 
}) => {
  const { camera } = useThree();
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive]);

  useFrame((state, delta) => {
    if (!isActive) return;

    const moveSpeed = speed * delta;
    const direction = new THREE.Vector3();

    // Get camera's forward and right vectors
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

    // WASD movement
    if (keysPressed.current['w']) direction.add(forward);
    if (keysPressed.current['s']) direction.sub(forward);
    if (keysPressed.current['a']) direction.sub(right);
    if (keysPressed.current['d']) direction.add(right);
    
    // Space/Shift for up/down
    if (keysPressed.current[' ']) direction.y += 1;
    if (keysPressed.current['shift']) direction.y -= 1;

    // Normalize and apply movement
    if (direction.length() > 0) {
      direction.normalize().multiplyScalar(moveSpeed);
      camera.position.add(direction);
    }
  });

  return null;
};