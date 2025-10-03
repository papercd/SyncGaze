// src/components/GazeTracker/Calibration.tsx

import React, { useState, useEffect, useRef } from 'react';
import { CALIBRATION_DOTS } from './constants';

// 1단계: 추적 응시 컴포넌트
const SmoothPursuit: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const dot = document.getElementById('pursuit-dot');
    if (!dot) return;

    const duration = 12000;
    let startTime: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      const currentProgress = Math.min(elapsedTime / duration, 1);
      setProgress(currentProgress);

      const radius = Math.min(window.innerWidth, window.innerHeight) * 0.4;
      const angle = currentProgress * Math.PI * 4;
      const x = window.innerWidth / 2 + radius * Math.cos(angle);
      const y = window.innerHeight / 2 + radius * Math.sin(angle);

      (dot as HTMLElement).style.left = `${x}px`;
      (dot as HTMLElement).style.top = `${y}px`;
      
      const mouseMoveEvent = new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: x, clientY: y });
      document.dispatchEvent(mouseMoveEvent);

      if (currentProgress < 1) {
        animationFrameId.current = requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };
    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [onComplete]);

  return (
    <div className="pursuit-container">
      <p>캘리브레이션 (1/2): 화면의 녹색 점을 눈으로 따라가세요.</p>
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progress * 100}%` }}></div>
      </div>
      <div id="pursuit-dot" className="pursuit-dot" />
    </div>
  );
};

// 메인 캘리브레이션 컴포넌트
interface CalibrationProps {
  onComplete: () => void;
}

const Calibration: React.FC<CalibrationProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [dotIndex, setDotIndex] = useState(0);

  const handleDotClick = () => {
    if (dotIndex < CALIBRATION_DOTS.length - 1) {
      setDotIndex(dotIndex + 1);
    } else {
      onComplete();
    }
  };

  if (step === 1) {
    return <SmoothPursuit onComplete={() => setStep(2)} />;
  }

  return (
    <div>
      <p>캘리브레이션 (2/2): 화면의 주요 지점을 클릭하여 보정을 완료하세요. ({dotIndex + 1}/{CALIBRATION_DOTS.length})</p>
      <div
        className="calibration-dot"
        style={{ left: CALIBRATION_DOTS[dotIndex].x, top: CALIBRATION_DOTS[dotIndex].y }}
        onClick={handleDotClick}
      />
    </div>
  );
};

export default Calibration;