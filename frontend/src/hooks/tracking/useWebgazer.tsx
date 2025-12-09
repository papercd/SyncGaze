// frontend/src/hooks/tracking/useWebgazer.tsx
// UPDATED: Added stopSession() and pauseSession() methods for proper cleanup

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { RECALIBRATION_THRESHOLD } from '../../features/tracker/calibration/constants';
import {
  GameState,
  LiveGaze,
  QualitySetting,
} from '../../features/tracker/calibration/types';

interface WebgazerContextValue {
  gameState: GameState;
  isReady: boolean;
  liveGaze: LiveGaze;
  validationError: number | null;
  gazeStability: number | null;
  calStage3SuccessRate: number | null;
  isValidationSuccessful: boolean;
  validationSequence: number;
  quality: QualitySetting;
  isFaceDetected: boolean;
  startSession: () => void;
  stopSession: () => void;  // NEW: Stop WebGazer completely
  pauseSession: () => void; // NEW: Pause WebGazer (can be resumed)
  setQuality: (quality: QualitySetting) => void;
  handleCalibrationComplete: () => void;
  handleWebcamCheckComplete: () => void;
  startValidation: () => void;
  handleRecalibrate: () => void;
  handleCalStage3Complete: (successRate: number) => void;
}

const USE_KALMAN_FILTER = true;
const CAMERA_SETTINGS: Record<QualitySetting, { width: number; height: number; frameRate: number }> = {
  low: { width: 640, height: 480, frameRate: 30 },
  medium: { width: 1280, height: 720, frameRate: 60 },
  high: { width: 1920, height: 1080, frameRate: 60 },
};

const WebgazerContext = createContext<WebgazerContextValue | undefined>(undefined);

