// src/components/GlockModel.tsx
import { useGLTF, useAnimations } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface GlockModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  animationName?: string;
}

export const GlockModel: React.FC<GlockModelProps> = ({
  position = [0.5, -0.5, -1],
  rotation = [0, Math.PI, 0],
  scale = 1,
  animationName
}) => {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // Change to .glb file
  const { scene, animations } = useGLTF('/glock/glock.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    console.log('🎨 GLB Model loaded!');
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Log to verify textures
        if (child.material) {
          const mat = Array.isArray(child.material) ? child.material[0] : child.material;
          if (mat instanceof THREE.MeshStandardMaterial) {
            console.log(`${child.name}: texture=${!!mat.map}, metalness=${mat.metalness}, roughness=${mat.roughness}`);
          }
        }
      }
    });
  }, [scene]);

  useEffect(() => {
    if (animationName && actions[animationName]) {
      Object.values(actions).forEach(action => action?.stop());
      actions[animationName]?.reset().play();
    }
  }, [animationName, actions]);

  // Make gun follow camera
  useFrame(() => {
    if (group.current) {
      // Copy camera position and rotation
      group.current.position.copy(camera.position);
      group.current.quaternion.copy(camera.quaternion);
      
      // Apply offset in local space (relative to camera)
      const offset = new THREE.Vector3(position[0], position[1], position[2]);
      offset.applyQuaternion(camera.quaternion);
      group.current.position.add(offset);
      
      // Apply additional rotation if specified
      const additionalRotation = new THREE.Euler(rotation[0], rotation[1], rotation[2]);
      const additionalQuaternion = new THREE.Quaternion().setFromEuler(additionalRotation);
      group.current.quaternion.multiply(additionalQuaternion);
    }
  });

  return (
    <group ref={group} scale={scale}>
      <primitive object={scene} />
    </group>
  );
};

// Preload the GLB file
useGLTF.preload('/glock/glock.glb');