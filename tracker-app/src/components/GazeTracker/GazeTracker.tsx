// src/components/GazeTracker/GazeTracker.tsx

import React, { useState, useEffect, useRef } from 'react';
import './GazeTracker.css';

// 분리된 파일들 import
import { GameState, DataRecord, TaskResult, DotPosition } from './types';
import { FORBIDDEN_ZONE, TOTAL_TASKS } from './constants';
import Instructions from './Instructions';
import WebcamCheck from './WebcamCheck';
import Calibration from './Calibration';
import Validation from './Validation';
import Task from './Task';
import Results from './Results';

const GazeTracker: React.FC = () => {
  // --- 상태 관리 (State Management) ---
  const [gameState, setGameState] = useState<GameState>('idle');
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const collectedData = useRef<DataRecord[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [currentDot, setCurrentDot] = useState<DotPosition | null>(null);
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const taskStartTime = useRef<number | null>(null);
  const [validationError, setValidationError] = useState<number | null>(null);
  const validationGazePoints = useRef<{ x: number; y: number }[]>([]);
  const [screenSize, setScreenSize] = useState<{ width: number; height: number } | null>(null); // 화면크기 기록 (화면 크기 대비 오차율 확인용) 

  // --- useEffect 훅 (Side Effects) ---

  // WebGazer.js 스크립트 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
      if (window.webgazer) window.webgazer.end();
    };
  }, []);

  // gameState에 따른 시선 예측 점(빨간 점) 표시 여부 제어
  useEffect(() => {
    if (!isScriptLoaded || !window.webgazer) return;
    const shouldShow = gameState === 'validating' || gameState === 'task';
    window.webgazer.showPredictionPoints(shouldShow);
  }, [gameState, isScriptLoaded]);

  // 정확도 측정 로직
  useEffect(() => {
    if (gameState !== 'validating') return;
    validationGazePoints.current = [];
    setValidationError(null);

    const validationListener = (data: any) => {
      if (data) validationGazePoints.current.push({ x: data.x, y: data.y });
    };
    window.webgazer.setGazeListener(validationListener);

    const timer = setTimeout(() => {
      window.webgazer.clearGazeListener();
      if (validationGazePoints.current.length === 0) {
        alert("시선이 감지되지 않았습니다. 재보정을 진행합니다.");
        handleRecalibrate();
        return;
      }
      const avgGaze = validationGazePoints.current.reduce(
        (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
        { x: 0, y: 0 }
      );
      avgGaze.x /= validationGazePoints.current.length;
      avgGaze.y /= validationGazePoints.current.length;
      const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const error = Math.sqrt(Math.pow(target.x - avgGaze.x, 2) + Math.pow(target.y - avgGaze.y, 2));
      setValidationError(error);
    }, 3000);
    return () => clearTimeout(timer);
  }, [gameState]);

  // 과제용 랜덤 점 생성
  useEffect(() => {
    if (gameState === 'task' && taskCount < TOTAL_TASKS) {
      let x, y;
      const padding = 50;
      do {
        x = Math.floor(Math.random() * (window.innerWidth - padding * 2)) + padding;
        y = Math.floor(Math.random() * (window.innerHeight - padding * 2)) + padding;
      } while (x < FORBIDDEN_ZONE.width && y < FORBIDDEN_ZONE.height);
      setCurrentDot({ x, y });
      taskStartTime.current = performance.now();
    }
  }, [gameState, taskCount]);

  // 데이터 수집 리스너
  useEffect(() => {
    if (gameState !== 'task' || !window.webgazer) return;
    const gazeListener = (data: any) => {
      if (data) {
        collectedData.current.push({
          timestamp: performance.now(), taskId: taskCount + 1,
          targetX: currentDot?.x ?? null, targetY: currentDot?.y ?? null,
          gazeX: data.x, gazeY: data.y, mouseX: null, mouseY: null,
        });
      }
    };
    window.webgazer.setGazeListener(gazeListener);
    const mouseMoveListener = (event: MouseEvent) => {
      collectedData.current.push({
        timestamp: performance.now(), taskId: taskCount + 1,
        targetX: currentDot?.x ?? null, targetY: currentDot?.y ?? null,
        gazeX: null, gazeY: null, mouseX: event.clientX, mouseY: event.clientY,
      });
    };
    document.addEventListener('mousemove', mouseMoveListener);
    return () => {
      window.webgazer.clearGazeListener();
      document.removeEventListener('mousemove', mouseMoveListener);
    };
  }, [gameState, taskCount, currentDot]);

  // --- 이벤트 핸들러 (Event Handlers) ---

  const handleStart = () => {
    setTaskResults([]);

    setScreenSize({ width: window.innerWidth, height: window.innerHeight }); // 측정 시작 시점의 화면 크기를 저장

    if (!isScriptLoaded) return;
    
    window.webgazer.setTracker('TFFacemesh');// 얼굴 추적 모델을 설정. (clmtrackr(기본값) -> TFFacemesh)

    collectedData.current = [];

    window.webgazer.begin();
    window.webgazer.applyKalmanFilter(true); // 칼만필터 활성화

    setGameState('webcamCheck');
  };

  const handleRecalibrate = () => {
    setValidationError(null);
    window.webgazer.clearData();
    setGameState('calibrating');
  };
  

  const handleTaskDotClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const clickTime = performance.now();
    const lastGazeRecord = [...collectedData.current].reverse().find(d => d.gazeX !== null && d.gazeY !== null);
    const lastGazePos = lastGazeRecord ? { x: lastGazeRecord.gazeX, y: lastGazeRecord.gazeY } : null;
    const clickPos = { x: event.clientX, y: event.clientY };
    const targetPos = currentDot;
    const timeTaken = taskStartTime.current ? clickTime - taskStartTime.current : 0;

    let gazeToTargetDistance: number | null = null;
    let gazeToClickDistance: number | null = null;

    if (lastGazePos) { 
      if (targetPos) {
        // 강제 어설션: lastGazePos 뒤에 ! 를 붙여 null이 아님을 명시
        gazeToTargetDistance = Math.sqrt(Math.pow(targetPos.x - lastGazePos.x!, 2) + Math.pow(targetPos.y - lastGazePos.y!, 2));
      }
      // 강제 어설션: lastGazePos 뒤에 ! 를 붙여 null이 아님을 명시
      gazeToClickDistance = Math.sqrt(Math.pow(clickPos.x - lastGazePos.x!, 2) + Math.pow(clickPos.y - lastGazePos.y!, 2));
    }

    setTaskResults(prevResults => [...prevResults, { taskId: taskCount + 1, timeTaken, gazeToTargetDistance, gazeToClickDistance }]);

    if (taskCount < TOTAL_TASKS - 1) {
      setTaskCount(taskCount + 1);
    } else {
      setGameState('finished');
      if (window.webgazer) window.webgazer.end();
    }
  };

  const downloadCSV = () => {
    const metaData = `# Screen Size (width x height): ${screenSize ? `${screenSize.width}x${screenSize.height}` : 'N/A'}\n# Validation Error (pixels): ${validationError ? validationError.toFixed(2) : 'N/A'}\n`;
    const header = 'timestamp,taskId,targetX,targetY,gazeX,gazeY,mouseX,mouseY';
    const rows = collectedData.current.map(d => `${d.timestamp},${d.taskId ?? ''},${d.targetX ?? ''},${d.targetY ?? ''},${d.gazeX ?? ''},${d.gazeY ?? ''},${d.mouseX ?? ''},${d.mouseY ?? ''}`).join('\n');
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
      case 'idle':
        return <Instructions onStart={handleStart} isScriptLoaded={isScriptLoaded} />;
      case 'webcamCheck':
        return <WebcamCheck onComplete={() => setGameState('calibrating')} />;
      case 'calibrating':
        return <Calibration onComplete={() => setGameState('confirmValidation')} />;
      case 'confirmValidation':
         return ( // 이 부분은 UI가 간단하여 별도 컴포넌트로 분리하지 않았습니다.
          <div className="validation-container">
            <div className="confirmation-box">
              <h2>캘리브레이션 완료</h2>
              <p>이제 정확도 측정 단계로 진행합니다.</p>
              <button onClick={() => setGameState('validating')}>정확도 측정 시작</button>
            </div>
          </div>
        );
      case 'validating':
        return <Validation validationError={validationError} onRecalibrate={handleRecalibrate} onStartTask={() => setGameState('task')} />;
      case 'task':
        return <Task taskCount={taskCount} currentDot={currentDot} onDotClick={handleTaskDotClick} />;
      case 'finished':
        return <Results taskResults={taskResults} onDownload={downloadCSV} screenSize={screenSize} />;
      default:
        return null;
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