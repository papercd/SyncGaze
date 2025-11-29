// tracker-app/src/features/calibrationFlow/TrackerLayout.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { GazeTrackerProvider } from './GazeTrackerContext';
import './CalibrationFlow.css';
import {
  GameState,
  DotPosition,
  QualitySetting,
  RegressionModel,
  LiveGaze,
  ValidationPointResult,
  ValidationSample,
} from './types';
import { VALIDATION_POINTS, VALIDATION_DURATION_MS } from './constants';
const USE_KALMAN_FILTER = true;
const CALIBRATION_DWELL_RADIUS = 150;

const TrackerLayout: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [validationError, setValidationError] = useState<number | null>(null);
  const [validationRecords, setValidationRecords] = useState<ValidationPointResult[]>([]);
  const [validationTargets, setValidationTargets] = useState<DotPosition[]>([]);
  const [currentValidationTarget, setCurrentValidationTarget] = useState<DotPosition | null>(null);
  const [validationIndex, setValidationIndex] = useState(0);
  const [awaitingValidationConfirmation, setAwaitingValidationConfirmation] = useState(false);
  const validationSamples = useRef<ValidationSample[]>([]);
  const validationTimer = useRef<number | null>(null);
  const [screenSize, setScreenSize] = useState<{ width: number; height: number } | null>(null);
  const [quality, setQuality] = useState<QualitySetting>('medium');
  const [regressionModel, setRegressionModel] = useState<RegressionModel>('ridge');
  const [liveGaze, setLiveGaze] = useState<LiveGaze>({ x: null, y: null });
  const [recalibrationCount, setRecalibrationCount] = useState(0);
  const [gazeStability, setGazeStability] = useState<number | null>(null);
  const [calStage3SuccessRate, setCalStage3SuccessRate] = useState<number | null>(null);
  const [isGazeDetected, setIsGazeDetected] = useState(false);

  const navigate = useNavigate();

  const handleRecalibrate = useCallback(() => {
    setValidationError(null);
    setGazeStability(null);
    setValidationRecords([]);
    setValidationIndex(0);
    setCurrentValidationTarget(null);
    setAwaitingValidationConfirmation(false);
    validationSamples.current = [];
    window.webgazer.clearData();
    setRecalibrationCount(prev => prev + 1);

    setGameState('calibrating');
    navigate('/tracker/calibrate');
  }, [navigate]);

  const handleCalibrationComplete = useCallback(() => {
    setGameState('confirmValidation');
    navigate('/tracker/confirm-validation');
  }, [navigate]);

  const handleCalStage3Complete = useCallback((successRate: number) => {
    setCalStage3SuccessRate(successRate);
  }, []);

  const handleCalibrationStart = () => {
    setGameState('calibrating');
    navigate('/tracker/calibrate');
  };

  const handleStart = () => {
    setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    if (!isScriptLoaded) return;

    window.webgazer.setTracker('TFFacemesh');
    window.webgazer.setRegression(regressionModel);
    if (window.webgazer.params) {
      window.webgazer.params.checkClick = false;
      window.webgazer.params.checkMove = false;
    }

    window.webgazer.begin();
    window.webgazer.applyKalmanFilter(USE_KALMAN_FILTER);

    setRecalibrationCount(0);
    setGazeStability(null);
    setValidationError(null);
    setCalStage3SuccessRate(null);
    setIsGazeDetected(false);

    setGameState('webcamCheck');
    navigate('/tracker/webcam-check');
  };

  const generateCsvContent = useCallback(() => {
    const participantMetaData = [
      `# --- Participant Survey & Consent ---`,
      `# Survey Data: NOT_COLLECTED`,
      `# Consent Timestamp: NOT_COLLECTED`,
    ];
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
    ].join('\n');

    const validationHeader = `# --- Validation Summaries ---`;
    const validationColumns = `targetX,targetY,sampleCount,meanError,meanDistance,stdDev,minError,maxError`;
    const validationRows = validationRecords
      .map(record =>
        `${record.target.x},${record.target.y},${record.sampleCount},${record.meanError ?? ''},${record.meanDistance ?? ''},${record.stdDev ?? ''},${record.minError ?? ''},${record.maxError ?? ''}`
      )
      .join('\n');

    const sampleHeader = `# --- Validation Samples ---`;
    const sampleColumns = `targetIndex,sampleX,sampleY,timestamp`;
    const sampleRows = validationRecords
      .map((record, idx) =>
        record.samples
          .map(sample => `${idx + 1},${sample.x},${sample.y},${sample.timestamp}`)
          .join('\n')
      )
      .filter(Boolean)
      .join('\n');

    const csvContent = [
      participantMetaData.join('\n'),
      systemMetaData,
      measurementMetaData,
      validationHeader,
      validationColumns,
      validationRows,
      sampleHeader,
      sampleColumns,
      sampleRows,
    ]
      .filter(Boolean)
      .join('\n\n');

    return csvContent;
  }, [
    quality,
    regressionModel,
    screenSize,
    recalibrationCount,
    calStage3SuccessRate,
    validationError,
    gazeStability,
    validationRecords,
  ]);

  const downloadCSV = () => {
    const csvContent = generateCsvContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'gaze_validation_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  useEffect(() => {
    if (!isScriptLoaded || !window.webgazer) return;
    const shouldShow = gameState === 'calibrating' || gameState === 'validating';
    window.webgazer.showPredictionPoints(shouldShow);
  }, [gameState, isScriptLoaded]);

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
    validationSamples.current = [];
    setValidationError(null);
    setGazeStability(null);

    const validationListener = (data: any) => {
      if (data && data.x !== null && data.y !== null) {
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
        setValidationRecords(prev => [
          ...prev,
          {
            target,
            meanGaze: null,
            sampleCount: 0,
            meanError: null,
            meanDistance: null,
            stdDev: null,
            minError: null,
            maxError: null,
            samples: [],
          },
        ]);
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

  const goToResults = () => {
    if (window.webgazer) {
      window.webgazer.clearGazeListener();
    }
    setGameState('finished');
    navigate('/tracker/results');
  };

  const returnToStart = () => {
    if (window.webgazer) {
      window.webgazer.end();
    }
    setGameState('idle');
    setRecalibrationCount(0);
    setValidationRecords([]);
    setValidationIndex(0);
    setValidationError(null);
    setGazeStability(null);
    navigate('/tracker');
  };

  const providerValue = {
    gameState,
    isScriptLoaded,
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
    isGazeDetected,
    validationDurationMs: VALIDATION_DURATION_MS,
    setGameState,
    setQuality,
    setRegressionModel,
    validationSamples,
    handleStart,
    handleCalibrationStart,
    handleCalibrationComplete,
    handleCalStage3Complete,
    handleRecalibrate,
    downloadCSV,
    generateCsvContent,
    startValidation,
    confirmNextValidationPoint,
    goToResults,
    returnToStart,
  };

  return (
    <GazeTrackerProvider value={providerValue}>
      <div className="container">
        <h1>시선 & 마우스 추적 데모</h1>
        <Outlet />
      </div>
    </GazeTrackerProvider>
  );
};

export default TrackerLayout;