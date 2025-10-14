// frontend/src/components/CalibrationOverlay.tsx

import React, { useState, useEffect, useRef } from 'react';
import StageInstruction from './StageInstruction';
import { CalibrationProps, CalibrationStage } from '../types/calibration';
import { 
  CALIBRATION_DOTS, 
  CLICKS_PER_DOT, 
  STAGE_1_DURATION, 
  STAGE_3_DURATION,
  DWELL_RADIUS_PX 
} from '../constants/calibration';

/**
 * 3-Stage Calibration Component
 * Stage 1: Smooth pursuit (circular motion)
 * Stage 2: Point calibration (13-point grid)
 * Stage 3: Final refinement (Lissajous curve)
 */
// ============================================
// VALIDATION OVERLAY COMPONENT
// ============================================

interface ValidationOverlayProps {
  validationError: number | null;
  onStartTraining: () => void;
  onRecalibrate: () => void;
}

export const ValidationOverlay: React.FC<ValidationOverlayProps> = ({
  validationError,
  onStartTraining,
  onRecalibrate
}) => {
  if (validationError === null) {
    // Measuring
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '30px',
          height: '30px',
          backgroundColor: '#007bff',
          borderRadius: '50%',
          boxShadow: '0 0 30px rgba(0, 123, 255, 0.8)',
          marginBottom: '40px'
        }} />
        <p style={{ color: 'white', fontSize: '20px', textAlign: 'center' }}>
          Measuring accuracy...<br />
          <span style={{ fontSize: '16px', color: '#aaa' }}>
            Keep looking at the blue dot for 3 seconds
          </span>
        </p>
      </div>
    );
  }

  // Show results
  const errorIsGood = validationError >= 0 && validationError < 100;
  const errorIsOk = validationError >= 100 && validationError < 150;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '30px'
    }}>
      <div style={{
        textAlign: 'center',
        color: 'white'
      }}>
        <h2 style={{ marginBottom: '20px' }}>Calibration Complete</h2>
        <p style={{ fontSize: '18px', color: '#aaa', marginBottom: '10px' }}>
          Average accuracy error:
        </p>
        <p style={{
          fontSize: '48px',
          fontWeight: 'bold',
          color: errorIsGood ? '#4ecdc4' : errorIsOk ? '#ffa500' : '#ff6b6b',
          marginBottom: '10px'
        }}>
          {validationError.toFixed(0)} px
        </p>
        <p style={{ fontSize: '14px', color: '#888' }}>
          {errorIsGood && '✅ Excellent calibration!'}
          {errorIsOk && '⚠️ Calibration OK, but recalibration recommended for better accuracy'}
          {!errorIsGood && !errorIsOk && '❌ Poor calibration - please recalibrate'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <button
          onClick={onStartTraining}
          style={{
            padding: '15px 40px',
            fontSize: '18px',
            backgroundColor: '#4ecdc4',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3db8af'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4ecdc4'}
        >
          Start Training
        </button>
        <button
          onClick={onRecalibrate}
          style={{
            padding: '15px 40px',
            fontSize: '18px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#555'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#666'}
        >
          Recalibrate
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN CALIBRATION OVERLAY COMPONENT
// ============================================

export const CalibrationOverlay: React.FC<CalibrationProps> = ({ onComplete, liveGaze }) => {
  // Stage management
  const [stage, setStage] = useState<CalibrationStage>(1);
  const [showInstruction, setShowInstruction] = useState(true);

  // Stage 2 state (point calibration)
  const [dotIndex, setDotIndex] = useState(0);
  const [clickCount, setClickCount] = useState(0);

  // Stage 1 & 3 state (smooth pursuit)
  const [progress, setProgress] = useState(0);
  const [isGazeOnTarget, setIsGazeOnTarget] = useState(false);
  
  // Refs
  const animationFrameId = useRef<number | null>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const liveGazeRef = useRef(liveGaze);

  // Update live gaze ref whenever it changes
  useEffect(() => {
    liveGazeRef.current = liveGaze;
  }, [liveGaze]);

  // Handle completion of all stages
  useEffect(() => {
    if (stage > 3) {
      onComplete();
    }
  }, [stage, onComplete]);

  // ============================================
  // STAGE 1 & 3: SMOOTH PURSUIT ANIMATION
  // ============================================
  useEffect(() => {
    if (showInstruction || (stage !== 1 && stage !== 3)) return;

    setProgress(0);
    
    // Show prediction points only in Stage 3
    if (window.webgazer) {
      window.webgazer.showPredictionPoints(stage === 3);
    }

    const dot = dotRef.current;
    if (!dot) return;

    const DURATION = stage === 1 ? STAGE_1_DURATION : STAGE_3_DURATION;
    let startTime: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      const currentProgress = Math.min(elapsedTime / DURATION, 1);
      setProgress(currentProgress);

      // Calculate path
      // Stage 1: Circular motion
      // Stage 3: Lissajous curve (more complex pattern)
      const radiusX = window.innerWidth * (stage === 1 ? 0.4 : 0.45);
      const radiusY = window.innerHeight * (stage === 1 ? 0.4 : 0.45);
      const x = window.innerWidth / 2 + radiusX * Math.sin(currentProgress * Math.PI * 4);
      const y = window.innerHeight / 2 + radiusY * Math.cos(currentProgress * Math.PI * (stage === 1 ? 4 : 6));

      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;

      // Stage 3: Data refinement logic
      if (stage === 3) {
        let isOnTarget = false;
        const currentGaze = liveGazeRef.current;
        
        if (currentGaze.x !== null && currentGaze.y !== null) {
          const distance = Math.sqrt(
            Math.pow(x - currentGaze.x, 2) + Math.pow(y - currentGaze.y, 2)
          );
          if (distance < DWELL_RADIUS_PX) {
            isOnTarget = true;
          }
        }
        
        setIsGazeOnTarget(isOnTarget);

        // Only collect data when gaze is on target
        if (isOnTarget) {
          const mouseMoveEvent = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
          });
          document.dispatchEvent(mouseMoveEvent);
        }
      } else {
        // Stage 1: Always collect data
        const mouseMoveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });
        document.dispatchEvent(mouseMoveEvent);
      }

      // Continue animation or move to next stage
      if (currentProgress < 1) {
        animationFrameId.current = requestAnimationFrame(animate);
      } else {
        // Stage complete - show next instruction
        setStage((prev) => (prev + 1) as CalibrationStage);
        setShowInstruction(true);
      }
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [stage, showInstruction]);

  // ============================================
  // STAGE 2: POINT CALIBRATION HANDLERS
  // ============================================
  const handleDotClick = () => {
    const newClickCount = clickCount + 1;

    if (newClickCount < CLICKS_PER_DOT) {
      // More clicks needed for this dot
      setClickCount(newClickCount);
    } else {
      // Move to next dot or complete stage
      if (dotIndex < CALIBRATION_DOTS.length - 1) {
        setDotIndex(dotIndex + 1);
        setClickCount(0);
      } else {
        // Stage 2 complete - show next instruction
        setStage(3);
        setShowInstruction(true);
        setDotIndex(0);
        setClickCount(0);
      }
    }
  };

  // ============================================
  // RENDER
  // ============================================

  // Show instruction screen
  if (showInstruction && stage <= 3) {
    return (
      <StageInstruction
        stage={stage}
        onStart={() => setShowInstruction(false)}
      />
    );
  }

  // Render stage-specific UI
  switch (stage) {
    // ============================================
    // STAGE 1 & 3: SMOOTH PURSUIT
    // ============================================
    case 1:
    case 3: {
      const message = stage === 1
        ? 'Calibration (1/3): Follow the green dot smoothly with your eyes'
        : 'Calibration (3/3): Keep your gaze (red dot) inside the moving target';

      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Instructions */}
          <p style={{
            position: 'absolute',
            top: '40px',
            color: 'white',
            fontSize: '20px',
            textAlign: 'center',
            maxWidth: '800px',
            padding: '0 20px'
          }}>
            {message}
          </p>

          {/* Progress bar */}
          <div style={{
            position: 'absolute',
            top: '100px',
            width: '80%',
            maxWidth: '400px',
            height: '20px',
            backgroundColor: '#333',
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${progress * 100}%`,
              backgroundColor: '#28a745',
              borderRadius: '10px',
              transition: 'width 0.1s linear'
            }} />
          </div>

          {/* Moving dot */}
          <div
            ref={dotRef}
            style={{
              position: 'absolute',
              width: '30px',
              height: '30px',
              backgroundColor: stage === 3 && isGazeOnTarget ? '#ffc107' : '#28a745',
              borderRadius: '50%',
              boxShadow: `0 0 ${stage === 3 && isGazeOnTarget ? '25px rgba(255, 193, 7, 0.9)' : '15px rgba(40, 167, 69, 0.7)'}`,
              transform: 'translate(-50%, -50%)',
              transition: stage === 3 ? 'background-color 0.2s, box-shadow 0.2s, transform 0.2s' : 'none',
              ...(stage === 3 && isGazeOnTarget && { transform: 'translate(-50%, -50%) scale(1.2)' })
            }}
          />
        </div>
      );
    }

    // ============================================
    // STAGE 2: POINT CALIBRATION
    // ============================================
    case 2: {
      const currentDot = CALIBRATION_DOTS[dotIndex];

      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          zIndex: 1000
        }}>
          {/* Instructions */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            fontSize: '20px',
            textAlign: 'center'
          }}>
            <p style={{ marginBottom: '10px' }}>
              Calibration (2/3): Click on the red dot
            </p>
            <p style={{ fontSize: '16px', color: '#aaa' }}>
              Point {dotIndex + 1}/{CALIBRATION_DOTS.length} • Click {clickCount + 1}/{CLICKS_PER_DOT}
            </p>
          </div>

          {/* Calibration dot */}
          <div
            onClick={handleDotClick}
            style={{
              position: 'absolute',
              left: currentDot.x,
              top: currentDot.y,
              width: '20px',
              height: '20px',
              backgroundColor: 'red',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 0 20px rgba(255, 0, 0, 0.8)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
            }}
          />
        </div>
      );
    }

    default:
      return null;
  }
};