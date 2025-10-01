// src/components/GazeTracker/index.tsx

import React, { useState, useEffect, useRef } from 'react';
import './GazeTracker.css';

// 게임(과제)의 진행 상태를 나타내는 타입
// VALIDATION: 'validating' 상태 추가
// NEW: 'confirmValidation' 상태 추가
type GameState = 'idle' | 'calibrating' | 'confirmValidation' | 'validating' | 'task' | 'finished';

// 수집할 데이터의 타입을 정의합니다.
// task 점의 좌표 필드 추가
interface DataRecord {
  timestamp: number;
  taskId: number | null; // 몇 번째 과제(점)인지 기록
  targetX: number | null; // 과제 점의 X 좌표
  targetY: number | null; // 과제 점의 Y 좌표
  gazeX: number | null;
  gazeY: number | null;
  mouseX: number | null;
  mouseY: number | null;
}

// NEW: 최종 결과 화면에 보여줄 단일 과제의 요약 데이터 타입
interface TaskResult {
  taskId: number;
  timeTaken: number; // 소요 시간 (ms)
  gazeToTargetDistance: number | null; // 시선-타겟 거리 (px)
  gazeToClickDistance: number | null; // 시선-클릭 거리 (px)
}

// 랜덤 점의 좌표 타입
interface DotPosition {
  x: number;
  y: number;
}

// 카메라 미리보기 영역 + 여유 공간
const FORBIDDEN_ZONE = { width: 340, height: 260 };

