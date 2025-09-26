// src/components/Gun.tsx
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface GunProps {
  isActive: boolean;
}

export const Gun: React.FC<GunProps> = ({ isActive }) => {
  const gunGroupRef = useRef<THREE.Group>(null);
  const bobPhaseRef = useRef(0);
  const { camera } = useThree();
  
  // Load GLTF model - try .glb if .gltf doesn't work
  const { scene } = useGLTF('/models/ak47.glb');

  useFrame((state, delta) => {
    if (!gunGroupRef.current || !isActive) return;

    // Weapon bob animation (idle breathing effect)
    bobPhaseRef.current += delta * 2;
    const bobY = Math.sin(bobPhaseRef.current) * 0.005;
    const bobX = Math.sin(bobPhaseRef.current * 0.5) * 0.003;
    
    // Gun offset relative to camera (right-hand hold position)
    const gunOffset = new THREE.Vector3(0.4 + bobX, -0.3 + bobY, -0.5);
    
    // Transform offset to world space based on camera rotation
    const worldOffset = gunOffset.clone().applyQuaternion(camera.quaternion);
    
    // Position gun relative to camera
    gunGroupRef.current.position.copy(camera.position).add(worldOffset);
    
    // Rotate gun to match camera orientation
    gunGroupRef.current.quaternion.copy(camera.quaternion);
    
    // Apply additional rotation for proper gun angle
    gunGroupRef.current.rotateY(-0.1);
  });

  return (
    <group ref={gunGroupRef}>
      {/* GLTF Model */}
      <primitive 
        object={scene.clone()} 
        scale={1}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />
      
      {/* Weapon lighting */}
      <pointLight position={[0, 0.2, -0.3]} intensity={0.4} distance={2} color="#ffffff" />
      <spotLight 
        position={[0.3, 0.3, -0.3]} 
        intensity={0.3} 
        angle={0.5}
        penumbra={0.5}
        castShadow
      />
    </group>
  );
};

// Preload GLTF model for better performance
useGLTF.preload('/models/ak47.glb');