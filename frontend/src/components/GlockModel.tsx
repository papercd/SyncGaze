// src/components/GlockModel.tsx
import { useGLTF, useAnimations } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Import CS2Physics type (defined in CameraController)
type CS2Physics = any;

interface GlockModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  velocity?: THREE.Vector3;
  physics?: CS2Physics;
}

export const GlockModel: React.FC<GlockModelProps> = ({
  position = [0.3, -0.4, -0.6],
  rotation = [0, Math.PI, 0],
  scale = 1,
  velocity = new THREE.Vector3(),
  physics
}) => {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { scene, animations } = useGLTF('/glock/glock.glb');
  const { actions } = useAnimations(animations, group);
  const [currentAnimation, setCurrentAnimation] = useState<string>('Idle');
  
  const recoilOffset = useRef(new THREE.Vector3());
  const swayOffset = useRef(new THREE.Vector3());
  const basePosition = useRef(new THREE.Vector3(...position));

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  // Play animations
  useEffect(() => {
    if (actions[currentAnimation]) {
      Object.values(actions).forEach(action => action?.stop());
      actions[currentAnimation]?.reset().play();
    }
  }, [currentAnimation, actions]);

  // Handle shooting with left click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.button === 0 && physics) { // Left click
        // Play fire animation
        setCurrentAnimation('Fire');
        setTimeout(() => setCurrentAnimation('Idle'), 200);
        
        // Apply recoil
        const recoil = physics.applyRecoil();
        recoilOffset.current.set(
          recoil.x * 0.01,
          -recoil.y * 0.01,
          recoil.y * 0.002
        );
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [physics]);

  useFrame((state, delta) => {
    if (!group.current || !physics) return;

    // CS2-style weapon sway (frame-independent)
    const sway = physics.calculateWeaponSway(velocity, state.clock.elapsedTime, delta);
    swayOffset.current.lerp(sway, 0.1);

    // Recoil recovery (frame-independent)
    const recoilRecovery = physics.updateRecoilRecovery(delta);
    recoilOffset.current.lerp(new THREE.Vector3(), 0.15);

    // Calculate final position with all offsets
    const offset = basePosition.current.clone()
      .add(swayOffset.current)
      .add(recoilOffset.current);
    
    offset.applyQuaternion(camera.quaternion);
    
    // Update weapon position
    group.current.position.copy(camera.position).add(offset);
    
    // Update weapon rotation
    const additionalRotation = new THREE.Euler(
      rotation[0] + recoilOffset.current.y * 10,
      rotation[1] + recoilOffset.current.x * 10,
      rotation[2]
    );
    const additionalQuaternion = new THREE.Quaternion().setFromEuler(additionalRotation);
    group.current.quaternion.copy(camera.quaternion).multiply(additionalQuaternion);
  });

  return (
    <group ref={group} scale={scale}>
      <primitive object={scene} />
    </group>
  );
};

useGLTF.preload('/glock/glock.glb');