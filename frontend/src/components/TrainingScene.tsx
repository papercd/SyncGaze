// frontend/src/components/TrainingScene.tsx
// UPDATED: Now passes collected training data to parent

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
import { useTrackingData, TrackingDataRecord } from '../hooks/useTrackingData';
import { LiveGaze } from '../types/calibration';
import { useWebgazer } from '../hooks/tracking/useWebgazer';
import ControlSettingsPanel from './ControlSettingsPanel';

interface TrainingSceneProps {
  onComplete?: (score: number, targetsHit: number, rawData: TrackingDataRecord[]) => void;
}

export const TrainingScene: React.FC<TrainingSceneProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { isLocked, requestPointerLock, exitPointerLock } = usePointerLock(canvasRef);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0); // ADD THIS
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [liveGaze, setLiveGaze] = useState<LiveGaze>({ x: null, y: null });
  
  // Use WebGazer context (only for gaze data, not calibration)
  const { isReady: isWebGazerReady } = useWebgazer();


  const updateActiveTargetPosition = useCallback(() => {
    if (!cameraRef.current || !sceneRef.current) return null;
    
    // Assuming you track which target is currently active
    // You'll need to modify GameController to expose the current active target
    const activeTargetId = gameControllerRef.current?.getActiveTargetId?.();
    
    if (!activeTargetId) return null;
    
    let targetFound = false;
    let target3DPos = new THREE.Vector3();
    
    sceneRef.current.traverse((obj) => {
      if (obj.userData?.targetId === activeTargetId || obj.name === activeTargetId) {
        obj.getWorldPosition(target3DPos);
        targetFound = true;
      }
    });
    
    if (!targetFound) return null;
    
    const screenPos = projectToScreen(target3DPos, cameraRef.current);
    
    return {
      id: activeTargetId,
      position3D: { x: target3DPos.x, y: target3DPos.y, z: target3DPos.z },
      screenX: screenPos.x,
      screenY: screenPos.y,
    };
  }, []);

  // Use tracking data hook for data collection
  const {
    recordTargetHit,
    getData,
    exportData,
    clearData,
    dataCount
  } = useTrackingData({
    isActive: isLocked,
    phase: 'training',
    getCurrentActiveTarget: updateActiveTargetPosition  // ✅ Pass the function
  });

  
  const ammo = { current: Infinity };
  const shoot = () => true; // Always return true
  
  // Physics state
  const [velocity, setVelocity] = useState(new THREE.Vector3());
  const [playerPosition, setPlayerPosition] = useState(new THREE.Vector3(0, 1.6, -10));
  const physicsRef = useRef(new CS2Physics());
  const cameraRotationRef = useRef(new THREE.Euler());
  
  // Component refs
  const gameControllerRef = useRef<GameControllerRef | null>(null);
  const weaponAnimRef = useRef<GlockModelRef | null>(null);
  const timerStartTime = useRef<number>(0);
  const pausedTime = useRef<number>(0);
  const totalPausedDuration = useRef<number>(0);

  const cameraRef = useRef<THREE.Camera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  const activeTargetRef = useRef<{
    id: string;
    position3D: THREE.Vector3;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Auto-start training on mount
  useEffect(() => {
    clearData();
    setScore(0);
    setTimeRemaining(60);
    requestPointerLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount


 


  // Timer - calculate based on elapsed time
  useEffect(() => {
    // Start timer on first lock
    if (isLocked && timerStartTime.current === 0) {
      timerStartTime.current = Date.now();
      console.log('⏰ Timer started');
    }

    // Track pause/resume
    if (!isLocked && timerStartTime.current > 0) {
      // Just paused
      if (pausedTime.current === 0) {
        pausedTime.current = Date.now();
        console.log('⏸️ Game paused');
      }
    } else if (isLocked && pausedTime.current > 0) {
      // Just resumed
      const pauseDuration = Date.now() - pausedTime.current;
      totalPausedDuration.current += pauseDuration;
      pausedTime.current = 0;
      console.log('▶️ Game resumed, paused for:', pauseDuration, 'ms');
    }

    if (!isLocked) return; // Don't update timer while paused

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - timerStartTime.current - totalPausedDuration.current) / 1000
      );
      const remaining = Math.max(0, 60 - elapsed);
      
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isLocked]);

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

  // Set up live gaze tracking
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

  // Physics update callback
  const handlePhysicsUpdate = useCallback((
    position: THREE.Vector3,
    vel: THREE.Vector3,
    physics: CS2Physics
  ) => {
    setVelocity(vel);
    setPlayerPosition(position);
  }, []);

  const handleTriggerPull = useCallback(() => {
    weaponAnimRef.current?.triggerFire(1.0);
  }, []);

  const projectToScreen = (
    worldPos: THREE.Vector3,
    camera: THREE.Camera
  ): { x: number; y: number } => {
    const vector = worldPos.clone();
    vector.project(camera);
    
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
    
    return { x, y };
  };
  

  const TargetTracker = () => {
    const { camera, scene } = useThree();
    
    useEffect(() => {
      // Store references for handleTargetHit to access
      cameraRef.current = camera;
      sceneRef.current = scene;
    }, [camera, scene]);
    
    return null;
  };
  


    const handleTargetHit = useCallback((targetId: string, mouseData: any) => {
      setScore(prev => {
        const newScore = prev + 1;
        scoreRef.current = newScore; // ADD THIS
        return newScore;
      });
      
      // Find the actual target in the scene - need to search recursively
      let target3DPos = new THREE.Vector3(0, 0, 0);
      let targetFound = false;
      
      if (sceneRef.current) {
        // Search through all objects recursively
        sceneRef.current.traverse((obj) => {
          if (obj.userData?.targetId === targetId || obj.name === targetId) {
            obj.getWorldPosition(target3DPos);
            targetFound = true;
            console.log('✅ Found target:', targetId, 'at position:', target3DPos);
          }
        });
        
        if (!targetFound) {
          console.warn('⚠️ Could not find target in scene:', targetId);
        }
      }
      
      // Convert 3D world position to 2D screen coordinates
      let targetScreenPos = { x: 0, y: 0 };
      if (cameraRef.current && targetFound) {
        targetScreenPos = projectToScreen(target3DPos, cameraRef.current);
        console.log('📍 Target screen position:', targetScreenPos);
      }
      
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
      
      // Pass both 3D and 2D positions, plus mouse data
      recordTargetHit(
        targetId, 
        { x: target3DPos.x, y: target3DPos.y, z: target3DPos.z },
        targetScreenPos,
        mouseData,
        camRot, 
        playerPos
      );
    }, [playerPosition, recordTargetHit]);

  // Handle training complete
  const handlePhaseChange = useCallback((newPhase: 'training' | 'complete') => {
    if (newPhase === 'complete') {
      exitPointerLock();
      
      const collectedData = getData();
      const targetsHit = collectedData.filter(d => d.hitRegistered).length;
      
      console.log('✅ Training complete:', {
        score: scoreRef.current, // USE REF HERE
        targetsHit,
        dataPointsCollected: collectedData.length
      });
      
      // Pass the ref value
      onComplete?.(scoreRef.current, targetsHit, collectedData); // USE REF HERE
    }
  }, [exitPointerLock, onComplete, getData]); 

  // Mouse click listener - just handles weapon animations
  useEffect(() => {
    if (!isLocked) return;

    const handleClick = (e: MouseEvent) => {
      if (e.button === 0) {
        handleTriggerPull();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isLocked, handleTriggerPull]);

  // Shooting Controller - handles raycasting for target detection
  const ShootingController = () => {
    const { camera, scene } = useThree();
    const raycasterRef = useRef(new THREE.Raycaster());

    useEffect(() => {
      if (!isLocked) return;

      const handleShoot = (e: MouseEvent) => {
        if (e.button !== 0) return;
  

        raycasterRef.current.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycasterRef.current.intersectObjects(scene.children, true);
        
        const targetHit = intersects.find(intersect => {
          let obj: THREE.Object3D | null = intersect.object;
          while (obj) {
            if (obj.userData?.isTarget || obj.name?.startsWith('target-')) {
              return true;
            }
            obj = obj.parent;
          }
          return false;
        });

        if (targetHit) {
          let obj: THREE.Object3D | null = targetHit.object;
          let targetId: string | null = null;
          
          while (obj && !targetId) {
            if (obj.userData?.targetId) {
              targetId = obj.userData.targetId;
              break;
            }
            if (obj.name?.startsWith('target-')) {
              targetId = obj.name;
              break;
            }
            obj = obj.parent;
          }

          if (targetId) {
            console.log('🎯 Target hit!', targetId);
            gameControllerRef.current?.handleTargetHit(targetId);
          }
        } else {
          console.log('❌ Missed');
        }
      };

      document.addEventListener('mousedown', handleShoot);
      return () => document.removeEventListener('mousedown', handleShoot);
    }, [camera, scene, isLocked]);

    return null;
  };

  console.log('🔄 TrainingScene render - timeRemaining:', timeRemaining);

  return (
    <div ref={canvasRef} className="w-screen h-screen fixed inset-0">
      
      {!isLocked && (
        <div className="training-pause-overlay" role="dialog" aria-label="Training paused">
          <div className="training-pause-dialog">
            <h2>Paused</h2>
            <p className="pause-subtitle">
              Press resume to continue or adjust your control sensitivity while the timer is paused.
            </p>

            <div className="pause-actions">
              <button type="button" className="pause-primary" onClick={requestPointerLock}>
                Resume training
              </button>
              <div className="pause-time">
                Timer: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </div>
            </div>

            <ControlSettingsPanel compact showReset />

            <p className="pause-hint">Press Esc at any time to pause training.</p>
          </div>
        </div>
      )}
  
      <div className="absolute top-4 left-4 z-30">
        <div className="text-sm text-gray-300">Press Esc to pause and adjust settings.</div>
      </div>

      <div className="absolute top-4 right-4 text-white z-30">
        <div className="text-2xl font-bold">Score: {score}</div>

        <div className="text-sm text-gray-300">Data: {dataCount} points</div>
      </div>

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white z-30">
        <div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-lg border-2 border-white/20">
          <div className="text-center">
            <div className="text-sm text-gray-300 uppercase tracking-wider mb-1">Time Remaining</div>
            <div className={`text-4xl font-bold font-mono ${timeRemaining <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      <Crosshair />

      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 1.6, -8]}rotation={[0, Math.PI, 0]}  fov={90} />
        <CameraRotationTracker />
        <TargetTracker /> 
        <ShootingController />
        
        <CameraController
          isActive={isLocked}
          initialPosition={new THREE.Vector3(0, 1.6, -8)} // Add this
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

        <Environment />
      </Canvas>
    </div>
  );
};