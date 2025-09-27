// src/components/Scene.tsx
import { Canvas } from '@react-three/fiber';
import { useRef, useEffect,useState, useCallback } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Environment } from './Environment';
import { GameController } from './GameController';
import { Crosshair } from './Crosshair';
import { GlockModel } from './GlockModel';
import { CameraController } from './CameraController';
import { usePointerLock } from '../hooks/usePointerLock';
import { useShootingSystem } from '../hooks/useShootingSystem';
import { useAmmoSystem } from '../hooks/useAmmoSystem';
import { CS2Physics } from '../utils/cs2Physics';

export const Scene: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { isLocked, requestPointerLock, exitPointerLock } = usePointerLock(canvasRef);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'training' | 'complete'>('idle');
  const startTimeRef = useRef<number>(0);
  
  // Ammo system
  const { ammo, shoot, reload } = useAmmoSystem(20);
  
  // Physics state
  const physicsRef = useRef(new CS2Physics());
  const [velocity, setVelocity] = useState(new THREE.Vector3());
  const [playerPosition, setPlayerPosition] = useState(new THREE.Vector3());
  
  // Reference to GameController's hit handler and weapon animation triggers
  const gameControllerRef = useRef<{ handleTargetHit: (targetId: string) => void } | null>(null);
  const weaponAnimRef = useRef<{ 
    triggerFire: (recoilMultiplier?: number) => void;
    triggerSlideBack: () => void;
    triggerReload: (isEmpty: boolean) => void;
  } | null>(null);

  const handleTriggerPull = useCallback(() => {
    console.log('🎯 Trigger pulled!', { 
      currentAmmo: ammo.current, 
      isReloading: ammo.isReloading 
    });
    
    const didShoot = shoot();
    console.log('🔫 Did shoot?', didShoot);
    
    if (didShoot) {
      const isLastShot = ammo.current - 1 === 0;
      const recoilMultiplier = isLastShot ? 3.5 : 1;
      
      if (isLastShot) {
        console.log('💥 Last shot - applying extra recoil!');
      }
      
      // Trigger fire animation with recoil
      weaponAnimRef.current?.triggerFire(recoilMultiplier);
      
      // Check if we just emptied the mag
      if (isLastShot) {
        console.log('📭 Magazine empty - playing SlideBack then ReloadEmpty');
        
        // SlideBack duration: (85.6 - 84.8) / 24fps = 0.033s ≈ 33ms
        const slideBackDuration = ((85.6 - 84.8) / 24) * 1000; // Convert to ms
        
        // Play SlideBack IMMEDIATELY (no delay)
        weaponAnimRef.current?.triggerSlideBack();
        
        // Then start reload process and play ReloadEmpty after SlideBack completes
        setTimeout(() => {
          const didReload = reload(true); // Empty reload
          console.log('🔄 Did reload (empty)?', didReload);
          weaponAnimRef.current?.triggerReload(true);
        }, slideBackDuration + 50); // SlideBack duration + small buffer
      }
    }
  }, [shoot, ammo.current, reload]);

  const handleShoot = useCallback((hitInfo: { targetId: string | null; hitPosition: THREE.Vector3 | null }) => {
    if (hitInfo.targetId && gameControllerRef.current) {
      gameControllerRef.current.handleTargetHit(hitInfo.targetId);
      setScore(prev => prev + 1);
    }
  }, []);

  const handleTargetHit = (targetId: string, mouseData: any) => {
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

  // Handle R key for manual reload
  const handleReload = useCallback(() => {
    console.log('🔄 R key pressed!', {
      isReloading: ammo.isReloading,
      current: ammo.current,
      max: ammo.max
    });
    
    if (ammo.isReloading || ammo.current === ammo.max) {
      console.log('❌ Cannot reload - already reloading or mag full');
      return;
    }
    
    console.log('✅ Manual reload starting');
    const didReload = reload(false); // Normal reload
    console.log('🔄 Did reload (manual)?', didReload);
    console.log('🎬 Calling triggerReload on weaponAnimRef:', weaponAnimRef.current);
    weaponAnimRef.current?.triggerReload(false);
  }, [ammo.isReloading, ammo.current, ammo.max, reload]);

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
              <h2>FPS Training</h2>
              <p style={{ margin: '20px 0' }}>
                WASD - Move | Space - Jump | Shift - Crouch<br/>
                Mouse - Look | Left Click - Shoot | R - Reload
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

          {/* Ammo counter */}
          <div style={{
            position: 'absolute',
            bottom: 80,
            right: 20,
            color: ammo.isEmpty ? '#ff6b6b' : 'white',
            fontSize: '32px',
            fontWeight: 'bold',
            zIndex: 10,
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}>
            {ammo.current} / {ammo.max}
            {ammo.isReloading && (
              <span style={{ fontSize: '16px', display: 'block', color: '#4ecdc4' }}>
                RELOADING...
              </span>
            )}
          </div>

          {/* Movement speed indicator */}
          <div style={{
            position: 'absolute',
            bottom: 50,
            left: 20,
            color: 'white',
            fontSize: '14px',
            zIndex: 10,
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}>
            Speed: {Math.round(new THREE.Vector2(velocity.x, velocity.z).length())} u/s
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
        <ShootingSystemWrapper 
          isActive={isLocked && phase === 'training'} 
          canShoot={!ammo.isReloading && ammo.current > 0}
          onShoot={handleShoot}
          onTriggerPull={handleTriggerPull}
        />
        <ReloadKeyListener 
          isActive={isLocked && phase === 'training'}
          onReload={handleReload}
        />
        <Environment />
        <GlockModel 
          ref={weaponAnimRef}
          position={[0.02, -1.56, -0.081]} 
          rotation={[0, Math.PI, 0]}
          scale={1}
          velocity={velocity}
          physics={physicsRef.current}
        />
        
        <GameController 
          ref={gameControllerRef}
          isLocked={isLocked} 
          onTargetHit={handleTargetHit}
          onPhaseChange={handlePhaseChange}
        />
      </Canvas>
    </div>
  );
};

// Wrapper to use hook inside Canvas
const ShootingSystemWrapper: React.FC<{ 
  isActive: boolean; 
  canShoot: boolean;
  onShoot: (hitInfo: any) => void;
  onTriggerPull: () => void;
}> = ({ isActive, canShoot, onShoot, onTriggerPull }) => {
  useShootingSystem({ isActive, canShoot, onShoot, onTriggerPull });
  return null;
};

// Reload key listener
const ReloadKeyListener: React.FC<{ isActive: boolean; onReload: () => void }> = ({ isActive, onReload }) => {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        onReload();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onReload]);

  return null;
};