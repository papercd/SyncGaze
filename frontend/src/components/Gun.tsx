// src/components/Gun.tsx
import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

interface GunProps {
  isActive: boolean;
}

export const Gun: React.FC<GunProps> = ({ isActive }) => {
  console.log('Gun component render - isActive:', isActive);
  
  const gunModelRef = useRef<THREE.Group>(null);
  const bobPhaseRef = useRef(0);
  const { camera } = useThree();
  
  // Load GLTF model with animations
  const { scene, animations } = useGLTF('/models/scene.gltf');
  
  // Clone the scene once and use it for animations
  const clonedScene = useRef<THREE.Group | null>(null);
  if (!clonedScene.current) {
    clonedScene.current = scene.clone();
  }
  
  const { actions, names } = useAnimations(animations, clonedScene);

  // Debug: Log when model loads and play animations in sequence
  useEffect(() => {
    console.log('Gun model loaded:', scene);
    console.log('Available animations:', names);
    console.log('Actions object:', actions);
    
    // Debug: Print model hierarchy
    console.log('Model structure:');
    scene.traverse((child) => {
      console.log(`  - ${child.name} (${child.type})`);
    });
    
    // Set scale on the cloned scene directly
    if (clonedScene.current) {
      clonedScene.current.scale.set(1, 1, 1); // Try scale 1 first
    };
    
    // Force initial position update
    if (gunModelRef.current) {
      const gunOffset = new THREE.Vector3(0.3, -0.4, -2.0);
      const worldOffset = gunOffset.clone().applyQuaternion(camera.quaternion);
      gunModelRef.current.position.copy(camera.position).add(worldOffset);
      gunModelRef.current.quaternion.copy(camera.quaternion);
      console.log('Initial gun position set:', gunModelRef.current.position);
    }
    
    // Play all animations in sequence
    if (names.length === 0 || !actions || Object.keys(actions).length === 0) {
      console.log('No animations ready yet');
      return;
    }
    
    let currentIndex = 0;
    const animationNames = names;
    
    console.log('Starting animation sequence with:', animationNames);
    
    const playNextAnimation = () => {
      if (currentIndex >= animationNames.length) {
        currentIndex = 0; // Loop back to start
      }
      
      const animName = animationNames[currentIndex];
      const action = actions[animName];
      
      console.log(`Attempting to play: ${animName}`, action);
      
      if (action) {
        // Stop all other animations
        Object.values(actions).forEach(a => a?.stop());
        
        console.log(`✅ Playing animation ${currentIndex + 1}/${animationNames.length}: ${animName}`);
        action.reset();
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        
        // Get animation duration and schedule next animation
        const duration = action.getClip().duration;
        console.log(`Animation duration: ${duration}s`);
        setTimeout(() => {
          currentIndex++;
          playNextAnimation();
        }, duration * 1000 + 500); // Add 500ms pause between animations
      } else {
        console.log(`❌ Action not found for: ${animName}`);
      }
    };
    
    playNextAnimation();
  }, [scene, actions, names, camera]);

  useFrame((state, delta) => {
    if (!gunModelRef.current || !isActive) return;

    // FOR DEBUG: Keep gun at fixed position you can see
    gunModelRef.current.position.set(0, 1, -3);
    gunModelRef.current.rotation.set(0, 0, 0);
  });

  if (!isActive) return null;

  return (
    <>
      {/* Red cube for reference */}
      <mesh position={[0, 0, -2]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="red" emissive="red" emissiveIntensity={1} />
      </mesh>

      {/* GLTF Model - no scale on primitive */}
      <primitive 
        ref={gunModelRef}
        object={clonedScene.current!} 
        position={[0, 0, 0]}
      />
      
      {/* Weapon lighting that follows gun */}
      <pointLight position={gunModelRef.current ? gunModelRef.current.position : [0, 0, 0]} intensity={0.4} distance={2} color="#ffffff" />
    </>
  );
};

// Preload GLTF model for better performance
useGLTF.preload('/models/scene.gltf');