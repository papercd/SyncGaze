import { useEffect, useRef, useState } from 'react';
import { CALIBRATION_DOTS } from '../constants';
import { LiveGaze } from '../types';

interface StageInstructionProps {
  stage: number;
  onStart: () => void;
}

const StageInstruction = ({ stage, onStart }: StageInstructionProps) => {
  let title = '';
  let description = '';

  switch (stage) {
    case 2:
      title = '1단계: 정밀 보정';
      description = '화면의 여러 위치에 빨간 점이 나타납니다. 각 점이 나타날 때마다 정확하게 3번씩 클릭해 주세요.';
      break;
    case 3:
      title = '2단계: 최종 미세조정';
      description = '다시 움직이는 녹색 점이 나타납니다. 이번에는 화면에 표시되는 자신의 시선(빨간 점)을 녹색 점 안에 유지하도록 노력해 주세요.';
      break;
    default:
      break;
  }

  return (
    <div className="instruction-box">
      <h2>캘리브레이션 ({stage - 1}/2)</h2>
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="primary-button" onClick={onStart}>
        시작하기
      </button>
    </div>
  );
};

interface CalibrationProps {
  onComplete: () => void;
  liveGaze: LiveGaze;
  onCalStage3Complete: (successRate: number) => void;
}

const Calibration = ({ onComplete, liveGaze, onCalStage3Complete }: CalibrationProps) => {
  const [step, setStep] = useState(2);
  const [dotIndex, setDotIndex] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const [isInstructionVisible, setIsInstructionVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isGazeOnTarget, setIsGazeOnTarget] = useState(false);
  const animationFrameId = useRef<number | null>(null);
  const liveGazeRef = useRef(liveGaze);
  const dotRef = useRef<HTMLDivElement>(null);
  const stage3FrameCount = useRef(0);
  const stage3SuccessFrameCount = useRef(0);

  useEffect(() => {
    liveGazeRef.current = liveGaze;
  }, [liveGaze]);

  useEffect(() => {
    if (isInstructionVisible || step !== 3) {
      return;
    }

    setProgress(0);
    window.webgazer?.showPredictionPoints(true);
    stage3FrameCount.current = 0;
    stage3SuccessFrameCount.current = 0;

    const dot = dotRef.current;
    if (!dot) return;

    const DURATION = 20000;
    const DWELL_RADIUS_PX = 150;
    let startTime: number | undefined;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      const currentProgress = Math.min(elapsedTime / DURATION, 1);
      setProgress(currentProgress);

      const radiusX = window.innerWidth * 0.45;
      const radiusY = window.innerHeight * 0.45;
      const x = window.innerWidth / 2 + radiusX * Math.sin(currentProgress * Math.PI * 4);
      const y = window.innerHeight / 2 + radiusY * Math.cos(currentProgress * Math.PI * 6);

      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;

      stage3FrameCount.current += 1;
      let isOnTarget = false;
      const currentGaze = liveGazeRef.current;
      if (currentGaze.x !== null && currentGaze.y !== null) {
        const distance = Math.sqrt((x - currentGaze.x) ** 2 + (y - currentGaze.y) ** 2);
        if (distance < DWELL_RADIUS_PX) {
          isOnTarget = true;
        }
      }
      setIsGazeOnTarget(isOnTarget);
      if (isOnTarget) {
        console.log('✅ Gaze ON target!'); // Add this
        //stage3SuccessFrameCount.current += 1;
        // ...
      }

      if (isOnTarget) {
        stage3SuccessFrameCount.current += 1;
        const mouseMoveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
        });
        document.dispatchEvent(mouseMoveEvent);
      }

      if (currentProgress < 1) {
        animationFrameId.current = requestAnimationFrame(animate);
      } else {
        if (step === 3) {
          const successRate = stage3FrameCount.current > 0
            ? stage3SuccessFrameCount.current / stage3FrameCount.current
            : 0;
          onCalStage3Complete(successRate);
        }
        setStep(prev => prev + 1);
        setIsInstructionVisible(true);
      }
    };

    animationFrameId.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [step, isInstructionVisible, onCalStage3Complete]);

  useEffect(() => {
    if (step > 3) {
      onComplete();
    }
  }, [step, onComplete]);

  const handleDotClick = () => {
    const CLICKS_PER_DOT = 3;
    const newClickCount = clickCount + 1;
    if (newClickCount < CLICKS_PER_DOT) {
      setClickCount(newClickCount);
      return;
    }

    if (dotIndex < CALIBRATION_DOTS.length - 1) {
      setDotIndex(dotIndex + 1);
      setClickCount(0);
    } else {
      setStep(prev => prev + 1);
      setIsInstructionVisible(true);
    }
  };

  if (isInstructionVisible && step <= 3) {
    return <StageInstruction stage={step} onStart={() => setIsInstructionVisible(false)} />;
  }

  if (step === 2) {
    const currentDot = CALIBRATION_DOTS[dotIndex];
    return (
      <div className="calibration-grid">
        <div
          className="calibration-dot"
          style={{ left: currentDot.x, top: currentDot.y, position: 'absolute', transform: 'translate(-50%, -50%)' }}
          onClick={handleDotClick}
        />
        <div className="calibration-hint">
          <p>각 점을 3회씩 클릭해 주세요. ({dotIndex + 1}/{CALIBRATION_DOTS.length})</p>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="pursuit-container">
        <div className="pursuit-overlay">
          <p className="pursuit-message">
            캘리브레이션 (2/2): 시선(녹색 점)을 움직이는 목표점 안에 유지해주세요.
          </p>
          <div className="progress-bar-container pursuit-progress">
            <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <div
          className={`pursuit-dot ${isGazeOnTarget ? 'on-target' : ''}`}
          ref={dotRef}
          style={{ left: '50%', top: '50%' }}
        />
      </div>
    );
  }

  return null;
};

export default Calibration;
