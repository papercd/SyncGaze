// src/components/GlockModel.tsx
import { useGLTF, useAnimations } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CS2Physics } from '../utils/cs2Physics';

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
  const { actions, names } = useAnimations(animations, group);

  const recoilOffset = useRef(new THREE.Vector3());
  const swayOffset = useRef(new THREE.Vector3());
  const basePosition = useRef(new THREE.Vector3(...position));

  // Debug: Log what animations are available
  /*
  useEffect(() => {
    console.log('🎬 Available animations:', names);
    console.log('🎬 Actions object:', actions);
    console.log('🎬 Available action names:', Object.keys(actions));
    
    // Check if Fire animation exists
    if (actions['Fire']) {
      console.log('✅ Fire animation found');
      console.log('📊 Fire clip duration:', actions['Fire'].getClip().duration);
    } else {
      console.log('❌ Fire animation NOT found');
    }

    // List all available animations
    Object.keys(actions).forEach(key => {
      console.log(`🎯 Animation: ${key}`, actions[key]);
    });
  }, [actions, names]);*/

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.button === 0 && physics) { // Left click
        //console.log('🔫 Click detected!');
        
        // Apply recoil with slight random variance
        const recoil = physics.applyRecoil();
        const recoilVariance = 0.4 + Math.random() * 0.2; // 0.8 to 1.2 multiplier
        recoilOffset.current.set(
          recoil.x * 0.008 * recoilVariance,
          -recoil.y * 0.008 * recoilVariance,
          recoil.y * 0.0018 * recoilVariance
        );
        
        // Play Fire animation with slight timing variance
        if (actions['Fire']) {
          const fps = 24;
          const baseFrame = 68.8;
          //const frameVariance = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1 frame
          const startFrame = baseFrame ;
          const startTime = startFrame / fps;
          
          // Slight speed variance (0.95x to 1.05x speed)
          const speedVariance = 1;
          
          actions['Fire'].stop();
          actions['Fire'].reset();
          actions['Fire'].time = startTime;
          actions['Fire'].timeScale = speedVariance; // Vary playback speed slightly
          actions['Fire'].setLoop(THREE.LoopOnce, 1);
          actions['Fire'].clampWhenFinished = true;
          actions['Fire'].paused = false;
          actions['Fire'].play();
          
          //console.log(`✅ Fire at frame ${startFrame}, speed ${speedVariance.toFixed(2)}x`);
        }
      }
    };
  
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [physics, actions]);


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