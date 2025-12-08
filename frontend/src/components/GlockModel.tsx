// src/components/GlockModel.tsx
import { useGLTF, useAnimations } from '@react-three/drei';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CS2Physics } from '../utils/cs2Physics';

interface GlockModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  velocity?: THREE.Vector3;
  physics?: CS2Physics; 
  modelPath?: string;
}

export interface GlockModelRef {
  triggerFire: (recoilMultiplier?: number) => void;  // Add parameter
  triggerSlideBack: () => void;
  triggerReload: (isEmpty: boolean) => void;
}
export const GlockModel = forwardRef<GlockModelRef, GlockModelProps>(({
  position = [0.3, -0.4, -0.6],
  rotation = [0, Math.PI, 0],
  scale = 1,
  velocity = new THREE.Vector3(),
  physics,
  modelPath = '/glock/glock.glb'
}, ref) => {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  const { scene, animations } = useGLTF(modelPath);
  const { actions, names } = useAnimations(animations, group);

  const recoilOffset = useRef(new THREE.Vector3());
  const swayOffset = useRef(new THREE.Vector3());
  const basePosition = useRef(new THREE.Vector3(...position));

  // Debug: Log animations
  useEffect(() => {
    console.log('🎬 Available animations:', names);
    console.log('🎬 Actions object keys:', Object.keys(actions));
    
    if (actions['Fire']) {
      console.log('✅ Fire animation ready', actions['Fire']);
    } else {
      console.log('❌ Fire animation NOT found');
    }
    if (actions['SlideBack']) {
      console.log('✅ SlideBack animation ready', actions['SlideBack']);
    } else {
      console.log('❌ SlideBack animation NOT found');
    }
    if (actions['Reload']) {
      console.log('✅ Reload animation ready', actions['Reload']);
    } else {
      console.log('❌ Reload animation NOT found');
    }
    if (actions['ReloadEmpty']) {
      console.log('✅ ReloadEmpty animation ready', actions['ReloadEmpty']);
    } else {
      console.log('❌ ReloadEmpty animation NOT found');
    }
  }, [actions, names]);

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  // Expose animation triggers via ref
  useImperativeHandle(ref, () => {
    console.log('🔗 useImperativeHandle setting up ref with actions:', Object.keys(actions));
    const refObject: GlockModelRef = {
      triggerFire: (recoilMultiplier: number = 1) => {
        console.log('🔫 triggerFire called! Actions available:', Object.keys(actions));
        
        // Apply recoil first
        if (physics) {
          const recoil = physics.applyRecoil(recoilMultiplier);
          const recoilVariance = 0.4 + Math.random() * 0.2;
          recoilOffset.current.set(
            recoil.x * 0.008 * recoilVariance,
            -recoil.y * 0.008 * recoilVariance,
            recoil.y * 0.0018 * recoilVariance
          );
        }
        
        if (actions['Fire']) {
          const fps = 24;
          const startFrame = 68.8;
          const startTime = startFrame / fps;
          
          actions['Fire'].stop();
          actions['Fire'].reset();
          actions['Fire'].time = startTime;
          actions['Fire'].timeScale = 1;
          actions['Fire'].setLoop(THREE.LoopOnce, 1);
          actions['Fire'].clampWhenFinished = true;
          actions['Fire'].paused = false;
          actions['Fire'].play();
          
          console.log('✅ Fire animation playing');
        } else {
          console.error('❌ Fire action not found!');
        }
      },
      triggerSlideBack: () => {
        console.log('🔙 triggerSlideBack called!');
        if (actions['SlideBack']) {
          const fps = 24;
          const startFrame = 84.8;
          const endFrame = 85.6;
          const startTime = startFrame / fps;
          const duration = (endFrame - startFrame) / fps;
          
          // Stop other animations
          Object.values(actions).forEach(a => {
            if (a && a !== actions['SlideBack']) a.stop();
          });
          
          actions['SlideBack'].reset();
          actions['SlideBack'].time = startTime;
          actions['SlideBack'].setLoop(THREE.LoopOnce, 1);
          actions['SlideBack'].clampWhenFinished = true;
          actions['SlideBack'].play();
          
          console.log(`✅ SlideBack animation playing (${startFrame}-${endFrame}, duration: ${duration.toFixed(3)}s)`);
        } else {
          console.error('❌ SlideBack action not found!');
        }
      },
      triggerReload: (isEmpty: boolean) => {
        const animName = isEmpty ? 'ReloadEmpty' : 'Reload';
        console.log(`🔄 triggerReload called with isEmpty=${isEmpty}, animName=${animName}`);
        const action = actions[animName];
        
        if (action) {
          const fps = 24;
          
          // Stop all other animations
          Object.values(actions).forEach(a => a?.stop());
          
          action.reset();
          
          if (isEmpty && animName === 'ReloadEmpty') {
            // ReloadEmpty: frames 85.6 to 158.4
            const startFrame = 85.6;
            const endFrame = 158.4;
            const startTime = startFrame / fps;
            const duration = (endFrame - startFrame) / fps;
            
            action.time = startTime;
            console.log(`📊 ReloadEmpty: ${startFrame}-${endFrame}, duration: ${duration.toFixed(3)}s`);
          }
          
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
          
          console.log(`✅ ${animName} animation playing`);
        } else {
          console.error(`❌ ${animName} animation not found! Available:`, Object.keys(actions));
        }
      }
    };
    
    console.log('🔗 Ref object created:', refObject);
    return refObject;
  }, [actions]);

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
});

GlockModel.displayName = 'GlockModel';

useGLTF.preload('/glock/glock.glb');
useGLTF.preload('/glock/second_glock.glb');
useGLTF.preload('/glock/third_glock.glb');
