// frontend/src/components/CalibrationOverlay.tsx
import React, { useState } from 'react';

interface CalibrationOverlayProps {
  onComplete: () => void;
}

export const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({ onComplete }) => {
  const [currentDotIndex, setCurrentDotIndex] = useState(0);

  // 13-point calibration grid matching tracker-app implementation
  const calibrationDots = [
    { x: '50%', y: '50%', label: 'Center' },
    { x: '50%', y: '10%', label: 'Top-Center' },
    { x: '90%', y: '10%', label: 'Top-Right' },
    { x: '90%', y: '50%', label: 'Middle-Right' },
    { x: '90%', y: '90%', label: 'Bottom-Right' },
    { x: '50%', y: '90%', label: 'Bottom-Center' },
    { x: '10%', y: '90%', label: 'Bottom-Left' },
    { x: '10%', y: '50%', label: 'Middle-Left' },
    { x: '35%', y: '35%', label: 'Inner Top-Left' },
    { x: '65%', y: '35%', label: 'Inner Top-Right' },
    { x: '65%', y: '65%', label: 'Inner Bottom-Right' },
    { x: '35%', y: '65%', label: 'Inner Bottom-Left' },
    { x: '20%', y: '20%', label: 'Top-Left' },
  ];

  const handleDotClick = () => {
    if (currentDotIndex < calibrationDots.length - 1) {
      setCurrentDotIndex(currentDotIndex + 1);
    } else {
      onComplete();
    }
  };

  const currentDot = calibrationDots[currentDotIndex];

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
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        fontSize: '24px',
        textAlign: 'center',
        maxWidth: '800px',
        padding: '0 20px'
      }}>
        <h2 style={{ marginBottom: '10px' }}>Eye Tracking Calibration</h2>
        <p style={{ fontSize: '16px', color: '#aaa' }}>
          Click on the red dot ({currentDotIndex + 1}/{calibrationDots.length})
        </p>
        <p style={{ fontSize: '14px', color: '#888', marginTop: '10px' }}>
          ⚠️ Keep your head still and look at each dot before clicking
        </p>
      </div>

      {/* Calibration Dot */}
      <div
        onClick={handleDotClick}
        style={{
          position: 'absolute',
          left: currentDot.x,
          top: currentDot.y,
          transform: 'translate(-50%, -50%)',
          width: '20px',
          height: '20px',
          backgroundColor: '#ff0000',
          borderRadius: '50%',
          cursor: 'pointer',
          boxShadow: '0 0 20px rgba(255, 0, 0, 0.8)',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
        }}
      />

      {/* Progress Indicator */}
      <div style={{
        position: 'absolute',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px'
      }}>
        {calibrationDots.map((_, idx) => (
          <div
            key={idx}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: idx <= currentDotIndex ? '#4ecdc4' : '#333',
              transition: 'background-color 0.3s'
            }}
          />
        ))}
      </div>
    </div>
  );
};

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