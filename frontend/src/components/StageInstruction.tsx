// frontend/src/components/StageInstruction.tsx

import React from 'react';
import { StageInstructionProps } from '../types/calibration';

/**
 * Instruction screen displayed before each calibration stage
 * Explains what the user needs to do in the upcoming stage
 */
const StageInstruction: React.FC<StageInstructionProps> = ({ stage, onStart }) => {
  // Get stage-specific content
  const getStageContent = () => {
    switch (stage) {
      case 1:
        return {
          title: 'Stage 1: Initial Model Creation',
          description: 'A green dot will move in a circle across the screen. Follow it smoothly with your eyes only - keep your head still and track the dot as naturally as possible.',
          tip: '💡 Tip: This helps the system learn your eye movement patterns.'
        };
      
      case 2:
        return {
          title: 'Stage 2: Precision Calibration',
          description: 'Red dots will appear at various locations on the screen. Click each dot exactly 3 times while looking directly at it.',
          tip: '💡 Tip: Take your time and focus on accuracy rather than speed.'
        };
      
      case 3:
        return {
          title: 'Stage 3: Final Refinement',
          description: 'Another moving green dot will appear. This time, try to keep your gaze (shown as a red prediction point) inside the moving target as much as possible.',
          tip: '💡 Tip: This fine-tunes the calibration for maximum accuracy.'
        };
      
      default:
        return {
          title: 'Calibration',
          description: 'Prepare for calibration.',
          tip: ''
        };
    }
  };

  const content = getStageContent();

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
      color: 'white',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '600px',
        textAlign: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: '40px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        {/* Stage indicator */}
        <div style={{
          fontSize: '14px',
          color: '#aaa',
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '2px'
        }}>
          Calibration ({stage}/3)
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '28px',
          marginBottom: '20px',
          color: '#4ecdc4'
        }}>
          {content.title}
        </h2>

        {/* Description */}
        <p style={{
          fontSize: '18px',
          lineHeight: '1.6',
          marginBottom: '20px',
          color: '#ddd'
        }}>
          {content.description}
        </p>

        {/* Tip */}
        {content.tip && (
          <p style={{
            fontSize: '14px',
            color: '#ffa500',
            marginBottom: '30px',
            padding: '10px',
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 165, 0, 0.3)'
          }}>
            {content.tip}
          </p>
        )}

        {/* Start button */}
        <button
          onClick={onStart}
          style={{
            padding: '15px 50px',
            fontSize: '18px',
            backgroundColor: '#4ecdc4',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(78, 205, 196, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#3db8af';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#4ecdc4';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Start Stage {stage}
        </button>
      </div>

      {/* Progress indicator at bottom */}
      <div style={{
        position: 'absolute',
        bottom: '40px',
        display: 'flex',
        gap: '10px'
      }}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              width: '40px',
              height: '4px',
              backgroundColor: s <= stage ? '#4ecdc4' : '#333',
              borderRadius: '2px',
              transition: 'background-color 0.3s'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default StageInstruction;