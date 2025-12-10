// frontend/src/hooks/useTrackingData.ts
// UPDATED: Added targetX/targetY (screen coords) and proper mouse data capture

import { useRef, useEffect, useCallback } from 'react';
import { useWebgazer } from './tracking/useWebgazer';

// Data structure for collected tracking data
export interface TrackingDataRecord {
  timestamp: number;
  phase: 'training' | 'calibration' | 'validation';
  targetId: string | null;
  targetPosition: { x: number; y: number; z: number } | null;
  targetX: number | null;  // 2D screen coordinate X
  targetY: number | null;  // 2D screen coordinate Y
  gazeX: number | null;
  gazeY: number | null;
  mouseX: number | null;
  mouseY: number | null;
  cameraRotation: { x: number; y: number; z: number } | null;
  playerPosition: { x: number; y: number; z: number } | null;
  hitRegistered: boolean;
}

interface UseTrackingDataProps {
  isActive: boolean;
  phase: 'idle' | 'calibration' | 'confirmValidation' | 'validation' | 'training' | 'complete';
  getCurrentActiveTarget?: () => {
    id: string;
    position3D: { x: number; y: number; z: number };
    screenX: number;
    screenY: number;
  } | null;
}

export const useTrackingData = ({ isActive, phase, getCurrentActiveTarget }: UseTrackingDataProps) => {
  const { isReady, liveGaze, validationError } = useWebgazer();
  const collectedData = useRef<TrackingDataRecord[]>([]);
  const gazeSampleCount = useRef(0);

    // Data collection during training
    // Data collection during training
   // Data collection during training
  useEffect(() => {
    if (phase !== 'training' || !isActive || !window.webgazer || !isReady) return;

    // Throttling variables
    let lastGazeTime = 0;
    const GAZE_SAMPLE_INTERVAL = 100; // Sample every 100ms (10 Hz)
    
    // In pointer lock mode, mouse is at screen center (where crosshair is)
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    
    // Track latest mouse position (but in pointer lock, this will be center)
    let currentMouseX: number | null = screenCenterX;
    let currentMouseY: number | null = screenCenterY;

    // Gaze data listener with throttling - NOW INCLUDES MOUSE DATA
    const gazeListener = (data: any) => {
      const now = performance.now();
      if (data && (now - lastGazeTime >= GAZE_SAMPLE_INTERVAL)) {
        lastGazeTime = now;
        
        // Get current active target position (passed via ref or callback)
        const activeTarget = getCurrentActiveTarget?.();
        
        collectedData.current.push({
          timestamp: now,
          phase: 'training',
          targetId: activeTarget?.id ?? null,
          targetPosition: activeTarget?.position3D ?? null,
          targetX: activeTarget?.screenX ?? null,  // ✅ Active target screen position
          targetY: activeTarget?.screenY ?? null,  // ✅ Active target screen position
          gazeX: data.x,
          gazeY: data.y,
          mouseX: currentMouseX,
          mouseY: currentMouseY,
          cameraRotation: null,
          playerPosition: null,
          hitRegistered: false,
        });
        gazeSampleCount.current += 1;
      }
    };

    // Mouse movement listener
    const mouseMoveListener = (event: MouseEvent) => {
      if (document.pointerLockElement === null) {
        currentMouseX = event.clientX;
        currentMouseY = event.clientY;
      }
    };

    try {
      window.webgazer.setGazeListener(gazeListener);
      document.addEventListener('mousemove', mouseMoveListener);
    } catch (error) {
      console.error('Failed to set up data collection:', error);
    }

    return () => {
      if (window.webgazer) {
        try {
          window.webgazer.clearGazeListener();
        } catch (error) {
          console.error('Failed to clear gaze listener:', error);
        }
      }
      document.removeEventListener('mousemove', mouseMoveListener);
    };
  }, [phase, isActive, isReady, getCurrentActiveTarget]);
          

  // Record target hit with 2D screen coordinates and mouse data
  const recordTargetHit = useCallback((
    targetId: string,
    targetPosition: { x: number; y: number; z: number },
    targetScreenPos: { x: number; y: number },
    mouseData: { x: number; y: number } | null,
    cameraRotation: { x: number; y: number; z: number },
    playerPosition: { x: number; y: number; z: number }
  ) => {
    collectedData.current.push({
      timestamp: performance.now(),
      phase: 'training',
      targetId,
      targetPosition,
      targetX: targetScreenPos.x,
      targetY: targetScreenPos.y,
      gazeX: null,
      gazeY: null,
      mouseX: mouseData?.x ?? null,
      mouseY: mouseData?.y ?? null,
      cameraRotation,
      playerPosition,
      hitRegistered: true,
    });
  }, []);

  // Get collected data
  const getData = useCallback((): TrackingDataRecord[] => {
    return [...collectedData.current]; // Return a copy
  }, []);

  // Export data as CSV
  const exportData = useCallback(() => {
    const metaData = `# Validation Error (pixels): ${validationError !== null ? validationError.toFixed(2) : 'N/A'}\n`;
    const header = 'timestamp,phase,targetId,target3DX,target3DY,target3DZ,targetX,targetY,gazeX,gazeY,mouseX,mouseY,cameraRotX,cameraRotY,cameraRotZ,playerX,playerY,playerZ,hitRegistered';
    
    const rows = collectedData.current.map(d => {
      const targetPos = d.targetPosition;
      const camRot = d.cameraRotation;
      const playerPos = d.playerPosition;
      
      return [
        d.timestamp,
        d.phase,
        d.targetId ?? '',
        targetPos?.x ?? '',
        targetPos?.y ?? '',
        targetPos?.z ?? '',
        d.targetX ?? '',
        d.targetY ?? '',
        d.gazeX ?? '',
        d.gazeY ?? '',
        d.mouseX ?? '',
        d.mouseY ?? '',
        camRot?.x ?? '',
        camRot?.y ?? '',
        camRot?.z ?? '',
        playerPos?.x ?? '',
        playerPos?.y ?? '',
        playerPos?.z ?? '',
        d.hitRegistered
      ].join(',');
    }).join('\n');

    const csvContent = `${metaData}${header}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fps_training_data_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [validationError]);

  // Clear data for new session
  const clearData = useCallback(() => {
    collectedData.current = [];
    gazeSampleCount.current = 0;
  }, []);

  return {
    recordTargetHit,
    getData,
    exportData,
    clearData,
    dataCount: collectedData.current.length,
    gazeSampleCount: gazeSampleCount.current,
    hasGazeSamples: gazeSampleCount.current > 0,
  };
};
