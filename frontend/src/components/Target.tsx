// src/components/Target.tsx
import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Target3D } from '../types';

interface TargetProps {
  target: Target3D;
  onHit: (targetId: string) => void;
}

export const Target: React.FC<TargetProps> = ({ target, onHit }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const scaleRef = useRef(1);

  // Mark this mesh as a target with userData
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData.isTarget = true;
      meshRef.current.userData.targetId = target.id;
      meshRef.current.name = target.id; // Also set name for easier identification
    }
  }, [target.id]);

  // Animation for moving targets and hover effect
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Moving target logic
    if (target.type === 'moving' && target.velocity) {
      meshRef.current.position.add(target.velocity.clone().multiplyScalar(delta * 60));
      
      // Boundary check with reflection
      const pos = meshRef.current.position;
      if (Math.abs(pos.x) > 4.5) {
        target.velocity.x *= -1;
        pos.x = Math.sign(pos.x) * 4.5;
      }
      if (Math.abs(pos.y) > 4.5) {
        target.velocity.y *= -1;
        pos.y = Math.sign(pos.y) * 4.5;
      }
      if (Math.abs(pos.z) > 4.5) {
        target.velocity.z *= -1;
        pos.z = Math.sign(pos.z) * 4.5;
      }
    }

    // Hover scale animation
    const targetScale = hovered ? 1.2 : 1;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, 0.1);
    meshRef.current.scale.setScalar(scaleRef.current);

    // Gentle pulsing animation for static targets
    if (target.type === 'static') {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      meshRef.current.scale.setScalar(pulse * scaleRef.current);
    }
  });

  const color = target.type === 'moving' ? '#ff6b6b' : '#4ecdc4';

  return (
    <mesh
      ref={meshRef}
      position={target.position}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      castShadow
    >
      <sphereGeometry args={[target.radius, 32, 32]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color}
        emissiveIntensity={hovered ? 0.5 : 0.3}
        metalness={0.3}
        roughness={0.4}
      />
      
      {/* Outer glow ring */}
      <mesh scale={1.3}>
        <sphereGeometry args={[target.radius, 16, 16]} />
        <meshBasicMaterial 
          color={color}
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>
    </mesh>
  );
};