// src/components/GameController.tsx
import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { Target } from './Target';
import { useMouseLook } from '../hooks/useMouseLook';
import type { Target3D } from '../types';

interface GameControllerProps {
  isLocked: boolean;
  onTargetHit: (targetId: string, mouseData: any) => void;
  onPhaseChange: (phase: 'training' | 'complete') => void;
}

export interface GameControllerRef {
  handleTargetHit: (targetId: string) => void;
}

export const GameController = forwardRef<GameControllerRef, GameControllerProps>(({ 
  isLocked, 
  onTargetHit,
  onPhaseChange 
}, ref) => {
  const [targets, setTargets] = useState<Target3D[]>([]);
  const startTimeRef = useRef<number>(0);
  const hasInitialized = useRef<boolean>(false);

  const { getMouseData, clearMouseData } = useMouseLook(0.002, isLocked);

  const spawnTarget = useCallback((elapsedTime: number): Target3D => {
    const phaseType = elapsedTime < 30000 ? 'static' : elapsedTime < 60000 ? 'moving' : 'mixed';
    const isMoving = phaseType === 'moving' || (phaseType === 'mixed' && Math.random() > 0.5);

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const radius = 3 + Math.random() * 2;

    const position = new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta) - 0.5 + 5,
      radius * Math.cos(phi)
    );

    return {
      id: `target-${Date.now()}-${Math.random()}`,
      position,
      radius: 0.3,
      spawnTime: performance.now(),
      type: isMoving ? 'moving' : 'static',
      velocity: isMoving ? new THREE.Vector3(
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03
      ) : undefined
    };
  }, []);

  useEffect(() => {
    if (!isLocked) {
      hasInitialized.current = false;
      return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    console.log('🚀 Initializing game');
    startTimeRef.current = performance.now();
    setTargets([spawnTarget(0)]);

    const gameLoop = setInterval(() => {
      const elapsedTime = performance.now() - startTimeRef.current;

      if (elapsedTime > 90000) {
        onPhaseChange('complete');
        clearInterval(gameLoop);
      }
    }, 1000);

    return () => {
      console.log('🛑 Cleaning up game');
      clearInterval(gameLoop);
    };
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
    handleTargetHit
  }), [handleTargetHit]);

  return (
    <>
      {targets.map(target => (
        <Target key={target.id} target={target} onHit={handleTargetHit} />
      ))}
    </>
  );
});