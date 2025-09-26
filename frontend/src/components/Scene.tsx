// src/components/Scene.tsx
import { Canvas } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { Environment } from './Environment';
import { GameController } from './GameController';
import { Crosshair } from './Crosshair';
import { usePointerLock } from '../hooks/usePointerLock';

export const Scene: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { isLocked, requestPointerLock, exitPointerLock } = usePointerLock(canvasRef);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'training' | 'complete'>('idle');
  const startTimeRef = useRef<number>(0);

  const handleTargetHit = (targetId: string, mouseData: any) => {
    setScore(prev => prev + 1);
    console.log('Target hit:', { targetId, timestamp: performance.now(), mouseData });
  };

  const handlePhaseChange = (newPhase: 'training' | 'complete') => {
    setPhase(newPhase);
    if (newPhase === 'complete') {
      exitPointerLock();
    }
  };

  const handleStart = () => {
    setScore(0);
    setPhase('training');
    startTimeRef.current = performance.now();
    requestPointerLock();
  };

  return (
    <div ref={canvasRef} style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Start/Complete overlay */}
      {(!isLocked || phase === 'complete') && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          textAlign: 'center',
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '40px',
          borderRadius: '10px'
        }}>
          {phase === 'complete' ? (
            <>
              <h2>Training Complete!</h2>
              <p style={{ fontSize: '24px', margin: '20px 0' }}>Final Score: {score}</p>
              <button onClick={handleStart} style={{
                padding: '15px 30px',
                fontSize: '18px',
                cursor: 'pointer',
                backgroundColor: '#4ecdc4',
                color: 'white',
                border: 'none',
                borderRadius: '5px'
              }}>
                Restart Training
              </button>
            </>
          ) : (
            <>
              <h2>FPS Training Ground</h2>
              <p style={{ margin: '20px 0' }}>Click to start training</p>
              <button onClick={handleStart} style={{
                padding: '20px 40px',
                fontSize: '20px',
                cursor: 'pointer',
                backgroundColor: '#4ecdc4',
                color: 'white',
                border: 'none',
                borderRadius: '5px'
              }}>
                Start Training
              </button>
            </>
          )}
        </div>
      )}

      {/* HUD */}
      {isLocked && phase === 'training' && (
        <>
          <div style={{
            position: 'absolute',
            top: 20,
            left: 20,
            color: 'white',
            fontSize: '24px',
            zIndex: 10,
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}>
            Score: {score}
          </div>
          
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            color: 'white',
            fontSize: '18px',
            zIndex: 10,
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}>
            Time: {Math.floor((performance.now() - startTimeRef.current) / 1000)}s / 90s
          </div>
        </>
      )}

      {/* Crosshair */}
      {isLocked && phase === 'training' && <Crosshair />}

      {/* Canvas - Three.js hooks work INSIDE here */}
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 0, 0]} fov={90} />
        <Environment />
        <GameController 
          isLocked={isLocked} 
          onTargetHit={handleTargetHit}
          onPhaseChange={handlePhaseChange}
        />
      </Canvas>
    </div>
  );
};