// src/components/GazeTracker/index.tsx

import React, { useState, useEffect, useRef } from 'react';
import './GazeTracker.css';

// 게임(과제)의 진행 상태를 나타내는 타입
type GameState = 'idle' | 'calibrating' | 'task' | 'finished';

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
      // 캘리브레이션 완료 -> 과제 시작
      setGameState('task');
    }
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
    if (data.length === 0) return;
    // CSV 헤더에 taskId 추가
    const header = 'timestamp,taskId,gazeX,gazeY,mouseX,mouseY';
    const rows = data.map(d =>
        `${d.timestamp},${d.taskId ?? ''},${d.gazeX ?? ''},${d.gazeY ?? ''},${d.mouseX ?? ''},${d.mouseY ?? ''}`
    ).join('\n');
    const csvContent = `${header}\n${rows}`;
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