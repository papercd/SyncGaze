// src/components/GameController.tsx
import { useEffect,useRef,useState } from 'react';
import * as THREE from 'three';
import { Target } from './Target';
import { useMouseLook } from '../hooks/useMouseLook';
import type { Target3D } from '../types';

interface GameControllerProps {
  isLocked: boolean;
  onTargetHit: (targetId: string, mouseData: any) => void;
  onPhaseChange: (phase: 'training' | 'complete') => void;
}

export const GameController: React.FC<GameControllerProps> = ({ 
  isLocked, 
  onTargetHit,
  onPhaseChange 
}) => {
  const [targets, setTargets] = useState<Target3D[]>([]);
  const startTimeRef = useRef<number>(0);

  // Now this is INSIDE Canvas, so useThree() works!
  const { getMouseData, clearMouseData } = useMouseLook(0.002, isLocked);

  const spawnTarget = (elapsedTime: number): Target3D => {
    const phaseType = elapsedTime < 30000 ? 'static' : elapsedTime < 60000 ? 'moving' : 'mixed';
    const isMoving = phaseType === 'moving' || (phaseType === 'mixed' && Math.random() > 0.5);

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const radius = 3 + Math.random() * 2;

    const position = new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta) - 1,
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
  };

  useEffect(() => {
    if (!isLocked) return;

    startTimeRef.current = performance.now();
    setTargets([spawnTarget(0)]);

    const gameLoop = setInterval(() => {
      const elapsedTime = performance.now() - startTimeRef.current;

      if (elapsedTime > 90000) {
        onPhaseChange('complete');
        clearInterval(gameLoop);
        return;
      }

      setTargets(prev => {
        if (prev.length === 0) {
          return [spawnTarget(elapsedTime)];
        }
        return prev;
      });
    }, 100);

    return () => clearInterval(gameLoop);
  }, [isLocked, onPhaseChange]);

  const handleTargetHit = (targetId: string) => {
    setTargets(prev => prev.filter(t => t.id !== targetId));
    onTargetHit(targetId, getMouseData());
  };

  return (
    <>
      {targets.map(target => (
        <Target key={target.id} target={target} onHit={handleTargetHit} />
      ))}
    </>
  );
};