const GazeTracker: React.FC = () => {
  // --- 상태 관리 (State Management) ---
  const [gameState, setGameState] = useState<GameState>('idle');
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const collectedData = useRef<DataRecord[]>([]);

  // 캘리브레이션 관련 상태
  // NEW: 2단계 캘리브레이션을 위한 상태 추가 (1: 추적 응시, 2: 지점 클릭)
  const [calibrationStep, setCalibrationStep] = useState(1);
  const [calibDotIndex, setCalibDotIndex] = useState(0);
  // ORIGINAL: 점 개수를 13개로 늘리고, 화면 가장자리를 더 많이 포함하도록 좌표 재설계
  // CHANGED: 2단계에서 사용할 점 개수를 9개로 수정
  const calibrationDots = [
    { x: '50%', y: '50%' }, // 1. Center
    { x: '50%', y: '15%' }, // 2. Top-Mid
    { x: '85%', y: '15%' }, // 3. Top-Right
    { x: '15%', y: '85%' }, // 4. Bottom-Left
    { x: '50%', y: '85%' }, // 5. Bottom-Mid
    { x: '85%', y: '85%' }, // 6. Bottom-Right
    { x: '15%', y: '50%' }, // 7. Mid-Left
    { x: '85%', y: '50%' }, // 8. Mid-Right
    { x: '35%', y: '35%' }, // 9. Inner Top-Left (safe)
  ];

  // VALIDATION: 정확도 검증 관련 상태 추가
  const [validationError, setValidationError] = useState<number | null>(null);
  const validationGazePoints = useRef<{ x: number; y: number }[]>([]);

  // 새로운 과제(Task) 관련 상태
  const TOTAL_TASKS = 9; // 측정 점 개수
  const [taskCount, setTaskCount] = useState(0);
  const [currentDot, setCurrentDot] = useState<DotPosition | null>(null);

  // NEW: 과제별 요약 결과를 저장할 상태
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  // NEW: 각 과제의 시작 시간을 기록하기 위한 ref
  const taskStartTime = useRef<number | null>(null);


  // --- useEffect 훅 (Side Effects) ---

  // WebGazer.js 스크립트를 동적으로 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
    script.async = true;
    script.onload = () => {
      setIsScriptLoaded(true);
      // 
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
      if (window.webgazer) window.webgazer.end();
    };
  }, []);
  
  // NEW: gameState에 따라 시선 예측 점(빨간 점)의 표시 여부를 제어
  useEffect(() => {
    if (!isScriptLoaded || !window.webgazer) return;

    // 'validating'(정확도측정) 또는 'task'(과제) 상태일 때만 빨간 점을 표시
    if (
      // calibrating 상황은 제외
      // gameState === 'calibrating' ||
      gameState === 'validating' || 
      gameState === 'task'
    ) {
      window.webgazer.showPredictionPoints(true);
    } else {
      window.webgazer.showPredictionPoints(false);
    }
  }, [gameState, isScriptLoaded]); // gameState이나 스크립트 로드 상태가 바뀔 때마다 실행
  
  // VALIDATION: 정확도 측정 로직을 위한 useEffect 추가
  useEffect(() => {
    if (gameState !== 'validating') return;

    validationGazePoints.current = []; // 측정 데이터 초기화
    setValidationError(null); // 이전 에러 값 초기화

    // 검증을 위한 시선 데이터 수집 리스너
    const validationListener = (data: any) => {
      if (data) {
        validationGazePoints.current.push({ x: data.x, y: data.y });
      }
    };
    window.webgazer.setGazeListener(validationListener);

    // 3초 후에 정확도 계산 실행
    const timer = setTimeout(() => {
      window.webgazer.clearGazeListener(); // 리스너 정리

      if (validationGazePoints.current.length === 0) {
        alert("시선이 감지되지 않았습니다. 재보정을 진행합니다.");
        handleRecalibrate();
        return;
      }

      // 수집된 시선 좌표의 평균 계산
      const avgGaze = validationGazePoints.current.reduce(
        (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
        { x: 0, y: 0 }
      );
      avgGaze.x /= validationGazePoints.current.length;
      avgGaze.y /= validationGazePoints.current.length;

      // 검증용 타겟의 실제 위치 (화면 정중앙)
      const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      // 유클리드 거리를 이용해 오차 계산
      const error = Math.sqrt(
        Math.pow(target.x - avgGaze.x, 2) + Math.pow(target.y - avgGaze.y, 2)
      );
      setValidationError(error);

    }, 3000); // 3초간 측정

    return () => clearTimeout(timer); // 컴포넌트 언마운트 시 타이머 정리
  }, [gameState]);


  // gameState이 'task'로 변경되거나 taskCount가 증가하면 새로운 랜덤 점을 생성
  useEffect(() => {
    if (gameState === 'task' && taskCount < TOTAL_TASKS) {
      let x, y;
      const padding = 50; // 화면 가장자리 여백

      // 안전한 좌표가 나올 때까지 랜덤 생성을 반복
      do {
        x = Math.floor(Math.random() * (window.innerWidth - padding * 2)) + padding;
        y = Math.floor(Math.random() * (window.innerHeight - padding * 2)) + padding;
      } while (x < FORBIDDEN_ZONE.width && y < FORBIDDEN_ZONE.height);

      setCurrentDot({ x, y });
      // NEW: 새로운 점이 나타난 시간을 기록
      taskStartTime.current = performance.now();
    }
  }, [gameState, taskCount]);

  // 데이터 수집 리스너 등록 및 해제
  useEffect(() => {
    // 과제 수행 중에만 데이터 수집
    if (gameState !== 'task' || !window.webgazer) return;

    const gazeListener = (data: any) => {
      if (data) {
        collectedData.current.push({
          timestamp: performance.now(),
          taskId: taskCount + 1,
          targetX: currentDot?.x ?? null,
          targetY: currentDot?.y ?? null,
          gazeX: data.x, gazeY: data.y,
          mouseX: null, mouseY: null,
        });
      }
    };
    window.webgazer.setGazeListener(gazeListener);

    const mouseMoveListener = (event: MouseEvent) => {
      collectedData.current.push({
        timestamp: performance.now(),
        taskId: taskCount + 1,
        targetX: currentDot?.x ?? null,
        targetY: currentDot?.y ?? null,
        gazeX: null, gazeY: null,
        mouseX: event.clientX, mouseY: event.clientY,
      });
    };
    document.addEventListener('mousemove', mouseMoveListener);

    return () => {
      window.webgazer.clearGazeListener();
      document.removeEventListener('mousemove', mouseMoveListener);
    };
  }, [gameState, taskCount, currentDot]); // gameState, taskCount, currentDot 이 바뀔 때마다 리스너 재설정

  // --- 이벤트 핸들러 (Event Handlers) ---

  const handleStart = () => {
    // NEW: 다시 시작할 때 결과 및 캘리브레이션 단계 초기화
    setTaskResults([]);
    setCalibrationStep(1);
    setCalibDotIndex(0);

    if (!isScriptLoaded) return;
    collectedData.current = [];
    window.webgazer.begin();
    setGameState('calibrating');
  };

  const handleCalibDotClick = () => {
    if (calibDotIndex < calibrationDots.length - 1) {
      setCalibDotIndex(calibDotIndex + 1);
    } else {
      // 캘리브레이션 완료 -> 정확도 측정 시작
      // VALIDATION: 'task' 대신 'validating' 상태로 변경
      // CHANGED: 'validating' 대신 'confirmValidation' 상태로 변경
      setGameState('confirmValidation');
    }
  };

  // VALIDATION: 재보정 핸들러 추가
  const handleRecalibrate = () => {
    // NEW: 캘리브레이션 1단계부터 다시 시작하도록 수정
    setCalibrationStep(1);
    setCalibDotIndex(0);
    setValidationError(null);
    window.webgazer.clearData(); // WebGazer 내부 데이터 초기화
    setGameState('calibrating');
  };

  // CHANGED: handleTaskDotClick 함수를 요약 데이터 계산 로직으로 전면 교체
  const handleTaskDotClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const clickTime = performance.now();
    
    const lastGazeRecord = [...collectedData.current].reverse().find(d => d.gazeX !== null && d.gazeY !== null);
    const lastGazePos = lastGazeRecord ? { x: lastGazeRecord.gazeX, y: lastGazeRecord.gazeY } : null;

    const clickPos = { x: event.clientX, y: event.clientY };
    const targetPos = currentDot;

    const timeTaken = taskStartTime.current ? clickTime - taskStartTime.current : 0;
    
    let gazeToTargetDistance: number | null = null;
    if (lastGazePos && targetPos) {
      gazeToTargetDistance = Math.sqrt(
        Math.pow(targetPos.x - lastGazePos.x!, 2) + Math.pow(targetPos.y - lastGazePos.y!, 2)
      );
    }

    let gazeToClickDistance: number | null = null;
    if (lastGazePos) {
      gazeToClickDistance = Math.sqrt(
        Math.pow(clickPos.x - lastGazePos.x!, 2) + Math.pow(clickPos.y - lastGazePos.y!, 2)
      );
    }
    
    setTaskResults(prevResults => [
      ...prevResults,
      {
        taskId: taskCount + 1,
        timeTaken,
        gazeToTargetDistance,
        gazeToClickDistance,
      }
    ]);

    if (taskCount < TOTAL_TASKS - 1) {
      setTaskCount(taskCount + 1);
    } else {
      setGameState('finished');
      if (window.webgazer) window.webgazer.end();
    }
  };

  const downloadCSV = (data: DataRecord[]) => {
    // CHANGED: CSV 파일에 정확도 결과도 저장하도록 수정
    const metaData = `# Validation Error (pixels): ${validationError ? validationError.toFixed(2) : 'N/A'}\n`;

    // CSV 헤더에 taskId 추가
    const header = 'timestamp,taskId,targetX,targetY,gazeX,gazeY,mouseX,mouseY';
    const rows = data.map(d =>
        `${d.timestamp},${d.taskId ?? ''},${d.targetX ?? ''},${d.targetY ?? ''},${d.gazeX ?? ''},${d.gazeY ?? ''},${d.mouseX ?? ''},${d.mouseY ?? ''}`
    ).join('\n');

    const csvContent = `${metaData}${header}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'gaze_mouse_task_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- UI 렌더링 (Rendering) ---
  const renderContent = () => {
    switch (gameState) {
      case 'calibrating':
        if (calibrationStep === 1) {
          // 1단계: 추적 응시
          return <SmoothPursuit onComplete={() => setCalibrationStep(2)} />;
        } else {
          // 2단계: 지점 클릭
          return (
            <div>
              <p>캘리브레이션 (2/2): 화면의 주요 지점을 클릭하여 보정을 완료하세요. ({calibDotIndex + 1}/{calibrationDots.length})</p>
              <div
                className="calibration-dot"
                style={{
                  left: calibrationDots[calibDotIndex].x,
                  top: calibrationDots[calibDotIndex].y,
                }}
                onClick={handleCalibDotClick}
              />
            </div>
          );
        }
      
      // confirmValidation 상태에 대한 UI 추가
      case 'confirmValidation':
        return (
          <div className="validation-container">
            <div className="confirmation-box">
              <h2>캘리브레이션 완료</h2>
              <p>이제 정확도 측정 단계로 진행합니다.</p>
              <button onClick={() => setGameState('validating')}>정확도 측정 시작</button>
            </div>
          </div>
        );

      // 'validating' 상태에 대한 UI 추가
      case 'validating':
        return (
          <div className="validation-container">
            <div className="validation-dot" />
            {validationError === null ? (
              <p>정확도 측정 중... 화면 중앙의 파란 점을 3초간 응시하세요.</p>
            ) : (
              <div className="result-container">
                <p>측정된 평균 오차: <strong>{validationError.toFixed(2)} 픽셀</strong></p>
                <div className="controls">
                  <button onClick={() => setGameState('task')}>과제 시작</button>
                  <button onClick={handleRecalibrate}>재보정</button>
                </div>
              </div>
            )}
          </div>
        );

      case 'task':
        return (
          <div>
            <p>측정: 화면에 나타나는 녹색 점을 클릭하세요. ({taskCount + 1}/{TOTAL_TASKS})</p>
            {currentDot && (
              <div
                className="task-dot"
                style={{
                  left: `${currentDot.x}px`,
                  top: `${currentDot.y}px`,
                }}
                // CHANGED: 클릭 이벤트 객체를 핸들러에 전달
                onClick={handleTaskDotClick}
              />
            )}
          </div>
        );

      // CHANGED: 최종 결과 화면을 요약 테이블을 보여주는 UI로 교체
      case 'finished':
        return (
          <div className="finished-container">
            <h2>측정 완료!</h2>
            <h3>데이터 요약</h3>
            <table className="results-table">
              <thead>
                <tr>
                  <th>과제 번호</th>
                  <th>소요 시간 (초)</th>
                  <th>시선-타겟 거리 (px)</th>
                  <th>시선-클릭 거리 (px)</th>
                </tr>
              </thead>
              <tbody>
                {taskResults.map(result => (
                  <tr key={result.taskId}>
                    <td>{result.taskId}</td>
                    <td>{(result.timeTaken / 1000).toFixed(2)}</td>
                    <td>{result.gazeToTargetDistance ? result.gazeToTargetDistance.toFixed(2) : 'N/A'}</td>
                    <td>{result.gazeToClickDistance ? result.gazeToClickDistance.toFixed(2) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="finished-controls">
              <button onClick={() => downloadCSV(collectedData.current)}>원본 데이터(CSV) 다운로드</button>
              <button onClick={() => window.location.reload()}>다시 시작하기</button>
            </div>
          </div>
        );

      case 'idle':
      default:
        return (
          <div>
            <div className="instructions">
              <h3>정확도 향상을 위한 핵심 원리 (사용자 안내)</h3>
              <p>
                WebGazer.js는 사용자의 얼굴 특징(특히 눈)과 화면 위 마우스
                포인터의 위치 관계를 학습합니다. 따라서 정확한 학습을 위해서는
                아래의 환경과 자세가 매우 중요합니다.
              </p>
              <ul>
                <li>
                  <strong>자세 고정:</strong> 캘리브레이션을 진행하는 동안에는
                  머리와 상체를 최대한 움직이지 않고 고정해야 합니다. 머리가
                  움직이면 눈과 화면의 상대적 위치가 계속 바뀌어 모델이 혼란을
                  겪고 정확도가 크게 떨어집니다.
                </li>
                <li>
                  <strong>정확한 클릭:</strong> 점을 클릭할 때, 점을 먼저
                  응시한 후, 시선이 고정된 상태에서 클릭하는 것이 중요합니다.
                  점을 보지 않고 마우스만 움직여 클릭하면 잘못된 데이터가
                  학습됩니다.
                </li>
                <li>
                  <strong>좋은 환경:</strong> 안경에 빛이 반사되거나, 얼굴에
                  그림자가 지거나, 배경이 너무 복잡하면 시선 추적의 정확도가
                  떨어질 수 있습니다. 밝고 균일한 조명 아래에서 진행하는 것이
                  가장 좋습니다.
                </li>
              </ul>
            </div>
            <p>준비가 되셨다면 아래 버튼을 눌러 시작해 주세요.<br/>
            <strong>측정시작</strong> 버튼을 누르면 캘리브레이션 후, 시선 및 마우스 추적 측정이 시작됩니다.</p>
            <button onClick={handleStart} disabled={!isScriptLoaded}>
              {isScriptLoaded ? '측정 시작' : '스크립트 로딩 중...'}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="container">
      <h1>시선 & 마우스 추적 데모</h1>
      {renderContent()}
    </div>
  );
};

// NEW: 추적 응시 캘리브레이션을 위한 별도의 컴포넌트
const SmoothPursuit: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const dot = document.getElementById('pursuit-dot');
    if (!dot) return;

    const duration = 12000; // 12초 동안 진행
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

      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      
      // 실제 mousemove 이벤트를 생성하여 발생시켜 WebGazer가 정상적으로 데이터를 수집하도록함
      const mouseMoveEvent = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      });
      document.dispatchEvent(mouseMoveEvent);

      if (currentProgress < 1) {
        animationFrameId.current = requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
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

export default GazeTracker;