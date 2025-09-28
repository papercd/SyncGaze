// src/components/GazeTracker/index.tsx

import React, { useState, useEffect, useRef } from 'react';
import './GazeTracker.css';

// 게임(과제)의 진행 상태를 나타내는 타입
// VALIDATION: 'validating' 상태 추가
// NEW: 'confirmValidation' 상태 추가
type GameState = 'idle' | 'calibrating' | 'confirmValidation' | 'validating' | 'task' | 'finished';

// 수집할 데이터의 타입을 정의합니다. (taskId 추가)
interface DataRecord {
  timestamp: number;
  taskId: number | null; // 몇 번째 과제(점)인지 기록
  gazeX: number | null;
  gazeY: number | null;
  mouseX: number | null;
  mouseY: number | null;
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
  const [calibDotIndex, setCalibDotIndex] = useState(0);
  // 카메라 영역을 피하도록 좌표 전면 수정
  const calibrationDots = [
    { x: '50%', y: '20%' }, { x: '80%', y: '20%' }, { x: '80%', y: '50%' },
    { x: '80%', y: '80%' }, { x: '50%', y: '80%' }, { x: '20%', y: '80%' },
    { x: '20%', y: '50%' }, { x: '50%', y: '50%' }, { x: '35%', y: '35%' },
  ];

  // VALIDATION: 정확도 검증 관련 상태 추가
  const [validationError, setValidationError] = useState<number | null>(null);
  const validationGazePoints = useRef<{ x: number; y: number }[]>([]);

  // 새로운 과제(Task) 관련 상태
  const TOTAL_TASKS = 9; // 측정 점 개수
  const [taskCount, setTaskCount] = useState(0);
  const [currentDot, setCurrentDot] = useState<DotPosition | null>(null);

  // --- useEffect 훅 (Side Effects) ---

  // WebGazer.js 스크립트를 동적으로 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
    script.async = true;
    script.onload = () => {
      setIsScriptLoaded(true);
      window.webgazer.showPredictionPoints(true);
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
      if (window.webgazer) window.webgazer.end();
    };
  }, []);
  
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
        gazeX: null, gazeY: null,
        mouseX: event.clientX, mouseY: event.clientY,
      });
    };
    document.addEventListener('mousemove', mouseMoveListener);

    return () => {
      window.webgazer.clearGazeListener();
      document.removeEventListener('mousemove', mouseMoveListener);
    };
  }, [gameState, taskCount]); // gameState이나 taskCount가 바뀔 때마다 리스너 재설정

  // --- 이벤트 핸들러 (Event Handlers) ---

  const handleStart = () => {
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
    setCalibDotIndex(0);
    setValidationError(null);
    window.webgazer.clearData(); // WebGazer 내부 데이터 초기화
    setGameState('calibrating');
  };

  const handleTaskDotClick = () => {
    if (taskCount < TOTAL_TASKS - 1) {
      setTaskCount(taskCount + 1);
    } else {
      // 모든 과제 완료
      setGameState('finished');
      if (window.webgazer) window.webgazer.end();
      downloadCSV(collectedData.current);
    }
  };

  const downloadCSV = (data: DataRecord[]) => {
    // CHANGED: CSV 파일에 정확도 결과도 저장하도록 수정
    const metaData = `# Validation Error (pixels): ${validationError ? validationError.toFixed(2) : 'N/A'}\n`;

    // CSV 헤더에 taskId 추가
    const header = 'timestamp,taskId,gazeX,gazeY,mouseX,mouseY';
    const rows = data.map(d =>
        `${d.timestamp},${d.taskId ?? ''},${d.gazeX ?? ''},${d.gazeY ?? ''},${d.mouseX ?? ''},${d.mouseY ?? ''}`
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
        return (
          <div>
            <p>캘리브레이션: 화면의 빨간 점을 클릭하세요. ({calibDotIndex + 1}/{calibrationDots.length})</p>
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
      
      // confirmValidation 상태에 대한 UI 추가
      case 'confirmValidation':
        return (
          <div className="validation-container">
            <h2>캘리브레이션 완료</h2>
            <p>이제 정확도 측정 단계로 진행합니다.</p>
            <button onClick={() => setGameState('validating')}>정확도 측정 시작</button>
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
              <div>
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
                onClick={handleTaskDotClick}
              />
            )}
          </div>
        );
      case 'finished':
        return (
          <div>
            <h2>측정 완료!</h2>
            <p>데이터가 `gaze_mouse_task_data.csv` 파일로 자동 저장되었습니다.</p>
            <button onClick={() => window.location.reload()}>다시 시작하기</button>
          </div>
        );
      case 'idle':
      default:
        return (
          <div>
            <p>시작 버튼을 누르면 캘리브레이션 후, 시선 및 마우스 추적 측정이 시작됩니다.</p>
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

export default GazeTracker;