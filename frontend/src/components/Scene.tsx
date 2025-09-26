// src/components/Scene.tsx
import { Canvas } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Environment } from './Environment';
import { GameController } from './GameController';
import { Crosshair } from './Crosshair';
import { GlockModel } from './GlockModel';
import { CameraController } from './CameraController';
import { usePointerLock } from '../hooks/usePointerLock';
import { CS2Physics } from '../utils/cs2Physics';

export const Scene: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { isLocked, requestPointerLock, exitPointerLock } = usePointerLock(canvasRef);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'training' | 'complete'>('idle');
  const startTimeRef = useRef<number>(0);
  
  // Physics state
  const physicsRef = useRef(new CS2Physics());
  const [velocity, setVelocity] = useState(new THREE.Vector3());
  const [playerPosition, setPlayerPosition] = useState(new THREE.Vector3());

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

  const handlePhysicsUpdate = (position: THREE.Vector3, vel: THREE.Vector3, physics: CS2Physics) => {
    setPlayerPosition(position);
    setVelocity(vel);
    physicsRef.current = physics;
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
              <h2>CS2-Style FPS Training</h2>
              <p style={{ margin: '20px 0' }}>
                WASD - Move | Space - Jump | Shift - Crouch<br/>
                Mouse - Look | Left Click - Shoot
              </p>
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

          {/* Movement speed indicator */}
          <div style={{
            position: 'absolute',
            bottom: 80,
            left: 20,
            color: 'white',
            fontSize: '14px',
            zIndex: 10,
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}>
            Speed: {Math.round(new THREE.Vector2(velocity.x, velocity.z).length())} u/s
          </div>

          {/* Stamina bar */}
          <div style={{
            position: 'absolute',
            bottom: 50,
            left: 20,
            width: '200px',
            height: '20px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            border: '2px solid white',
            zIndex: 10
          }}>
            <div style={{
              width: `${(physicsRef.current.getMovementState().stamina / 100) * 100}%`,
              height: '100%',
              backgroundColor: '#4ecdc4',
              transition: 'width 0.1s'
            }} />
          </div>
        </>
      )}

      {/* Crosshair */}
      {isLocked && phase === 'training' && <Crosshair />}

      {/* Canvas */}
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 1.6, 0]} fov={90} />
        <CameraController 
          isActive={isLocked && phase === 'training'} 
          onPhysicsUpdate={handlePhysicsUpdate}
        />
        <Environment />
        <GlockModel 
          position={[0.02, -1.56, -0.081]} 
          rotation={[0, Math.PI, 0]}
          scale={1}
          velocity={velocity}
          physics={physicsRef.current}
        />
        
        <GameController 
          isLocked={isLocked} 
          onTargetHit={handleTargetHit}
          onPhaseChange={handlePhaseChange}
        />
      </Canvas>
    </div>
  );
};