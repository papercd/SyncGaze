// frontend/src/components/TrackingIntegration.tsx
import { useEffect, useRef, useState } from 'react';

// Data structure for collected tracking data
export interface TrackingDataRecord {
  timestamp: number;
  phase: 'training' | 'calibration' | 'validation';
  targetId: string | null;
  targetPosition: { x: number; y: number; z: number } | null;
  gazeX: number | null;
  gazeY: number | null;
  mouseX: number | null;
  mouseY: number | null;
  cameraRotation: { x: number; y: number; z: number } | null;
  playerPosition: { x: number; y: number; z: number } | null;
  hitRegistered: boolean;
}

interface UseTrackingSystemProps {
  isActive: boolean;
  phase: 'idle' | 'calibration' | 'validation' | 'training' | 'complete';
}

export const useTrackingSystem = ({ isActive, phase }: UseTrackingSystemProps) => {
  const [isWebGazerReady, setIsWebGazerReady] = useState(false);
  const [validationError, setValidationError] = useState<number | null>(null);
  const collectedData = useRef<TrackingDataRecord[]>([]);
  const validationGazePoints = useRef<{ x: number; y: number }[]>([]);

  // Load WebGazer script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
    script.async = true;
    script.onload = () => {
      if (window.webgazer) {
        window.webgazer.showPredictionPoints(false); // Hide prediction points during gameplay
        setIsWebGazerReady(true);
      }
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      if (window.webgazer) {
        window.webgazer.end();
      }
    };
  }, []);

  // Start WebGazer when calibration begins
  useEffect(() => {
    if (phase === 'calibration' && isWebGazerReady && window.webgazer) {
      try {
        window.webgazer.begin();
      } catch (error) {
        console.error('Failed to start WebGazer:', error);
      }
    }
  }, [phase, isWebGazerReady]);

  // Validation measurement
  useEffect(() => {
    if (phase !== 'validation' || !window.webgazer) return;

    validationGazePoints.current = [];
    setValidationError(null);

    const validationListener = (data: any) => {
      if (data) {
        validationGazePoints.current.push({ x: data.x, y: data.y });
      }
    };

    try {
      window.webgazer.setGazeListener(validationListener);
    } catch (error) {
      console.error('Failed to set gaze listener:', error);
      return;
    }

    const timer = setTimeout(() => {
      if (!window.webgazer) return;
      
      try {
        window.webgazer.clearGazeListener();
      } catch (error) {
        console.error('Failed to clear gaze listener:', error);
      }

      if (validationGazePoints.current.length === 0) {
        setValidationError(-1); // Signal for recalibration needed
        return;
      }

      // Calculate average gaze position
      const avgGaze = validationGazePoints.current.reduce(
        (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
        { x: 0, y: 0 }
      );
      avgGaze.x /= validationGazePoints.current.length;
      avgGaze.y /= validationGazePoints.current.length;

      // Target is screen center
      const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      // Calculate Euclidean distance error
      const error = Math.sqrt(
        Math.pow(target.x - avgGaze.x, 2) + Math.pow(target.y - avgGaze.y, 2)
      );
      setValidationError(error);
    }, 3000);

    return () => clearTimeout(timer);
  }, [phase]);

  // Data collection during training
  useEffect(() => {
    if (phase !== 'training' || !isActive || !window.webgazer) return;

    // Gaze data listener
    const gazeListener = (data: any) => {
      if (data) {
        collectedData.current.push({
          timestamp: performance.now(),
          phase: 'training',
          targetId: null,
          targetPosition: null,
          gazeX: data.x,
          gazeY: data.y,
          mouseX: null,
          mouseY: null,
          cameraRotation: null,
          playerPosition: null,
          hitRegistered: false,
        });
      }
    };

    // Mouse movement listener
    const mouseMoveListener = (event: MouseEvent) => {
      collectedData.current.push({
        timestamp: performance.now(),
        phase: 'training',
        targetId: null,
        targetPosition: null,
        gazeX: null,
        gazeY: null,
        mouseX: event.clientX,
        mouseY: event.clientY,
        cameraRotation: null,
        playerPosition: null,
        hitRegistered: false,
      });
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
  }, [phase, isActive]);

  // Record target hit
  const recordTargetHit = (
    targetId: string,
    targetPosition: { x: number; y: number; z: number },
    cameraRotation: { x: number; y: number; z: number },
    playerPosition: { x: number; y: number; z: number }
  ) => {
    collectedData.current.push({
      timestamp: performance.now(),
      phase: 'training',
      targetId,
      targetPosition,
      gazeX: null,
      gazeY: null,
      mouseX: null,
      mouseY: null,
      cameraRotation,
      playerPosition,
      hitRegistered: true,
    });
  };

  // Export data as CSV
  const exportData = () => {
    const metaData = `# Validation Error (pixels): ${validationError !== null ? validationError.toFixed(2) : 'N/A'}\n`;
    const header = 'timestamp,phase,targetId,targetX,targetY,targetZ,gazeX,gazeY,mouseX,mouseY,cameraRotX,cameraRotY,cameraRotZ,playerX,playerY,playerZ,hitRegistered';
    
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
  };

  // Clear data for new session
  const clearData = () => {
    collectedData.current = [];
    setValidationError(null);
  };

  // Recalibrate
  const recalibrate = () => {
    if (window.webgazer) {
      try {
        window.webgazer.clearData();
      } catch (error) {
        console.error('Failed to clear WebGazer data:', error);
      }
    }
    clearData();
  };

  return {
    isWebGazerReady,
    validationError,
    recordTargetHit,
    exportData,
    clearData,
    recalibrate,
    dataCount: collectedData.current.length,
  };
};