// src/components/GazeTracker/Calibration.tsx

import React, { useState, useEffect, useRef } from 'react';
import { CALIBRATION_DOTS } from './constants';

// 각 단계별 안내 페이지를 위한 내부 컴포넌트
const StageInstruction: React.FC<{ stage: number; onStart: () => void }> = ({ stage, onStart }) => {
  let title = '';
  let description = '';

  switch (stage) {
    case 1:
      title = '1단계: 초기 모델 생성';
      description = '화면에 나타나는 녹색 점이 원을 그리며 움직입니다. 눈으로 점을 최대한 부드럽게 따라가 주세요.';
      break;
    case 2:
      title = '2단계: 정밀 보정';
      description = '화면의 여러 위치에 빨간 점이 나타납니다. 각 점이 나타날 때마다 정확하게 3번씩 클릭해 주세요.';
      break;
    case 3:
      title = '3단계: 최종 미세조정';
      description = '다시 움직이는 녹색 점이 나타납니다. 이번에는 화면에 표시되는 자신의 시선(빨간 점)을 녹색 점 안에 유지하도록 노력해 주세요.';
      break;
  }

  return (
    <div className="instruction-box">
      <h2>캘리브레이션 ({stage}/3)</h2>
      <h3>{title}</h3>
      <p>{description}</p>
      <button onClick={onStart}>시작하기</button>
    </div>
  );
};

// 메인 캘리브레이션 컴포넌트
interface CalibrationProps {
  onComplete: () => void;
  // 3단계를 위해 liveGaze prop이 필요합니다.
  liveGaze: { x: number | null; y: number | null };
}

const Calibration: React.FC<CalibrationProps> = ({ onComplete, liveGaze }) => {
  // --- 기존 상태 유지 및 확장 ---
  // step 상태를 1, 2, 3단계로 확장
  const [step, setStep] = useState(1);
  const [dotIndex, setDotIndex] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const CLICKS_PER_DOT = 3; // 점당 클릭 횟수

  // '안내'와 '실행' 모드를 전환하는 상태 추가 (기본값: true)
  const [isInstructionVisible, setIsInstructionVisible] = useState(true);

  // --- 1단계와 3단계(Smooth Pursuit)에 필요한 상태 추가 ---
  const [progress, setProgress] = useState(0);
  const [isGazeOnTarget, setIsGazeOnTarget] = useState(false);
  const animationFrameId = useRef<number | null>(null);

   // liveGaze prop을 저장할 ref 생성
  const liveGazeRef = useRef(liveGaze);

  const dotRef = useRef<HTMLDivElement>(null);

  // liveGaze prop이 바뀔 때마다 ref의 값을 업데이트하는 useEffect 추가
  useEffect(() => {
    liveGazeRef.current = liveGaze;
  }, [liveGaze]);

  // --- 1단계와 3단계 로직 통합 ---
  // 기존 SmoothPursuit 컴포넌트의 로직을 이곳으로 통합
  useEffect(() => {
    // 1단계나 3단계가 아니면 useEffect 로직을 실행하지 않음
    if (isInstructionVisible || (step !== 1 && step !== 3)) return;

    // 단계 시작 시 progress 초기화 및 예측 점 표시 설정
    setProgress(0);
    window.webgazer.showPredictionPoints(step === 3); // 3단계에서만 예측 점 표시

    const dot = dotRef.current;
    if (!dot) return;

    const DURATION = step === 1 ? 18000 : 20000; // 1단계는 18초, 3단계는 20초 (시간을 늘리면 점의 이동속도가 느려짐)
    const DWELL_RADIUS_PX = 150;
    let startTime: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      const currentProgress = Math.min(elapsedTime / DURATION, 1);
      setProgress(currentProgress);

      // 경로 계산 (1단계는 원, 3단계는 리사주 곡선)
      const radiusX = window.innerWidth * (step === 1 ? 0.4 : 0.45);
      const radiusY = window.innerHeight * (step === 1 ? 0.4 : 0.45);
      const x = window.innerWidth / 2 + radiusX * Math.sin(currentProgress * Math.PI * 4);
      const y = window.innerHeight / 2 + radiusY * Math.cos(currentProgress * Math.PI * (step === 1 ? 4 : 6));
      
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;

      // 3단계일 경우에만 데이터 정제 로직 실행s
      if (step === 3) {
        let isOnTarget = false;
        const currentGaze = liveGazeRef.current;
        if (currentGaze.x !== null && currentGaze.y !== null) {
          const distance = Math.sqrt(Math.pow(x - currentGaze.x, 2) + Math.pow(y - currentGaze.y, 2));
          if (distance < DWELL_RADIUS_PX) isOnTarget = true;
        }
        setIsGazeOnTarget(isOnTarget);

        if (isOnTarget) {
          const mouseMoveEvent = new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: x, clientY: y });
          document.dispatchEvent(mouseMoveEvent);
        }
      } else { // 1단계는 무조건 데이터 수집
        const mouseMoveEvent = new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: x, clientY: y });
        document.dispatchEvent(mouseMoveEvent);
      }
      
      if (currentProgress < 1) {
        animationFrameId.current = requestAnimationFrame(animate);
      } else {
        // 단계가 끝나면 다음 단계 '안내' 페이지를 보여줌
        setStep(prev => prev + 1);
        setIsInstructionVisible(true);
      }
    };

    animationFrameId.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [step, onComplete, isInstructionVisible]); // onComplete 유지????

  // --- 기존 2단계 로직 유지 ---
  const handleDotClick = () => {
    const newClickCount = clickCount + 1;
    if (newClickCount < CLICKS_PER_DOT) {
      setClickCount(newClickCount);
    } else {
      if (dotIndex < CALIBRATION_DOTS.length - 1) {
        setDotIndex(dotIndex + 1);
        setClickCount(0);
      } else {
        // 2단계가 끝나면 다음 단계 '안내' 페이지를 보여줌
        setStep(prev => prev + 1);
        setIsInstructionVisible(true);
      }
    }
  };

  // 3단계가 끝나면 전체 완료 처리
  useEffect(() => {
    if (step > 3) {
      onComplete();
    }
  }, [step, onComplete]);

  // --- 렌더링 로직 ---
  if (isInstructionVisible && step <= 3) {
    return <StageInstruction stage={step} onStart={() => setIsInstructionVisible(false)} />;
  }

  // 각 단계별 실행 UI 렌더링
  switch (step) {
    case 1:
    case 3:
      const message = step === 1 
        ? "캘리브레이션 (1/3): 화면의 녹색 점을 눈으로 따라가세요."
        : "캘리브레이션 (3/3): 시선(빨간 점)을 움직이는 목표점 안에 유지해주세요.";
      return (
        <div className="pursuit-container">
          <p>{message}</p>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress * 100}%` }}></div>
          </div>
          <div id="pursuit-dot" ref={dotRef} className={`pursuit-dot ${isGazeOnTarget && step === 3 ? 'on-target' : ''}`} />
        </div>
      );
    case 2:
      return (
        <div>
          <p>
            캘리브레이션 (2/3): 화면의 점을 클릭하세요. ({dotIndex + 1}/{CALIBRATION_DOTS.length})
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
    default:
      return null;
  }
};

export default Calibration;