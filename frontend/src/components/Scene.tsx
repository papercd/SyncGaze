// frontend/src/components/Scene.tsx
// Updated to use WebGazer context only - properly typed for all components

import { Canvas, useThree } from '@react-three/fiber';
import { useRef, useEffect, useState, useCallback } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Environment } from './Environment';
import { GameController, GameControllerRef } from './GameController';
import { Crosshair } from './Crosshair';
import { GlockModel, GlockModelRef } from './GlockModel';
import { CameraController } from './CameraController';
import { usePointerLock } from '../hooks/usePointerLock';
import { useAmmoSystem } from '../hooks/useAmmoSystem';
import { CS2Physics } from '../utils/cs2Physics';
import { useTrackingData } from '../hooks/useTrackingData';
import { CalibrationOverlay, ValidationOverlay } from './CalibrationOverlay';
import { LiveGaze } from '../types/calibration';
import { useWebgazer } from '../hooks/tracking/useWebgazer';

type Phase = 'idle' | 'calibration' | 'confirmValidation' | 'validation' | 'training' | 'complete';

interface SceneProps {
  skipCalibration?: boolean;
  isTrainingProp?: boolean;
}

export const Scene: React.FC<SceneProps> = ({ 
  skipCalibration = false,
  isTrainingProp = false
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { isLocked, requestPointerLock, exitPointerLock } = usePointerLock(canvasRef);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const startTimeRef = useRef<number>(0);
  
  const [liveGaze, setLiveGaze] = useState<LiveGaze>({ x: null, y: null });
  
  // Use WebGazer context (single source of truth for WebGazer)
  const {
    isReady: isWebGazerReady,
    validationError,
    handleRecalibrate,
    isValidationSuccessful,
    validationSequence
  } = useWebgazer();

  // Use tracking data hook for data collection (no WebGazer initialization)
  const {
    recordTargetHit,
    exportData,
    clearData,
    dataCount
  } = useTrackingData({
    isActive: isLocked,
    phase
  });

  const { ammo, shoot, reload } = useAmmoSystem(20);
  
  // Physics state
  const [velocity, setVelocity] = useState(new THREE.Vector3());
  const [playerPosition, setPlayerPosition] = useState(new THREE.Vector3());
  const physicsRef = useRef(new CS2Physics());
  const cameraRotationRef = useRef(new THREE.Euler());
  
  // Component refs
  const gameControllerRef = useRef<GameControllerRef | null>(null);
  const weaponAnimRef = useRef<GlockModelRef | null>(null);
  const validationAutoStartRef = useRef(validationSequence);

  // Auto-start training when parent sets isTrainingProp to true
  useEffect(() => {
    if (isTrainingProp && skipCalibration && phase === 'idle') {
      clearData();
      setScore(0);
      setPhase('training');
      startTimeRef.current = performance.now();
      requestPointerLock();
    }
  }, [isTrainingProp, skipCalibration, phase, clearData, requestPointerLock]);

  // Camera rotation tracker component
  const CameraRotationTracker = () => {
    const { camera } = useThree();
    useEffect(() => {
      const updateRotation = () => {
        cameraRotationRef.current.setFromQuaternion(camera.quaternion);
      };
      const interval = setInterval(updateRotation, 16);
      return () => clearInterval(interval);
    }, [camera]);
    return null;
  };

  // Set up live gaze tracking from context
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

  // Physics update callback from CameraController
  const handlePhysicsUpdate = useCallback((
    position: THREE.Vector3,
    vel: THREE.Vector3,
    physics: CS2Physics
  ) => {
    setVelocity(vel);
    setPlayerPosition(position);
  }, []);

  // Handle trigger pull (weapon animation)
  const handleTriggerPull = useCallback(() => {
    const didShoot = shoot();
    
    if (didShoot) {
      const isLastShot = ammo.current - 1 === 0;
      const recoilMultiplier = isLastShot ? 1.5 : 1.0;
      weaponAnimRef.current?.triggerFire(recoilMultiplier);
      
      if (ammo.current === 0) {
        weaponAnimRef.current?.triggerSlideBack();
      }
    }
  }, [shoot, ammo]);

  // Handle reload
  const handleReload = useCallback(() => {
    const isEmpty = ammo.current === 0;
    reload();
    weaponAnimRef.current?.triggerReload(isEmpty);
  }, [reload, ammo]);

  // Handle target hit from GameController
  const handleTargetHit = useCallback((targetId: string, mouseData: any) => {
    if (phase === 'training') {
      setScore(prev => prev + 1);
      
      // Record hit data
      const targetPos = { x: 0, y: 0, z: 0 }; // Could get actual position from mouseData if needed
      const camRot = {
        x: cameraRotationRef.current.x,
        y: cameraRotationRef.current.y,
        z: cameraRotationRef.current.z
      };
      const playerPos = {
        x: playerPosition.x,
        y: playerPosition.y,
        z: playerPosition.z
      };
      
      // Pass the required arguments to recordTargetHit
      recordTargetHit(
        targetId, 
        targetPos, 
        { x: 0, y: 0 }, // Placeholder for targetScreenPos as it's not calculated here
        mouseData, 
        camRot, 
        playerPos
      );
    }
  }, [phase, playerPosition, recordTargetHit]);

  // Handle phase change from GameController
  const handlePhaseChange = useCallback((newPhase: 'training' | 'complete') => {
    if (newPhase === 'complete') {
      setPhase('complete');
      exitPointerLock();
      exportData();
    }
  }, [exitPointerLock, exportData]);

  // Calibration handlers
  const handleCalibrationComplete = useCallback(() => {
    setPhase('confirmValidation');
  }, []);

  const handleStartValidation = useCallback(() => {
    setPhase('validation');
  }, []);

  const handleValidationComplete = useCallback(() => {
    setPhase('training');
    clearData();
    setScore(0);
    startTimeRef.current = performance.now();
    requestPointerLock();
  }, [clearData, requestPointerLock]);

  const handleRecalibrateClick = useCallback(() => {
    handleRecalibrate();
    clearData();
    setPhase('calibration');
  }, [handleRecalibrate, clearData]);

  // Reload key listener
  useEffect(() => {
    if (phase !== 'training' || !isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        handleReload();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, isLocked, handleReload]);

  // Mouse click listener for shooting
  useEffect(() => {
    if (phase !== 'training' || !isLocked) return;

    const handleClick = (e: MouseEvent) => {
      if (e.button === 0) { // Left click
        handleTriggerPull();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [phase, isLocked, handleTriggerPull]);

  return (
    <div ref={canvasRef} className="w-full h-full relative">
      {/* Calibration Overlay */}
      {phase === 'calibration' && (
        <CalibrationOverlay
          onComplete={handleCalibrationComplete}
          liveGaze={liveGaze}
        />
      )}

      {/* Validation Confirmation */}
      {phase === 'confirmValidation' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-white p-8 rounded-lg max-w-md">
            <h2 className="text-2xl font-bold mb-4">Calibration Complete</h2>
            <p className="mb-6">Ready to validate your eye tracking accuracy?</p>
            <div className="flex gap-4">
              <button
                onClick={handleStartValidation}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Start Validation
              </button>
              <button
                onClick={handleRecalibrateClick}
                className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Recalibrate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Overlay */}
      {phase === 'validation' && (
        <ValidationOverlay
          validationError={validationError}
          onStartTraining={handleValidationComplete}
          onRecalibrate={handleRecalibrateClick}
        />
      )}

      {/* Main Menu */}
      {phase === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-white p-8 rounded-lg max-w-md">
            <h1 className="text-3xl font-bold mb-6">FPS Trainer</h1>
            <div className="space-y-4">
              {!skipCalibration && (
                <button
                  onClick={() => setPhase('calibration')}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={!isWebGazerReady}
                >
                  {isWebGazerReady ? 'Start Training' : 'Loading WebGazer...'}
                </button>
              )}
              {validationError !== null && (
                <div className="p-4 bg-gray-100 rounded">
                  <p className="text-sm text-gray-600">
                    Last validation error: {validationError.toFixed(1)}px
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Complete Screen */}
      {phase === 'complete' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-white p-8 rounded-lg max-w-md">
            <h2 className="text-2xl font-bold mb-4">Session Complete!</h2>
            <div className="space-y-2 mb-6">
              <p>Score: {score}</p>
              <p>Data Points: {dataCount}</p>
            </div>
            <button
              onClick={() => setPhase('idle')}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}

      {/* Live Gaze Indicator (Debug) */}
      {liveGaze.x !== null && liveGaze.y !== null && phase === 'training' && (
        <div
          className="absolute w-4 h-4 bg-red-500 rounded-full pointer-events-none z-40"
          style={{
            left: `${liveGaze.x}px`,
            top: `${liveGaze.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}

      {/* HUD */}
      {phase === 'training' && (
        <div className="absolute top-4 left-4 text-white z-30">
          <div className="text-2xl font-bold">Score: {score}</div>
          <div className="text-xl">Ammo: {ammo.current} / 20</div>
          <div className="text-sm text-gray-300">Data: {dataCount} points</div>
        </div>
      )}
      {phase === 'training' && <Crosshair />}

      {/* 3D Canvas */}
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 1.6, 0]} fov={90} />
        <CameraRotationTracker />
        
        {phase === 'training' && (
          <>
            <CameraController
              isActive={isLocked}
              onPhysicsUpdate={handlePhysicsUpdate}
            />
            
            <GameController
              ref={gameControllerRef}
              isLocked={isLocked}
              onTargetHit={handleTargetHit}
              onPhaseChange={handlePhaseChange}
            />

            <GlockModel
              ref={weaponAnimRef}
              position={[0.02, -1.56, -0.081]}
              rotation={[0, Math.PI, 0]}
              scale={1}
              velocity={velocity}
              physics={physicsRef.current}
            />
          </>
        )}

        <Environment />
        
   
      </Canvas>
    </div>
  );
};