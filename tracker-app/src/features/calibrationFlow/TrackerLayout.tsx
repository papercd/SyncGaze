// tracker-app/src/components/GazeTracker/TrackerLayout.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { GazeTrackerProvider } from './GazeTrackerContext'; // 1. Context Provider 임포트
import './CalibrationFlow.css';

// GazeTracker.tsx에서 사용하던 모든 import를 그대로 가져옵니다.
import { GameState, DataRecord, TaskResult, DotPosition, QualitySetting, RegressionModel, LiveGaze, ValidationPointResult } from './types';
import { FORBIDDEN_ZONE, TOTAL_TASKS, VALIDATION_POINTS, VALIDATION_DURATION_MS } from './constants';
// (하위 컴포넌트 import는 App.tsx로 이동했으므로 여기서는 필요 없습니다)

// GazeTracker.tsx의 모든 상수 정의를 가져옵니다.
const CAMERA_SETTINGS = {
  low: { width: 640, height: 480, frameRate: 30 },
  medium: { width: 1280, height: 720, frameRate: 60 },
  high: { width: 1920, height: 1080, frameRate: 60 },
};
const USE_KALMAN_FILTER = true;
const CALIBRATION_DWELL_RADIUS = 150;


const TrackerLayout: React.FC = () => {
  // --- 1. GazeTracker.tsx의 모든 상태 관리 로직을 그대로 복사 ---
  const [gameState, setGameState] = useState<GameState>('idle');
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const collectedData = useRef<DataRecord[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [currentDot, setCurrentDot] = useState<DotPosition | null>(null);
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const taskStartTime = useRef<number | null>(null);
  const [validationError, setValidationError] = useState<number | null>(null);
  const validationGazePoints = useRef<{ x: number; y: number }[]>([]);
  const [validationTargets, setValidationTargets] = useState<DotPosition[]>([]);
  const [currentValidationTarget, setCurrentValidationTarget] = useState<DotPosition | null>(null);
  const [validationIndex, setValidationIndex] = useState(0);
  const [awaitingValidationConfirmation, setAwaitingValidationConfirmation] = useState(false);
  const validationSamples = useRef<{ x: number; y: number; timestamp: number }[]>([]);
  const [validationRecords, setValidationRecords] = useState<ValidationPointResult[]>([]);
  const validationTimer = useRef<number | null>(null);
  const [screenSize, setScreenSize] = useState<{ width: number; height: number } | null>(null);
  const [quality, setQuality] = useState<QualitySetting>('medium');
  const [regressionModel, setRegressionModel] = useState<RegressionModel>('ridge');
  const [liveGaze, setLiveGaze] = useState<LiveGaze>({ x: null, y: null });
  const [recalibrationCount, setRecalibrationCount] = useState(0);
  const [gazeStability, setGazeStability] = useState<number | null>(null);
  const [calStage3SuccessRate, setCalStage3SuccessRate] = useState<number | null>(null);
  const [avgGazeMouseDivergence, setAvgGazeMouseDivergence] = useState<number | null>(null);
  const [avgGazeTimeToTarget, setAvgGazeTimeToTarget] = useState<number | null>(null);
  const [avgClickTimeTaken, setAvgClickTimeTaken] = useState<number | null>(null);
  const [avgGazeToClickError, setAvgGazeToClickError] = useState<number | null>(null);
  const taskStartTimes = useRef<Record<number, number>>({});
  const [isGazeDetected, setIsGazeDetected] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  // --- 2. 라우터 네비게이션 훅 초기화 ---
  const navigate = useNavigate();

  // --- 3. GazeTracker.tsx의 모든 핸들러 및 useCallback 훅을 그대로 복사 ---
  // (단, setGameState 호출 시 navigate도 함께 호출하도록 수정)

  const handleRecalibrate = useCallback(() => {
    setValidationError(null);
    setGazeStability(null);
    setValidationRecords([]);
    setValidationIndex(0);
    setCurrentValidationTarget(null);
    window.webgazer.clearData();
    setRecalibrationCount(prevCount => prevCount + 1);

    // 상태 변경 및 페이지 이동
    setGameState('calibrating');
    navigate('/tracker/calibrate'); // 재보정 시 캘리브레이션 페이지로 이동
  }, [navigate]); // navigate 의존성 추가

  const handleCalibrationComplete = useCallback(() => {
    // 상태 변경 및 페이지 이동
    setGameState('confirmValidation');
    navigate('/tracker/confirm-validation');
  }, [navigate]); // navigate 의존성 추가

  const handleCalStage3Complete = useCallback((successRate: number) => {
    setCalStage3SuccessRate(successRate);
  }, []);

  const handleStart = () => {
    // (GazeTracker.tsx의 handleStart 로직과 동일)
    setTaskResults([]);
    setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    if (!isScriptLoaded) return;
    
    window.webgazer.setTracker('TFFacemesh');
    window.webgazer.setRegression('ridge');
    collectedData.current = [];

    if (window.webgazer.params) {
      window.webgazer.params.checkClick = false;
      window.webgazer.params.checkMove = false;
      console.log("WebGazer default click/move listeners DISABLED for selective calibration.");
    }
    
    window.webgazer.begin(); 
    window.webgazer.applyKalmanFilter(USE_KALMAN_FILTER);

    // 모든 지표 초기화
    setRecalibrationCount(0);
    setGazeStability(null);
    setValidationError(null);
    setCalStage3SuccessRate(null);
    setAvgGazeMouseDivergence(null);
    setAvgGazeTimeToTarget(null);
    setAvgClickTimeTaken(null);
    setAvgGazeToClickError(null);
    setIsGazeDetected(false);
    setUploadStatus('idle');
    taskStartTimes.current = {};

    // 상태 변경 및 페이지 이동
    setGameState('webcamCheck');
    navigate('/tracker/webcam-check');
  };

  const handleCalibrationStart = () => {
    if (!window.webgazer) return;
    window.webgazer.clearGazeListener();
    
    const constraints = CAMERA_SETTINGS[quality];
    window.webgazer.setCameraConstraints({ video: constraints });
    window.webgazer.setRegression(regressionModel);

    // 상태 변경 및 페이지 이동
    setGameState('calibrating');
    navigate('/tracker/calibrate');
  };
  
  const handleTaskDotClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // (GazeTracker.tsx의 handleTaskDotClick 로직과 동일)
    if (window.webgazer && typeof window.webgazer.recordScreenPosition === 'function') {
      window.webgazer.recordScreenPosition(
        event.clientX,
        event.clientY,
        'click' 
      );
    }
    // ... (time, distance 계산 로직) ...
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
        gazeToTargetDistance = Math.sqrt(Math.pow(targetPos.x - lastGazePos.x!, 2) + Math.pow(targetPos.y - lastGazePos.y!, 2));
      }
      gazeToClickDistance = Math.sqrt(Math.pow(clickPos.x - lastGazePos.x!, 2) + Math.pow(clickPos.y - lastGazePos.y!, 2));
    }
    // ... (계산 로직 끝) ...

    setTaskResults(prevResults => [...prevResults, { taskId: taskCount + 1, timeTaken, gazeToTargetDistance, gazeToClickDistance }]);

    if (taskCount < TOTAL_TASKS - 1) {
      setTaskCount(taskCount + 1);
    } else {
      // 상태 변경 (페이지 이동은 'finished' useEffect에서 처리)
      setGameState('finished');
      if (window.webgazer) window.webgazer.end();
    }
  };

  const analyzeTaskData = useCallback(() => {
    // (GazeTracker.tsx의 analyzeTaskData 로직과 동일)
    const data = collectedData.current;
    if (data.length === 0) return;
    // ... (평균 이격도 계산) ...
    let lastMousePos = { x: 0, y: 0 };
    const divergences: number[] = [];
    for (const record of data) {
      if (record.mouseX !== null && record.mouseY !== null) {
        lastMousePos = { x: record.mouseX, y: record.mouseY };
      }
      if (record.gazeX !== null && record.gazeY !== null && lastMousePos.x !== 0) {
        const dist = Math.sqrt(Math.pow(record.gazeX - lastMousePos.x, 2) + Math.pow(record.gazeY - lastMousePos.y, 2));
        divergences.push(dist);
      }
    }
    if (divergences.length > 0) {
      const avgDivergence = divergences.reduce((a, b) => a + b, 0) / divergences.length;
      setAvgGazeMouseDivergence(avgDivergence);
    }
    // ... (평균 시선 반응 속도 계산) ...
    const reactionTimes: number[] = [];
    const GAZE_HIT_RADIUS = 100;
    for (let i = 1; i <= TOTAL_TASKS; i++) {
      const startTime = taskStartTimes.current[i];
      if (!startTime) continue;
      const taskGazeEvents = data.filter(d => d.taskId === i && d.gazeX !== null && d.timestamp >= startTime);
      if (taskGazeEvents.length === 0) continue;
      const target = { x: taskGazeEvents[0].targetX, y: taskGazeEvents[0].targetY };
      if (target.x === null || target.y === null) continue;
      for (const event of taskGazeEvents) {
        const dist = Math.sqrt(Math.pow(event.gazeX! - target.x, 2) + Math.pow(event.gazeY! - target.y, 2));
        if (dist < GAZE_HIT_RADIUS) {
          reactionTimes.push(event.timestamp - startTime);
          break;
        }
      }
    }
    if (reactionTimes.length > 0) {
      const avgReactionTime = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;
      setAvgGazeTimeToTarget(avgReactionTime);
    }
  }, []); // 의존성 배열 비어있음 (Ref 사용)

  const generateCsvContent = useCallback(() => {
    // (GazeTracker.tsx의 generateCsvContent 로직과 동일)
    const participantMetaData = [
      `# --- Participant Survey & Consent ---`,
      `# Survey Data: NOT_COLLECTED`,
      `# Consent Timestamp: NOT_COLLECTED`,
    ];
    const participantMetaDataCSV = participantMetaData.join('\n');
    const systemMetaData = [
      `# --- System & Environment Settings ---`,
      `# Camera Quality: ${quality}`,
      `# Regression Model: ${regressionModel}`,
      `# Kalman Filter Enabled: ${USE_KALMAN_FILTER}`,
      `# Calibration Dwell Radius (px): ${CALIBRATION_DWELL_RADIUS}`,
    ].join('\n');
    const measurementMetaData = [
      `# --- Measurement Summary ---`,
      `# Screen Size (width x height): ${screenSize ? `${screenSize.width}x${screenSize.height}` : 'N/A'}`,
      `# Recalibration Count: ${recalibrationCount}`,
      `# Calibration Stage 3 Success Rate: ${calStage3SuccessRate ? (calStage3SuccessRate * 100).toFixed(1) + '%' : 'N/A'}`,
      `# Validation Error (pixels): ${validationError ? validationError.toFixed(2) : 'N/A'}`,
      `# Gaze Stability (Avg. StdDev px): ${gazeStability ? gazeStability.toFixed(2) : 'N/A'}`,
      '', 
      `# --- Derived Task Metrics ---`,
      `# Avg. Click Time Taken (ms): ${avgClickTimeTaken ? avgClickTimeTaken.toFixed(2) : 'N/A'}`,
      `# Avg. Gaze-to-Click Error (px): ${avgGazeToClickError ? avgGazeToClickError.toFixed(2) : 'N/A'}`,
      `# Avg. Gaze-Mouse Divergence (px): ${avgGazeMouseDivergence ? avgGazeMouseDivergence.toFixed(2) : 'N/A'}`,
      `# Avg. Gaze Time-to-Target (ms): ${avgGazeTimeToTarget ? avgGazeTimeToTarget.toFixed(2) : 'N/A'}`,
    ].join('\n');
    const taskResultsHeader = `# --- Individual Task Results ---`;
    const taskResultsColumns = `taskId,timeTaken(ms),gazeToTargetDistance(px),gazeToClickDistance(px)`;
    const taskResultsRows = taskResults.map(r =>
      `${r.taskId},${r.timeTaken.toFixed(2)},${r.gazeToTargetDistance !== null ? r.gazeToTargetDistance.toFixed(2) : 'N/A'},${r.gazeToClickDistance !== null ? r.gazeToClickDistance.toFixed(2) : 'N/A'}`
    ).join('\n');
    const taskResultsCSV = `${taskResultsHeader}\n${taskResultsColumns}\n${taskResultsRows}`;
    const rawDataHeader = `# --- Raw Gaze & Mouse Data --- \n# (Note: gazeX/gazeY and mouseX/mouseY are mutually exclusive per row)`;
    const rawDataColumns = 'timestamp,taskId,targetX,targetY,gazeX,gazeY,mouseX,mouseY';
    const rawDataRows = collectedData.current.map(d => `${d.timestamp},${d.taskId ?? ''},${d.targetX ?? ''},${d.targetY ?? ''},${d.gazeX ?? ''},${d.gazeY ?? ''},${d.mouseX ?? ''},${d.mouseY ?? ''}`).join('\n');
    const rawDataCSV = `${rawDataHeader}\n${rawDataColumns}\n${rawDataRows}`;
    // ... (CSV 조합) ...
    const csvContent = `${participantMetaDataCSV}\n\n${systemMetaData}\n\n${measurementMetaData}\n\n${taskResultsCSV}\n\n${rawDataCSV}`;
    return csvContent;
  }, [
    quality, regressionModel, screenSize, recalibrationCount, calStage3SuccessRate,
    validationError, gazeStability, avgClickTimeTaken, avgGazeToClickError,
    avgGazeMouseDivergence, avgGazeTimeToTarget, taskResults
  ]);

  const downloadCSV = () => {
    // (GazeTracker.tsx의 downloadCSV 로직과 동일)
    const csvContent = generateCsvContent();
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

  // --- 4. GazeTracker.tsx의 모든 useEffect 훅을 그대로 복사 ---
  // (WebGazer 스크립트 로드)
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/webgazer.js';
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
      if (window.webgazer) window.webgazer.end();
    };
  }, []);

  // (시선 예측 점 표시 여부 제어)
  useEffect(() => {
    if (!isScriptLoaded || !window.webgazer) return;
    const shouldShow = gameState === 'calibrating' || gameState === 'validating' || gameState === 'task';
    window.webgazer.showPredictionPoints(shouldShow);
  }, [gameState, isScriptLoaded]);

  // (정확도 측정 로직)
  useEffect(() => {
    if (gameState !== 'validating') return;
    if (!validationTargets.length) return;

    if (validationIndex >= validationTargets.length) {
      setCurrentValidationTarget(null);
      setAwaitingValidationConfirmation(false);
      return;
    }

    if (awaitingValidationConfirmation) {
      setCurrentValidationTarget(null);
      return;
    }

    const target = validationTargets[validationIndex];
    setCurrentValidationTarget(target);
    validationGazePoints.current = [];
    validationSamples.current = [];
    setValidationError(null);
    setGazeStability(null);

    const validationListener = (data: any) => {
      if (data && data.x !== null && data.y !== null) {
        validationGazePoints.current.push({ x: data.x, y: data.y });
        validationSamples.current.push({ x: data.x, y: data.y, timestamp: performance.now() });
      }
    };
    window.webgazer.setGazeListener(validationListener);

    validationTimer.current = window.setTimeout(() => {
      if (window.webgazer) {
        window.webgazer.clearGazeListener();
      }

      const samples = [...validationSamples.current];
      if (samples.length === 0) {
        setValidationRecords(prev => [...prev, {
          target,
          meanGaze: null,
          sampleCount: 0,
          meanError: null,
          meanDistance: null,
          stdDev: null,
          minError: null,
          maxError: null,
          samples: [],
        }]);
        setValidationIndex(idx => idx + 1);
        setAwaitingValidationConfirmation(true);
        return;
      }

      const meanGaze = samples.reduce(
        (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
        { x: 0, y: 0 }
      );
      meanGaze.x /= samples.length;
      meanGaze.y /= samples.length;

      const distances = samples.map(p => Math.sqrt(Math.pow(target.x - p.x, 2) + Math.pow(target.y - p.y, 2)));
      const meanDistance = distances.reduce((acc, d) => acc + d, 0) / distances.length;
      const variance = distances.reduce((acc, d) => acc + Math.pow(d - meanDistance, 2), 0) / distances.length;
      const stdDev = Math.sqrt(variance);
      const minError = Math.min(...distances);
      const maxError = Math.max(...distances);
      const targetToMeanError = Math.sqrt(Math.pow(target.x - meanGaze.x, 2) + Math.pow(target.y - meanGaze.y, 2));

      const summary: ValidationPointResult = {
        target,
        meanGaze,
        sampleCount: samples.length,
        meanError: targetToMeanError,
        meanDistance,
        stdDev,
        minError,
        maxError,
        samples,
      };

      setValidationRecords(prev => {
        const next = [...prev, summary];
        const errorValues = next.map(r => r.meanError).filter((v): v is number => v !== null);
        const stdValues = next.map(r => r.stdDev).filter((v): v is number => v !== null);
        if (errorValues.length > 0) {
          setValidationError(errorValues.reduce((acc, v) => acc + v, 0) / errorValues.length);
        }
        if (stdValues.length > 0) {
          setGazeStability(stdValues.reduce((acc, v) => acc + v, 0) / stdValues.length);
        }
        return next;
      });

      setValidationIndex(idx => idx + 1);
      setAwaitingValidationConfirmation(true);
    }, VALIDATION_DURATION_MS);

    return () => {
      if (validationTimer.current) {
        clearTimeout(validationTimer.current);
        validationTimer.current = null;
      }
      if (window.webgazer) {
        window.webgazer.clearGazeListener();
      }
    };
  }, [awaitingValidationConfirmation, gameState, validationIndex, validationTargets]);

  // (과제용 랜덤 점 생성)
  useEffect(() => {
    if (gameState === 'task' && taskCount < TOTAL_TASKS) {
      let x, y;
      const padding = 50;
      do {
        x = Math.floor(Math.random() * (window.innerWidth - padding * 2)) + padding;
        y = Math.floor(Math.random() * (window.innerHeight - padding * 2)) + padding;
      } while (x < FORBIDDEN_ZONE.width && y < FORBIDDEN_ZONE.height);
      setCurrentDot({ x, y });
      
      const startTime = performance.now();
      taskStartTime.current = startTime;
      taskStartTimes.current[taskCount + 1] = startTime;
    }
  }, [gameState, taskCount]);

  // (데이터 수집 리스너)
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

  // (캘리브레이션 중 시선 데이터 업데이트)
  useEffect(() => {
    if (gameState === 'calibrating' && window.webgazer) {
      const gazeListener = (data: any) => {
        if (data) {
          setLiveGaze({ x: data.x, y: data.y });
        }
      };
      window.webgazer.setGazeListener(gazeListener);
      return () => window.webgazer.clearGazeListener();
    }
  }, [gameState]);

  // (WebcamCheck 시선 감지 리스너)
  useEffect(() => {
    if (gameState === 'webcamCheck' && window.webgazer) {
      setIsGazeDetected(false);
      const gazeListener = (data: any) => {
        if (data && data.x !== null && data.y !== null) {
          setIsGazeDetected(true);
          if (window.webgazer) {
            window.webgazer.clearGazeListener();
          }
        }
      };
      window.webgazer.setGazeListener(gazeListener);
      return () => {
        if (window.webgazer) {
          window.webgazer.clearGazeListener();
        }
      };
    }
  }, [gameState]);

  // ('finished' 상태 처리 및 페이지 이동)
  useEffect(() => {
    if (gameState !== 'finished' || uploadStatus !== 'idle') {
      return;
    }

    // (통계 계산 로직)
    analyzeTaskData();
    if (taskResults.length > 0) {
      const avgTime = taskResults.reduce((acc, r) => acc + r.timeTaken, 0) / taskResults.length;
      setAvgClickTimeTaken(avgTime);
      const validGazeToClick = taskResults.filter(r => r.gazeToClickDistance !== null);
      if (validGazeToClick.length > 0) {
        const avgError = validGazeToClick.reduce((acc, r) => acc + r.gazeToClickDistance!, 0) / validGazeToClick.length;
        setAvgGazeToClickError(avgError);
      } else {
        setAvgGazeToClickError(null);
      }
    }

    // (자동 업로드 IIFE)
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 0)); 
      setUploadStatus('uploading');
      const csvContent = generateCsvContent();

      try {
        const response = await fetch('/api/upload-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8;' },
          body: csvContent,
        });
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        const result = await response.json();
        console.log('Upload Success:', result.url);
        setUploadStatus('success');
      } catch (error) {
        console.error('Upload Failed:', error);
        setUploadStatus('error');
      }
      
      // 5. 모든 작업 완료 후 결과 페이지로 이동
      navigate('/tracker/results');

    })();
    
  }, [gameState, uploadStatus, analyzeTaskData, taskResults, generateCsvContent, navigate]);


  // --- 6. Context API를 위한 새 핸들러 정의 ---

  // ConfirmValidation -> Validation
  const startValidation = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    setScreenSize({ width, height });
    const targets = VALIDATION_POINTS.map(pct => ({
      x: Math.round(pct.x * width),
      y: Math.round(pct.y * height),
    }));
    setValidationTargets(targets);
    setValidationRecords([]);
    setValidationIndex(0);
    setCurrentValidationTarget(null);
    setAwaitingValidationConfirmation(true);
    validationSamples.current = [];
    setValidationError(null);
    setGazeStability(null);
    setGameState('validating');
    navigate('/tracker/validate');
  };

  const confirmNextValidationPoint = () => {
    if (validationIndex >= validationTargets.length) return;
    setAwaitingValidationConfirmation(false);
  };

  // Validation -> Results
  const goToResults = () => {
    if (window.webgazer) {
      window.webgazer.clearGazeListener();
    }
    setGameState('finished');
    setUploadStatus('idle');
    navigate('/tracker/results');
  };

  // Results -> Instructions (시작 페이지로)
  const returnToStart = () => {
    // WebGazer 세션 종료
    if (window.webgazer) {
      window.webgazer.end();
    }
    // (필요시) 모든 상태를 'idle' 기본값으로 초기화
    setGameState('idle');
    setUploadStatus('idle');
    setTaskCount(0);
    setIsGazeDetected(false);
    // ... (다른 상태들도 초기화) ...
    
    // 시작 페이지(Instructions)로 이동
    navigate('/tracker'); 
  };

  // --- 7. Context Provider에게 전달할 값 객체 생성 ---
  const providerValue = {
    // States
    gameState,
    isScriptLoaded,
    taskCount,
    currentDot,
    taskResults,
    validationError,
    validationRecords,
    validationTargets,
    currentValidationTarget,
    validationIndex,
    awaitingValidationConfirmation,
    screenSize,
    quality,
    regressionModel,
    liveGaze,
    recalibrationCount,
    gazeStability,
    calStage3SuccessRate,
    avgGazeMouseDivergence,
    avgGazeTimeToTarget,
    avgClickTimeTaken,
    avgGazeToClickError,
    isGazeDetected,
    uploadStatus,
    validationDurationMs: VALIDATION_DURATION_MS,
    // State Setters
    setGameState,
    setQuality,
    setRegressionModel,
    // Refs
    collectedData,
    taskStartTime,
    validationGazePoints,
    taskStartTimes,
    // Handlers
    handleStart,
    handleCalibrationStart,
    handleCalibrationComplete,
    handleCalStage3Complete,
    handleRecalibrate,
    handleTaskDotClick,
    downloadCSV,
    analyzeTaskData,
    generateCsvContent,
    // New Nav Handlers
    startValidation,
    confirmNextValidationPoint,
    goToResults,
    returnToStart,
  };

  // --- 8. UI 렌더링 ---
  // GazeTracker.tsx의 renderContent() 대신 Provider와 Outlet을 사용
  return (
    <GazeTrackerProvider value={providerValue}>
      <div className="container">
        <h1>시선 & 마우스 추적 데모</h1>
        {/* App.tsx의 중첩 라우트에 정의된 컴포넌트가 이 자리에 렌더링됩니다. */}
        <Outlet />
      </div>
    </GazeTrackerProvider>
  );
};

export default TrackerLayout;