export const WebgazerProvider = ({ children }: { children: ReactNode }) => {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [isReady, setIsReady] = useState(false);
  const [liveGaze, setLiveGaze] = useState<LiveGaze>({ x: null, y: null });
  const [validationError, setValidationError] = useState<number | null>(null);
  const [gazeStability, setGazeStability] = useState<number | null>(null);
  const [calStage3SuccessRate, setCalStage3SuccessRate] = useState<number | null>(null);
  const [isValidationSuccessful, setIsValidationSuccessful] = useState(false);
  const [validationSequence, setValidationSequence] = useState(0);
  const [quality, setQuality] = useState<QualitySetting>('high');
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  
  const updateQuality = useCallback((nextQuality: QualitySetting) => {
    setQuality(nextQuality);
  }, []);

  const validationGazePoints = useRef<{ x: number; y: number }[]>([]);
  const hasWebgazerStarted = useRef(false);

  // Keep the WebGazer preview aspect ratio in sync with the actual camera feed (helps on QHD screens)
  const adjustPreviewSize = useCallback(() => {
    const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
    if (!videoEl) {
      return false;
    }

    const stream = videoEl.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    const settings = track?.getSettings();
    const intrinsicWidth = settings?.width ?? videoEl.videoWidth;
    const intrinsicHeight = settings?.height ?? videoEl.videoHeight;

    if (!intrinsicWidth || !intrinsicHeight) {
      return false;
    }

    const aspectRatio = intrinsicWidth / intrinsicHeight;
    const baseHeight = 240; // default WebGazer preview height (preserves vertical space on high-res screens)

    // Prefer keeping height generous to avoid a squashed preview when the camera is 16:9
    const targetHeight = baseHeight;
    const targetWidth = Math.round(targetHeight * aspectRatio);

    if (typeof window.webgazer?.setVideoViewerSize === 'function') {
      window.webgazer.setVideoViewerSize(targetWidth, targetHeight);
    } else {
      const container = document.getElementById('webgazerVideoContainer');
      const faceOverlay = document.getElementById('webgazerFaceOverlay');
      const faceFeedbackBox = document.getElementById('webgazerFaceFeedbackBox');
      [videoEl, container, faceOverlay, faceFeedbackBox].forEach(el => {
        if (!el) return;
        (el as HTMLElement).style.width = `${targetWidth}px`;
        (el as HTMLElement).style.height = `${targetHeight}px`;
      });
    }

    return true;
  }, []);

  const safelyEndWebgazer = useCallback(() => {
    if (!window.webgazer || !hasWebgazerStarted.current) {
      return;
    }
    try {
      console.log('🛑 Stopping WebGazer');
      // Stop the underlying camera stream first (without removing overlay elements)
      let tracksStopped = false;
      try {
        const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
        const stream = videoEl?.srcObject as MediaStream | null;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          tracksStopped = true;
        }
      } catch (error) {
        console.warn('Failed to stop WebGazer media tracks', error);
      }

      // Fallback to library helper only if tracks were not stopped (stopVideo removes overlays)
      if (!tracksStopped) {
        try {
          if (typeof window.webgazer.stopVideo === 'function') {
            window.webgazer.stopVideo();
          }
        } catch (error) {
          console.warn('Failed to stop WebGazer video via stopVideo()', error);
        }
      }

      window.webgazer.end();
    } catch (error) {
      console.error('Failed to stop WebGazer', error);
    } finally {
      hasWebgazerStarted.current = false;
    }
  }, []);

  const safelyPauseWebgazer = useCallback(() => {
    if (!window.webgazer || !hasWebgazerStarted.current) {
      return;
    }
    try {
      console.log('⏸️ Pausing WebGazer');
      window.webgazer.pause();
      window.webgazer.clearGazeListener();
    } catch (error) {
      console.error('Failed to pause WebGazer', error);
    }
  }, []);

  // Load WebGazer script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/webgazer.js';
    script.async = true;
    script.onload = () => setIsReady(true);
    script.onerror = () => {
      console.error('Failed to load WebGazer script');
      setIsReady(false);
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      safelyEndWebgazer();
    };
  }, [safelyEndWebgazer]);

  // Show/hide prediction points based on game state
  useEffect(() => {
    if (!isReady || !window.webgazer) {
      return;
    }
    const shouldShow = gameState === 'validating' || gameState === 'calibrating';
    window.webgazer.showPredictionPoints(shouldShow);
  }, [gameState, isReady]);

  // Face detection for webcam check
  useEffect(() => {
    if (gameState !== 'webcamCheck' || !window.webgazer) {
      return;
    }
    setIsFaceDetected(false);
    const detectionListener = (data: { x: number; y: number } | null) => {
      if (data?.x != null && data?.y != null) {
        setIsFaceDetected(true);
        window.webgazer?.clearGazeListener();
      }
    };
    window.webgazer.clearGazeListener();
    window.webgazer.setGazeListener(detectionListener);
    return () => {
      window.webgazer?.clearGazeListener();
    };
  }, [gameState]);

  // Start WebGazer session
  const startSession = useCallback(() => {
    if (!isReady || !window.webgazer) {
      return;
    }
    console.log('▶️ Starting WebGazer session');
    setValidationError(null);
    setGazeStability(null);
    setCalStage3SuccessRate(null);
    setIsValidationSuccessful(false);
    validationGazePoints.current = [];

    window.webgazer.setTracker('TFFacemesh');
    window.webgazer.setRegression('ridge');
    if (window.webgazer.params) {
      window.webgazer.params.checkClick = false;
      window.webgazer.params.checkMove = false;
    }
    window.webgazer.begin();
    hasWebgazerStarted.current = true;
    window.webgazer.applyKalmanFilter(USE_KALMAN_FILTER);

    if (window.webgazer.setCameraConstraints) {
      const settings = CAMERA_SETTINGS[quality];
      window.webgazer.setCameraConstraints({
        video: {
          width: { ideal: settings.width },
          height: { ideal: settings.height },
          frameRate: { ideal: settings.frameRate },
        },
      });
    }

    setGameState('webcamCheck');
  }, [isReady, quality]);

  // NEW: Stop WebGazer session completely
  const stopSession = useCallback(() => {
    console.log('🛑 Stopping WebGazer session');
    safelyEndWebgazer();
    setGameState('idle');
    setLiveGaze({ x: null, y: null });
  }, [safelyEndWebgazer]);

  // NEW: Pause WebGazer session (can be resumed)
  const pauseSession = useCallback(() => {
    console.log('⏸️ Pausing WebGazer session');
    safelyPauseWebgazer();
    setLiveGaze({ x: null, y: null });
  }, [safelyPauseWebgazer]);

  const handleWebcamCheckComplete = useCallback(() => {
    setGameState('calibrating');
  }, []);

  /*
  const handleCalibrationComplete = useCallback(() => {
    setGameState('validating');
  }, []);
  */

  const handleCalibrationComplete = useCallback(() => {
    setGameState('confirmValidation');  // ✅ Show confirmation first
  }, []);

  const handleRecalibrate = useCallback(() => {
    if (window.webgazer) {
      window.webgazer.clearData();
    }
    setValidationError(null);
    setGazeStability(null);
    setIsValidationSuccessful(false);
    setValidationSequence(0);
    setGameState('calibrating');
  }, []);

  const handleCalStage3Complete = useCallback((successRate: number) => {
    setCalStage3SuccessRate(successRate);
  }, []);

  const startValidation = useCallback(() => {
    validationGazePoints.current = [];
    setValidationError(null);
    setGazeStability(null);
    setGameState('validating');
  }, []);

  // Adjust camera preview/overlay aspect ratio once the webcam feed is available
  useEffect(() => {
    if (gameState !== 'webcamCheck') {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const attemptAdjust = () => {
      if (cancelled) return;
      const adjusted = adjustPreviewSize();
      if (adjusted || attempts >= 10) {
        return;
      }
      attempts += 1;
      window.setTimeout(attemptAdjust, 150);
    };

    attemptAdjust();

    return () => {
      cancelled = true;
    };
  }, [gameState, adjustPreviewSize]);

  
  // Live gaze tracking
  useEffect(() => {
    if (!isReady || !window.webgazer) {
      return;
    }
    
    // Update liveGaze during both calibration (Stage 3) AND validation
    if (gameState !== 'validating' && gameState !== 'calibrating') {
      return;
    }

    const gazeListener = (data: { x: number; y: number } | null) => {
      if (data?.x != null && data?.y != null) {
        setLiveGaze({ x: data.x, y: data.y });
      }
    };

    window.webgazer.setGazeListener(gazeListener);
    return () => {
      window.webgazer?.clearGazeListener();
    };
  }, [gameState, isReady]);

  // Validation measurement
  useEffect(() => {
    if (gameState !== 'validating' || !window.webgazer) {
      return;
    }

    validationGazePoints.current = [];
    const validationListener = (data: { x: number; y: number } | null) => {
      if (data?.x != null && data?.y != null) {
        validationGazePoints.current.push({ x: data.x, y: data.y });
      }
    };

    window.webgazer.setGazeListener(validationListener);

    const timer = setTimeout(() => {
      window.webgazer?.clearGazeListener();
      if (validationGazePoints.current.length === 0) {
        handleRecalibrate();
        return;
      }

      const avgGaze = validationGazePoints.current.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 }
      );
      avgGaze.x /= validationGazePoints.current.length;
      avgGaze.y /= validationGazePoints.current.length;

      const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const error = Math.sqrt((target.x - avgGaze.x) ** 2 + (target.y - avgGaze.y) ** 2);
      setValidationError(error);

      const sumSqDiffX = validationGazePoints.current.reduce((acc, p) => acc + (p.x - avgGaze.x) ** 2, 0);
      const sumSqDiffY = validationGazePoints.current.reduce((acc, p) => acc + (p.y - avgGaze.y) ** 2, 0);
      const stdDevX = Math.sqrt(sumSqDiffX / validationGazePoints.current.length);
      const stdDevY = Math.sqrt(sumSqDiffY / validationGazePoints.current.length);
      const stability = (stdDevX + stdDevY) / 2;
      setGazeStability(stability);

      if (error <= RECALIBRATION_THRESHOLD) {
        setIsValidationSuccessful(true);
        setValidationSequence(seq => seq + 1);
      } else {
        setIsValidationSuccessful(false);
      }
      
      setGameState('validationResult');
    }, 3000);

    return () => {
      clearTimeout(timer);
      window.webgazer?.clearGazeListener();
    };
  }, [gameState, handleRecalibrate]);

  const value: WebgazerContextValue = {
    gameState,
    isReady,
    liveGaze,
    validationError,
    gazeStability,
    calStage3SuccessRate,
    isValidationSuccessful,
    validationSequence,
    quality,
    isFaceDetected,
    startSession,
    stopSession,      // NEW
    pauseSession,     // NEW
    setQuality: updateQuality,
    handleCalibrationComplete,
    handleWebcamCheckComplete,
    startValidation,
    handleRecalibrate,
    handleCalStage3Complete,
  };

  return <WebgazerContext.Provider value={value}>{children}</WebgazerContext.Provider>;
};

export const useWebgazer = () => {
  const context = useContext(WebgazerContext);
  if (!context) {
    throw new Error('useWebgazer must be used within a WebgazerProvider');
  }
  return context;
};
