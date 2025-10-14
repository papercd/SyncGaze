// frontend/src/components/Scene.tsx - MERGED VERSION WITH NEW CALIBRATION
import { Canvas, useThree } from '@react-three/fiber';
import { useRef, useEffect, useState, useCallback } from 'react';
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
import { useTrackingSystem } from './TrackingIntegration';
import { CalibrationOverlay, ValidationOverlay } from './CalibrationOverlay';
import { LiveGaze } from '../types/calibration'; // NEW IMPORT

type Phase = 'idle' | 'calibration' | 'confirmValidation' | 'validation' | 'training' | 'complete';

export const Scene: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { isLocked, requestPointerLock, exitPointerLock } = usePointerLock(canvasRef);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const startTimeRef = useRef<number>(0);
  
  // NEW: Live gaze state for Stage 3 calibration
  const [liveGaze, setLiveGaze] = useState<LiveGaze>({ x: null, y: null });
  
  // Tracking system integration
  const {
    isWebGazerReady,
    validationError,
    recordTargetHit,
    exportData,
    clearData,
    recalibrate,
    dataCount
  } = useTrackingSystem({
    isActive: isLocked,
    phase: phase as any
  });

  // Ammo system
  const { ammo, shoot, reload } = useAmmoSystem(20);
  
  // Physics state
  const physicsRef = useRef(new CS2Physics());
  const [velocity, setVelocity] = useState(new THREE.Vector3());
  const [playerPosition, setPlayerPosition] = useState(new THREE.Vector3());
  const cameraRotationRef = useRef(new THREE.Euler());
  
  // Reference to GameController and weapon animation
  const gameControllerRef = useRef<{ handleTargetHit: (targetId: string) => void } | null>(null);
  const weaponAnimRef = useRef<{ 
    triggerFire: (recoilMultiplier?: number) => void;
    triggerSlideBack: () => void;
    triggerReload: (isEmpty: boolean) => void;
  } | null>(null);

  // Camera rotation tracking component
  const CameraRotationTracker = () => {
    const { camera } = useThree();
    useEffect(() => {
      const updateRotation = () => {
        cameraRotationRef.current.setFromQuaternion(camera.quaternion);
      };
      const interval = setInterval(updateRotation, 16); // ~60fps
      return () => clearInterval(interval);
    }, [camera]);
    return null;
  };

  // NEW: Set up live gaze tracking listener for Stage 3 calibration
  useEffect(() => {
    if (!isWebGazerReady || !window.webgazer) return;

    const gazeListener = (data: any) => {
      if (data && data.x !== undefined && data.y !== undefined) {
        setLiveGaze({ x: data.x, y: data.y });
      }
    };

    try {
      window.webgazer.setGazeListener(gazeListener);
    } catch (error) {
      console.error('Failed to set gaze listener:', error);
    }

    return () => {
      if (window.webgazer) {
        try {
          window.webgazer.clearGazeListener();
        } catch (error) {
          console.error('Failed to clear gaze listener:', error);
        }
      }
    };
  }, [isWebGazerReady]);

  const handleTriggerPull = useCallback(() => {
    const didShoot = shoot();
    
    if (didShoot) {
      const isLastShot = ammo.current - 1 === 0;
      const recoilMultiplier = isLastShot ? 1.24 : 1;
      
      weaponAnimRef.current?.triggerFire(recoilMultiplier);
      
      if (isLastShot) {
        const slideBackDuration = ((85.6 - 84.8) / 24) * 1000;
        weaponAnimRef.current?.triggerSlideBack();
        
        setTimeout(() => {
          const didReload = reload(true);
          weaponAnimRef.current?.triggerReload(true);
        }, slideBackDuration + 50);
      }
    }
  }, [shoot, ammo.current, reload]);

  const handleShoot = useCallback((hitInfo: { targetId: string | null; hitPosition: THREE.Vector3 | null }) => {
    if (hitInfo.targetId && gameControllerRef.current) {
      // Record hit in tracking system
      if (hitInfo.hitPosition && phase === 'training') {
        recordTargetHit(
          hitInfo.targetId,
          {
            x: hitInfo.hitPosition.x,
            y: hitInfo.hitPosition.y,
            z: hitInfo.hitPosition.z
          },
          {
            x: cameraRotationRef.current.x,
            y: cameraRotationRef.current.y,
            z: cameraRotationRef.current.z
          },
          {
            x: playerPosition.x,
            y: playerPosition.y,
            z: playerPosition.z
          }
        );
      }
      
      gameControllerRef.current.handleTargetHit(hitInfo.targetId);
      setScore(prev => prev + 1);
    }
  }, [recordTargetHit, phase, playerPosition]);

  const handlePhaseChange = (newPhase: 'training' | 'complete') => {
    if (newPhase === 'complete') {
      setPhase('complete');
      exitPointerLock();
      // Export tracking data
      exportData();
    }
  };

  const handleStart = () => {
    clearData();
    setScore(0);
    setPhase('calibration');
  };

  const handleCalibrationComplete = () => {
    setPhase('confirmValidation');
  };

  const handleConfirmValidation = () => {
    setPhase('validation');
  };

  const handleStartTraining = () => {
    setPhase('training');
    startTimeRef.current = performance.now();
    requestPointerLock();
  };

  const handleRecalibrate = () => {
    recalibrate();
    setPhase('calibration');
  };

  const handlePhysicsUpdate = (position: THREE.Vector3, vel: THREE.Vector3, physics: CS2Physics) => {
    setPlayerPosition(position);
    setVelocity(vel);
    physicsRef.current = physics;
  };

  const handleReload = useCallback(() => {
    if (ammo.isReloading || ammo.current === ammo.max) return;
    
    const didReload = reload(false);
    weaponAnimRef.current?.triggerReload(false);
  }, [ammo.isReloading, ammo.current, ammo.max, reload]);

  return (
    <div ref={canvasRef} style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Calibration Overlay - NOW WITH liveGaze PROP */}
      {phase === 'calibration' && isWebGazerReady && (
        <CalibrationOverlay 
          onComplete={handleCalibrationComplete}
          liveGaze={liveGaze}  // NEW: Pass live gaze data
        />
      )}

      {/* Validation Confirmation */}
      {phase === 'confirmValidation' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          textAlign: 'center',
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          padding: '40px',
          borderRadius: '10px',
          maxWidth: '600px'
        }}>
          <h2>Calibration Complete</h2>
          <p style={{ margin: '20px 0' }}>
            Now we'll measure the accuracy of the calibration.<br/>
            This will help us validate the eye tracking quality.
          </p>
          <button onClick={handleConfirmValidation} style={{
            padding: '15px 30px',
            fontSize: '18px',
            cursor: 'pointer',
            backgroundColor: '#4ecdc4',
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}>
            Start Accuracy Test
          </button>
        </div>
      )}

      {/* Validation Overlay */}
      {phase === 'validation' && (
        <ValidationOverlay
          validationError={validationError}
          onStartTraining={handleStartTraining}
          onRecalibrate={handleRecalibrate}
        />
      )}

      {/* Start/Complete overlay */}
      {(!isLocked || phase === 'complete' || phase === 'idle') && phase !== 'calibration' && phase !== 'validation' && phase !== 'confirmValidation' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          textAlign: 'center',
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          padding: '40px',
          borderRadius: '10px',
          maxWidth: '600px'
        }}>
          {phase === 'complete' ? (
            <>
              <h2>Training Complete!</h2>
              <p style={{ fontSize: '24px', margin: '20px 0' }}>Final Score: {score}</p>
              <p style={{ fontSize: '16px', color: '#4ecdc4', marginBottom: '20px' }}>
                ✅ Tracking data has been exported to CSV
              </p>
              <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '20px' }}>
                Data points collected: {dataCount}
              </p>
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
              <h2>FPS Training with Eye Tracking</h2>
              <div style={{ 
                textAlign: 'left', 
                margin: '20px 0', 
                padding: '20px', 
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px'
              }}>
                <p style={{ marginBottom: '10px' }}><strong>Controls:</strong></p>
                <ul style={{ paddingLeft: '20px' }}>
                  <li>WASD - Move</li>
                  <li>Space - Jump</li>
                  <li>Shift - Crouch</li>
                  <li>Mouse - Look</li>
                  <li>Left Click - Shoot</li>
                  <li>R - Reload</li>
                </ul>
              </div>
              <div style={{
                padding: '15px',
                backgroundColor: 'rgba(78, 205, 196, 0.1)',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '14px', color: '#4ecdc4', marginBottom: '10px' }}>
                  📊 Eye Tracking Enabled
                </p>
                <p style={{ fontSize: '12px', color: '#aaa' }}>
                  Your gaze and mouse movements will be recorded during training
                </p>
              </div>
              <button onClick={handleStart} style={{
                padding: '20px 40px',
                fontSize: '20px',
                cursor: 'pointer',
                backgroundColor: '#4ecdc4',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontWeight: 'bold'
              }}>
                {isWebGazerReady ? 'Start Training' : 'Loading Eye Tracking...'}
              </button>
              {!isWebGazerReady && (
                <p style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>
                  Please wait for WebGazer to load...
                </p>
              )}
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
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            textAlign: 'right'
          }}>
            <div>Time: {Math.floor((performance.now() - startTimeRef.current) / 1000)}s / 90s</div>
            <div style={{ fontSize: '14px', color: '#4ecdc4', marginTop: '5px' }}>
              📊 Recording: {dataCount} data points
            </div>
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

      {/* Canvas - YOUR EXISTING TRAINING GROUND RENDERING */}
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 1.6, 0]} fov={90} />
        <CameraController 
          isActive={isLocked && phase === 'training'} 
          onPhysicsUpdate={handlePhysicsUpdate}
        />
        <CameraRotationTracker />
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
          isLocked={isLocked && phase === 'training'} 
          onTargetHit={() => {}}
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