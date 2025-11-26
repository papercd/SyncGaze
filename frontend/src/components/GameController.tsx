// frontend/src/components/GameController.tsx
// FIXED: Timer no longer resets when isLocked toggles

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { Target } from './Target';
import { useMouseLook } from '../hooks/useMouseLook';
import { useFrame } from '@react-three/fiber';
import type { Target3D } from '../types';

interface GameControllerProps {
  isLocked: boolean;
  onTargetHit: (targetId: string, mouseData: any) => void;
  onPhaseChange: (phase: 'training' | 'complete') => void;
}

export interface GameControllerRef {
  handleTargetHit: (targetId: string) => void;
  getActiveTargetId: () => string | null;  // ✅ ADD THIS
}


export const GameController = forwardRef<GameControllerRef, GameControllerProps>(({ 
  isLocked, 
  onTargetHit,
  onPhaseChange 
}, ref) => {
  const [targets, setTargets] = useState<Target3D[]>([]);
  const startTimeRef = useRef<number>(0);
  const hasInitialized = useRef<boolean>(false);
  const gameLoopRef = useRef<number | null>(null);

  const pausedTimeRef = useRef<number>(0);
  const totalPausedDurationRef = useRef<number>(0);
  const wasLockedRef = useRef<boolean>(false);

  
  const { getMouseData, clearMouseData } = useMouseLook(0.002, isLocked);

  // ADD THIS ENTIRE useEffect:
  useEffect(() => {
    if (isLocked && !wasLockedRef.current && pausedTimeRef.current > 0) {
      // Just resumed
      const pauseDuration = performance.now() - pausedTimeRef.current;
      totalPausedDurationRef.current += pauseDuration;
      pausedTimeRef.current = 0;
      console.log('▶️ GameController resumed, paused for:', pauseDuration, 'ms');
    } else if (!isLocked && wasLockedRef.current) {
      // Just paused
      pausedTimeRef.current = performance.now();
      console.log('⏸️ GameController paused');
    }
    wasLockedRef.current = isLocked;
  }, [isLocked]);


  const spawnTarget = useCallback((elapsedTime: number): Target3D => {
    const phaseType = elapsedTime < 20000 ? 'static' : 'moving';
    const isMoving = phaseType === 'moving';

    // Spawn safely inside the room
    const x = THREE.MathUtils.randFloat(-9.0, 9.0);   // inside ±10
    const y = THREE.MathUtils.randFloat(1.0, 9.0);    // avoid floor/ceiling
    const z = THREE.MathUtils.randFloat(-4.0, 4.0);   // inside ±5

    const position = new THREE.Vector3(x, y, z);

    return {
      id: `target-${Date.now()}-${Math.random()}`,
      position,
      radius: 0.3,
      spawnTime: performance.now(),
      type: isMoving ? 'moving' : 'static',
      velocity: isMoving
        ? new THREE.Vector3(
            (Math.random() - 0.5) * 6.5,
            (Math.random() - 0.5) * 6.5,
            (Math.random() - 0.5) * 6.5
          )
        : undefined
    };
  }, []);

  useFrame((state,delta) => {
    if (!isLocked) return;

    setTargets(prev => prev.map(target => {
      if (target.type !== 'moving' || !target.velocity) return target;

      const newPosition = target.position.clone();
      const newVelocity = target.velocity.clone();
      

      // Room boundaries
      const bounds = {
        minX: -9.7,
        maxX: 9.7,
        minY: 0.3,
        maxY: 9.7,
        minZ: -4.7,
        maxZ: 4.7
      };

      // Predict next position
      const nextPosition = target.position.clone().addScaledVector(target.velocity, delta);
  
      // X boundaries
      if (nextPosition.x < bounds.minX || nextPosition.x > bounds.maxX) {
        newVelocity.x *= -1;
        newPosition.x = THREE.MathUtils.clamp(target.position.x, bounds.minX, bounds.maxX);
      } else {
        newPosition.x = nextPosition.x;
      }

      // Y boundaries
      if (nextPosition.y < bounds.minY || nextPosition.y > bounds.maxY) {
        newVelocity.y *= -1;
        newPosition.y = THREE.MathUtils.clamp(target.position.y, bounds.minY, bounds.maxY);
      } else {
        newPosition.y = nextPosition.y;
      }

      // Z boundaries
      if (nextPosition.z < bounds.minZ || nextPosition.z > bounds.maxZ) {
        newVelocity.z *= -1;
        newPosition.z = THREE.MathUtils.clamp(target.position.z, bounds.minZ, bounds.maxZ);
      } else {
        newPosition.z = nextPosition.z;
      }

      return {
        ...target,
        position: newPosition,
        velocity: newVelocity
      };
    }));
  });

  // Initialize game once when locked first time
  useEffect(() => {
    if (!isLocked || hasInitialized.current) return;

    hasInitialized.current = true;
    console.log('🚀 Initializing game - 60 second session');
    startTimeRef.current = performance.now();
    setTargets([spawnTarget(0)]);

    gameLoopRef.current = setInterval(() => {
      if (!isLocked) return;
      const elapsedTime = performance.now() - startTimeRef.current - totalPausedDurationRef.current;

      if (elapsedTime > 60000) {
        console.log('⏰ 60 seconds completed');
        onPhaseChange('complete');
        if (gameLoopRef.current) {
          clearInterval(gameLoopRef.current);
          gameLoopRef.current = null;
        }
      }
    }, 1000);

    console.log('✅ Game loop started');
  }, [isLocked, spawnTarget, onPhaseChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🛑 Cleaning up game');
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, []);

  // Auto-despawn targets after 3 seconds if not hit
  useEffect(() => {
    if (!isLocked) return;

    const checkInterval = setInterval(() => {
      const now = performance.now();
      
      setTargets(prev => {
        let needsReplacement = false;
        const updatedTargets = prev.filter(target => {
          const timeAlive = now - target.spawnTime;
          if (timeAlive > 1800) { // 3 seconds
            console.log('⏱️ Target timed out:', target.id);
            needsReplacement = true;
            return false; // Remove this target
          }
          return true;
        });

        // Spawn new target if one timed out
        if (needsReplacement) {
          const elapsedTime = now - startTimeRef.current - totalPausedDurationRef.current;
          return [...updatedTargets, spawnTarget(elapsedTime)];
        }

        return updatedTargets;
      });
    }, 100); // Check every 100ms

    return () => clearInterval(checkInterval);
  }, [isLocked, spawnTarget]);

  const handleTargetHit = useCallback((targetId: string) => {
    console.log('💥 Target hit:', targetId);
    
    const elapsedTime = performance.now() - startTimeRef.current;
    
    setTargets(prev => {
      const filtered = prev.filter(t => t.id !== targetId);
      return [...filtered, spawnTarget(elapsedTime)];
    });
    
    onTargetHit(targetId, getMouseData());
  }, [spawnTarget, onTargetHit, getMouseData]);

  // Expose handleTargetHit via ref
  useImperativeHandle(ref, () => ({
    handleTargetHit,
    getActiveTargetId: () => targets.length > 0 ? targets[0].id : null  // ✅ Return first target
  }), [handleTargetHit, targets]);
  return (
    <>
      {targets.map(target => (
        <Target key={target.id} target={target} onHit={handleTargetHit} />
      ))}
    </>
  );
});

GameController.displayName = 'GameController';