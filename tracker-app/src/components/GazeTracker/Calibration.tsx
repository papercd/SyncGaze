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

  // 각 점을 몇 번 클릭했는지 세는 상태 추가
  const [clickCount, setClickCount] = useState(0);
  const CLICKS_PER_DOT = 3; // 점당 클릭 횟수

  const handleDotClick = () => {
    const newClickCount = clickCount + 1;

    if (newClickCount < CLICKS_PER_DOT) {
      // 아직 클릭 횟수가 남았다면 clickCount만 증가
      setClickCount(newClickCount);
    } else {
      // 클릭 횟수를 다 채웠다면 다음 점으로 이동
      if (dotIndex < CALIBRATION_DOTS.length - 1) {
        setDotIndex(dotIndex + 1);
        setClickCount(0); // 클릭 횟수 초기화
      } else {
        // 모든 점의 캘리브레이션이 끝나면 완료 처리
        onComplete();
      }
    }
  };

  if (step === 1) {
    return <SmoothPursuit onComplete={() => setStep(2)} />;
  }

  return (
    <div>
      <p>캘리브레이션 (2/2): 화면의 주요 지점을 클릭하여 보정을 완료하세요. ({dotIndex + 1}/{CALIBRATION_DOTS.length})
        <br />
        <strong>({clickCount + 1}/{CLICKS_PER_DOT} 번째 클릭)</strong>
      </p>
      <div
        className="calibration-dot"
        style={{ left: CALIBRATION_DOTS[dotIndex].x, top: CALIBRATION_DOTS[dotIndex].y }}
        onClick={handleDotClick}
      />
    </div>
  );
};

export default Calibration;