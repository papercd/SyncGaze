// frontend/src/pages/ResultsPage.tsx
// UPDATED: Stops WebGazer when mounting results page, Improved Heatmap Colors & Legend

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './ResultsPage.css';
import {
  TrainingSessionSummary,
  TrainingDataPoint,
  useTrackingSession,
} from '../state/trackingSessionContext';
import { exportSessionData } from '../utils/sessionExport';
import { useWebgazer } from '../hooks/tracking/useWebgazer';
import { useAuth } from '../state/authContext';
import { persistLatestSession } from '../utils/resultsStorage';
// Analytics 인터페이스와 함수를 utils에서 import (ResultsPage 내의 중복 정의 제거)
import { calculatePerformanceAnalytics, generateErrorTimeSeries, PerformanceAnalytics } from '../utils/analytics';

interface Analytics {
  totalTargets: number;
  targetsHit: number;
  accuracy: number;
  avgReactionTime: number;
  gazeAccuracy: number;
  mouseAccuracy: number;
}

type AutoUploadStatus = 'idle' | 'success' | 'error' | 'skipped';

type AccuracyPoint = {
  time: number;
  accuracy: number;
  hits: number;
  total: number;
};

type SeriesPoint = {
  time: number;
  value: number | null;
};

type SeriesConfig = {
  key: string;
  label: string;
  color: string;
  gradientId: string;
  points: SeriesPoint[];
};

type HeatmapPoint = { x: number; y: number };

// --- PerformanceLineChart Component (UPDATED with Hit Markers) ---
const PerformanceLineChart = ({ 
  series, 
  duration,
  hitTimes = [] // NEW: 명중 시점 배열
}: { 
  series: SeriesConfig[]; 
  duration: number;
  hitTimes?: number[];
}) => {
  const activeSeries = series.filter(s => s.points.some(p => p.value !== null));

  if (!activeSeries.length) {
    return <div className="chart-empty">No performance data collected for this session.</div>;
  }

  const width = 720;
  const height = 360;
  const padding = 56;
  
  // X축 최대값 계산
  const xMax = Math.max(duration, ...activeSeries.map(s => s.points.at(-1)?.time ?? 0), 1);
  
  // Y축 최대값 계산 (오차 px이므로 데이터의 최대값 + 여유분)
  const allValues = activeSeries.flatMap(s => s.points.map(p => p.value).filter((v): v is number => v !== null));
  const maxVal = allValues.length ? Math.max(...allValues) : 100;
  const yMax = Math.ceil(maxVal * 1.1); // 10% 여유

  const xScale = (time: number) => padding + (time / xMax) * (width - padding * 2);
  const yScale = (value: number) => height - padding - (value / yMax) * (height - padding * 2);

  const xTicks = 6;
  const xTickValues = Array.from({ length: xTicks }, (_, i) => Math.round((xMax / (xTicks - 1)) * i));
  
  // Y축 눈금 5개 생성
  const yTickValues = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i));

  const formatTime = (seconds: number) => `${seconds}s`;

  return (
    <div className="chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Performance trends over time">
        <defs>
          {activeSeries.map(({ gradientId, color }) => (
            <linearGradient key={gradientId} id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={color} stopOpacity="0.1" />
            </linearGradient>
          ))}
        </defs>

        {/* Axes */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="chart-axis" />

        {/* Gridlines */}
        {xTickValues.map(tick => (
          <line
            key={`x-${tick}`}
            x1={xScale(tick)}
            x2={xScale(tick)}
            y1={padding}
            y2={height - padding}
            className="chart-grid"
          />
        ))}
        {yTickValues.map(tick => (
          <line
            key={`y-${tick}`}
            x1={padding}
            x2={width - padding}
            y1={yScale(tick)}
            y2={yScale(tick)}
            className="chart-grid"
          />
        ))}

        {/* NEW: Hit Markers (명중 시점 표시) */}
        {hitTimes.map((time, idx) => (
          <g key={`hit-${idx}`}>
            {/* 세로 점선 */}
            <line
              x1={xScale(time)}
              x2={xScale(time)}
              y1={padding}
              y2={height - padding}
              stroke="rgba(127, 9, 9, 0.79)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            {/* X축 위의 마커 */}
            <circle
              cx={xScale(time)}
              cy={height - padding}
              r={3}
              fill="#871212ff" // 명중
              opacity="0.8"
            />
            <title>Target Hit at {time.toFixed(1)}s</title>
          </g>
        ))}

        {/* Axis labels */}
        {xTickValues.map(tick => (
          <text key={`xlabel-${tick}`} x={xScale(tick)} y={height - padding + 24} className="chart-label" textAnchor="middle">
            {formatTime(tick)}
          </text>
        ))}
        {yTickValues.map(tick => (
          <text
            key={`ylabel-${tick}`}
            x={padding - 12}
            y={yScale(tick) + 4}
            className="chart-label"
            textAnchor="end"
          >
            {tick}
          </text>
        ))}

        {/* Axis titles */}
        <text x={(width + padding) / 2} y={height - 12} className="chart-axis-title" textAnchor="middle">
          Time (seconds)
        </text>
        <text
          x={16}
          y={height / 2}
          className="chart-axis-title"
          textAnchor="middle"
          transform={`rotate(-90 16 ${height / 2})`}
        >
          Error (px)
        </text>

        {/* Data lines */}
        {activeSeries.map(({ key, points, gradientId, color }) => {
          // null 값을 건너뛰고 유효한 구간만 그림
          const validPoints = points.filter(p => p.value !== null) as { time: number, value: number }[];
          if (validPoints.length < 2) return null;

          const pathD = validPoints
            .map((point, index) => {
              const prefix = index === 0 ? 'M' : 'L';
              return `${prefix}${xScale(point.time)},${yScale(point.value)}`;
            })
            .join(' ');

          return (
            <g key={key}>
              <path d={pathD} className="chart-line" stroke={color} strokeWidth="2" fill="none" />
              {/* 그라데이션 영역 채우기 (선택적) */}
              <path 
                d={`${pathD} L${xScale(validPoints[validPoints.length-1].time)},${height-padding} L${xScale(validPoints[0].time)},${height-padding} Z`} 
                fill={`url(#${gradientId})`} 
                stroke="none"
              />
            </g>
          );
        })}
      </svg>
      <div className="chart-legend" aria-label="Performance legend">
        {activeSeries.map(({ key, label, color }) => (
          <div key={key} className="legend-item">
            <span className="legend-swatch" style={{ backgroundColor: color }} aria-hidden />
            <span className="legend-label">{label}</span>
          </div>
        ))}
        {/* 명중 마커 범례 추가 */}
        <div className="legend-item">
          <span className="legend-swatch" style={{ backgroundColor: '#871212ff', width: 8, height: 8, borderRadius: '50%' }} aria-hidden />
          <span className="legend-label">Hit Moment</span>
        </div>
      </div>
      <div className="chart-caption">
        Lower values indicate better tracking accuracy. Markers indicate when targets were hit.
      </div>
    </div>
  );
};

const UPLOAD_STATUS_STORAGE_KEY = 'resultsUploadStatus';

const loadStoredUploadStatus = (sessionId: string | undefined): AutoUploadStatus | null => {
  if (!sessionId) return null;
  try {
    const stored = window.sessionStorage.getItem(UPLOAD_STATUS_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Record<string, AutoUploadStatus>;
    return parsed[sessionId] ?? null;
  } catch (error) {
    console.warn('Failed to read upload status from storage', error);
    return null;
  }
};

const persistUploadStatus = (sessionId: string | undefined, status: AutoUploadStatus) => {
  if (!sessionId) return;
  try {
    const stored = window.sessionStorage.getItem(UPLOAD_STATUS_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Record<string, AutoUploadStatus>) : {};
    parsed[sessionId] = status;
    window.sessionStorage.setItem(UPLOAD_STATUS_STORAGE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.warn('Failed to persist upload status to storage', error);
  }
};

const ResultsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeSession,
    recentSessions,
    surveyResponses,
    consentAccepted,
    calibrationResult,
    setActiveSessionId,
  } = useTrackingSession();
  
  const { stopSession } = useWebgazer();
  const { user } = useAuth();

  const locationState = (location.state as { fromTrainingComplete?: boolean; sessionId?: string } | null) ?? null;
  // ✅ 표시할 세션을 결정하는 로직 개선
  // Context의 activeSession이 아직 업데이트되지 않았더라도, 
  // navigate로 전달받은 ID를 이용해 recentSessions에서 데이터를 찾아 사용합니다.
  const sessionToDisplay = useMemo(() => {
    if (locationState?.sessionId) {
      // 1순위: 전달받은 ID로 recentSessions에서 찾기
      const found = recentSessions.find(s => s.id === locationState.sessionId);
      if (found) return found;
    }
    // 2순위: Context의 activeSession 사용 (새로고침 등)
    return activeSession;
  }, [locationState?.sessionId, recentSessions, activeSession]);

  const [sessionData, setSessionData] = useState<TrainingSessionSummary | null>(sessionToDisplay);
  // 3. analytics를 useMemo로 변경 (useState 제거)
  // 이렇게 하면 sessionData가 있을 때 즉시 계산되므로 "Loading..." 화면에 갇히지 않음
  const analytics = useMemo<PerformanceAnalytics | null>(() => {
    return sessionData ? calculatePerformanceAnalytics(sessionData.rawData) : null;
  }, [sessionData]);

  const [missingRawData, setMissingRawData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [autoUploadAttemptedFor, setAutoUploadAttemptedFor] = useState<string | null>(null);
  // 초기화 시점에 바로 sessionStorage를 확인하여 상태를 설정합니다. - csv 수동 업로드 버튼 재활성화 방지
  const [autoUploadStatus, setAutoUploadStatus] = useState<AutoUploadStatus>(() => {
    // sessionToDisplay가 있다면 해당 ID에 대한 저장된 상태를 불러오고, 없으면 'idle'
    return loadStoredUploadStatus(sessionToDisplay?.id) ?? 'idle';
  });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatmapContainerRef = useRef<HTMLDivElement | null>(null);
  const participantLabel = user?.email ?? user?.displayName ?? user?.uid;
  const isCalibrationValidated = calibrationResult?.status === 'validated';

  // --- NEW: Performance Series Data Generation ---
  const performanceSeries = useMemo<SeriesConfig[]>(() => {
    if (!sessionData) return [];

    const timeSeries = generateErrorTimeSeries(sessionData.rawData, sessionData.duration);

    return [
      {
        key: 'gaze-error',
        label: 'Gaze Error',
        color: '#4ecdc4', // Teal
        gradientId: 'grad-gaze',
        points: timeSeries.map(p => ({ time: p.time, value: p.gazeError })),
      },
      {
        key: 'mouse-error',
        label: 'Mouse Error',
        color: '#ffb86c', // Orange
        gradientId: 'grad-mouse',
        points: timeSeries.map(p => ({ time: p.time, value: p.mouseError })),
      },
      {
        key: 'synchronization',
        label: 'Synchronization',
        color: '#7a5ff5', // Purple
        gradientId: 'grad-sync',
        points: timeSeries.map(p => ({ time: p.time, value: p.synchronization })),
      },
    ];
  }, [sessionData]);

  // --- NEW: Hit Times Calculation ---
  const hitTimes = useMemo(() => {
    if (!sessionData?.rawData.length) return [];
    const sorted = [...sessionData.rawData].sort((a, b) => a.timestamp - b.timestamp);
    const startTime = sorted[0].timestamp;
    return sorted
      .filter(d => d.targetHit)
      .map(d => (d.timestamp - startTime) / 1000);
  }, [sessionData]);

  const { heatmapPoints, baseScreenWidth, baseScreenHeight } = useMemo(() => {
    if (!sessionData) {
      return { heatmapPoints: [] as HeatmapPoint[], baseScreenWidth: 1920, baseScreenHeight: 1080 };
    }

    const validGazePoints = sessionData.rawData.filter(
      point => point.gazeX !== null && point.gazeY !== null,
    );

    const maxGazeX = validGazePoints.reduce((max, point) => Math.max(max, point.gazeX ?? 0), 0);
    const maxGazeY = validGazePoints.reduce((max, point) => Math.max(max, point.gazeY ?? 0), 0);

    const baseScreenWidth = sessionData.screenSize?.width || (maxGazeX || 1920);
    const baseScreenHeight = sessionData.screenSize?.height || (maxGazeY || 1080);

    const heatmapPoints = validGazePoints
      .map(point => ({
        x: (point.gazeX ?? 0) / baseScreenWidth,
        y: (point.gazeY ?? 0) / baseScreenHeight,
      }))
      .filter(point => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);

    return { heatmapPoints, baseScreenWidth, baseScreenHeight };
  }, [sessionData]);

  // UPDATED: Heatmap drawing logic to be robust against container resizing
  const drawHeatmap = useCallback(() => {
    const canvas = heatmapCanvasRef.current;
    const container = heatmapContainerRef.current;

    if (!canvas || !container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    // If container has no size yet (e.g., during initial render), skip drawing to avoid errors
    if (rect.width === 0 || rect.height === 0) {
        return;
    }

    const displayWidth = Math.max(1, Math.round(rect.width));
    const displayHeight = Math.max(1, Math.round(rect.height));

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!heatmapPoints.length) {
      return;
    }

    const gridSize = 64;
    const grid = new Float32Array(gridSize * gridSize);
    let maxCount = 0;

    heatmapPoints.forEach(point => {
      const gx = Math.min(gridSize - 1, Math.max(0, Math.floor(point.x * gridSize)));
      const gy = Math.min(gridSize - 1, Math.max(0, Math.floor(point.y * gridSize)));
      const idx = gy * gridSize + gx;
      grid[idx] += 1;
      if (grid[idx] > maxCount) {
        maxCount = grid[idx];
      }
    });

    if (!maxCount) {
      return;
    }

    const cellWidth = displayWidth / gridSize;
    const cellHeight = displayHeight / gridSize;

    // UPDATED: Spectrum color function (Blue -> Green -> Red)
    const colorForIntensity = (value: number) => {
      const clamped = Math.min(1, Math.max(0, value));
      // Map intensity to hue: 0.0 -> 240 (Blue), 1.0 -> 0 (Red)
      const hue = (1 - clamped) * 240;
      const alpha = 0.5 + (clamped * 0.4); // Increase alpha with intensity
      return `hsla(${hue}, 100%, 50%, ${alpha})`;
    };

    ctx.save();
    ctx.globalCompositeOperation = 'source-over'; // Changed from lighter for better visibility
    ctx.filter = 'blur(3px)'; // Reduced blur for clarity
    ctx.imageSmoothingEnabled = true;

    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        const count = grid[y * gridSize + x];
        if (count === 0) continue;
        const intensity = count / maxCount;
        ctx.fillStyle = colorForIntensity(intensity);
        ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth + 1, cellHeight + 1);
      }
    }

    ctx.restore();
  }, [heatmapPoints]);

  // UPDATED: Use ResizeObserver instead of window.resize
  // This ensures heatmap draws as soon as the container div has dimensions
  useEffect(() => {
    const container = heatmapContainerRef.current;
    
    // If heatmap points exist but container is not yet ready, this effect will re-run when it is.
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      drawHeatmap();
    });

    resizeObserver.observe(container);
    
    // Initial draw attempt
    drawHeatmap();

    return () => {
      resizeObserver.disconnect();
    };
  }, [drawHeatmap, heatmapPoints.length]); // Re-run if points change (causing conditional render of container)

  useEffect(() => {
    console.log('📊 Results page mounted - stopping WebGazer');
    stopSession();
  }, [stopSession]);

  useEffect(() => {
    if (!sessionToDisplay) {
      navigate('/dashboard');
      return;
    }

    // 현재 표시 중인 세션과 다르다면 업데이트
    if (sessionData?.id !== sessionToDisplay.id) {
        setSessionData(sessionToDisplay);
        setAutoUploadAttemptedFor(null);
        setAutoUploadStatus(loadStoredUploadStatus(sessionToDisplay.id) ?? 'idle');
        
        // Context의 activeSessionId가 다르다면 동기화 (선택 사항)
        if (activeSession?.id !== sessionToDisplay.id) {
             setActiveSessionId(sessionToDisplay.id);
        }
      }
  }, [sessionToDisplay, navigate, sessionData, activeSession, setActiveSessionId]);

  useEffect(() => {
    if (!sessionData) {
      return;
    }
    persistLatestSession(sessionData, calibrationResult);
  }, [sessionData, calibrationResult]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  const handleExport = useCallback(
    async ({ upload, download = true }: { upload?: boolean; download?: boolean } = {}) => {
      if (!sessionData) {
        return false;
      }

      try {
        setIsExporting(true);
        const idToken = user ? await user.getIdToken() : undefined;
        const exportResult = await exportSessionData(
          {
            session: sessionData,
            surveyResponses,
            consentAccepted,
            calibrationResult,
            participantLabel,
            screenSize: sessionData.screenSize,
          },
          {
            filename: `training-session-${sessionData.id}.csv`,
            download,
            upload: Boolean(upload),
            uploadOptions: {
              sessionId: sessionData.id,
              idToken,
            },
          },
        );
        const uploadPath = exportResult.uploadResult?.storagePath || exportResult.uploadResult?.downloadUrl;
        const successMessage = upload
          ? uploadPath
            ? `CSV uploaded to Firebase Storage: ${uploadPath}`
            : download
              ? 'CSV downloaded and uploaded successfully.'
              : 'CSV uploaded successfully.'
          : 'CSV downloaded successfully.';

        showToast(successMessage, 'success');
        return true;
      } catch (error) {
        console.error('Failed to export session data', error);
        const message = error instanceof Error ? error.message : 'Unexpected error occurred.';
        showToast(
          upload ? `CSV upload failed: ${message}` : `CSV export failed: ${message}`,
          'error',
        );
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [calibrationResult, consentAccepted, participantLabel, sessionData, showToast, surveyResponses, user],
  );

  useEffect(() => {
    if (!sessionData) {
      return;
    }

    const fromTrainingComplete = Boolean(locationState?.fromTrainingComplete);
    const sessionMatches = !locationState?.sessionId || locationState.sessionId === sessionData.id;

    if (!fromTrainingComplete || !sessionMatches) {
      setAutoUploadStatus(status => (status === 'idle' ? 'skipped' : status));
      return;
    }

    if (autoUploadAttemptedFor === sessionData.id) {
      return;
    }

    setAutoUploadAttemptedFor(sessionData.id);

    const attemptAutoUpload = async () => {
      const success = await handleExport({ upload: true, download: false });
      const status = success ? 'success' : 'error';
      setAutoUploadStatus(status);
      persistUploadStatus(sessionData.id, status);
    };

    attemptAutoUpload();
  }, [autoUploadAttemptedFor, handleExport, locationState, sessionData]);

  const handleTrainAgain = () => {
    navigate('/calibration');
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleManualUpload = useCallback(async () => {
    const success = await handleExport({ upload: true, download: false });
    const status = success ? 'success' : 'error';
    setAutoUploadStatus(status);
    persistUploadStatus(sessionData?.id, status);
  }, [handleExport, sessionData?.id]);

  const handleOpenDetailed = (focusMetric?: string) => {
    if (sessionData) {
      persistLatestSession(sessionData, calibrationResult);
    }
    navigate('/results/detailed', { state: { focusMetric, sessionId: sessionData?.id } });
  };

  if (!sessionData || !analytics) {
    return (
      <div className="results-page">
        <div className="loading">Loading results...</div>
      </div>
    );
  }

  return (
    <div className="results-page">
      {/* Header */}
      <header className="results-header">
        <div className="header-content">
          <h1>Training Results</h1>
          <div className="header-meta">
            <span>{new Date(sessionData.date).toLocaleString()}</span>
            <span>•</span>
            <span>{sessionData.duration}s session</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="results-main">
        {/* Key Metrics Section - UPDATED */}
        {(!isCalibrationValidated || missingRawData) && (
          <div className="alert-banner warning" role="alert">
            {!isCalibrationValidated
              ? '캘리브레이션이 완료되지 않아 정확도가 낮을 수 있습니다. 다시 캘리브레이션 후 측정해 보세요.'
              : '원시 데이터가 비어 있어 요약값으로 표시 중입니다. 트레이닝을 다시 실행해 주세요.'}
          </div>
        )}

        {/* Key Metrics */}
        <section className="metrics-section">
          {/* --- 상세 페이지 이동 버튼 --- */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <button 
              className="secondary-button" 
              onClick={() => handleOpenDetailed()}
              style={{ fontSize: '0.9rem', padding: '8px 16px' }}
            >
              View Detailed Analysis &rarr;
            </button>
          </div>
          <h2>Performance Overview</h2>
          <div className="metrics-grid">
            {/* 1. Targets Hit */}
            <button
              type="button"
              className="metric-card actionable highlight"
              onClick={() => handleOpenDetailed('targets')}
            >
              <div className="metric-icon">🎯</div>
              <div className="metric-content">
                <div className="metric-value">
                  {analytics.targetsHit}/{analytics.totalTargets}
                </div>
                <div className="metric-label">Targets Hit</div>
                <div className="metric-desc">전체 타겟 대비 명중 횟수</div>
              </div>
            </button>

            {/* 2. Avg Reaction Time (Mouse) */}
            <button
              type="button"
              className="metric-card actionable"
              onClick={() => handleOpenDetailed('reaction')}
            >
              <div className="metric-icon">⚡</div>
              <div className="metric-content">
                <div className="metric-value">
                  {analytics.avgReactionTime.toFixed(0)}ms
                </div>
                <div className="metric-label">Avg Reaction</div>
                <div className="metric-desc">타겟 등장 후 클릭까지 평균 시간</div>
              </div>
            </button>

            {/* 3. Gaze Reaction Time (Eye) - NEW */}
            <button
              type="button"
              className="metric-card actionable"
              onClick={() => handleOpenDetailed('gaze')}
            >
              <div className="metric-icon">👁️</div>
              <div className="metric-content">
                <div className="metric-value">
                  {analytics.avgGazeReactionTime.toFixed(0)}ms
                </div>
                <div className="metric-label">Gaze Reaction</div>
                <div className="metric-desc">타겟 등장 후 시선 도달 시간</div>
              </div>
            </button>

            {/* 4. Gaze-Aim Latency - NEW */}
            <button
              type="button"
              className="metric-card actionable"
              onClick={() => handleOpenDetailed('reaction')}
            >
              <div className="metric-icon">⏱️</div>
              <div className="metric-content">
                <div className="metric-value">
                  {analytics.gazeAimLatency.toFixed(0)}ms
                </div>
                <div className="metric-label">Gaze-Aim Latency</div>
                <div className="metric-desc">시선 포착 후 클릭까지의 지연 시간</div>
              </div>
            </button>

            {/* 5. Errors (Gaze / Mouse) - UPDATED from Accuracy */}
            <button
              type="button"
              className="metric-card actionable"
              onClick={() => handleOpenDetailed('accuracy')}
            >
              <div className="metric-icon">📏</div>
              <div className="metric-content">
                <div className="metric-value" style={{ fontSize: '1.5rem' }}>
                   G: {analytics.gazeErrorAtHit.toFixed(0)}px / M: {analytics.mouseErrorAtHit.toFixed(0)}px
                </div>
                <div className="metric-label">Hit Error (Gaze/Mouse)</div>
                <div className="metric-desc">명중 순간 타겟 중심과의 거리 오차</div>
              </div>
            </button>

            {/* 6. Synchronization - NEW */}
            <button
              type="button"
              className="metric-card actionable"
              onClick={() => handleOpenDetailed('mouse')}
            >
              <div className="metric-icon">🔗</div>
              <div className="metric-content">
                <div className="metric-value">
                  {analytics.synchronization.toFixed(0)}px
                </div>
                <div className="metric-label">Synchronization</div>
                <div className="metric-desc">시선과 마우스 커서 간의 평균 거리</div>
              </div>
            </button>
          </div>
        </section>

        {/* Visualizations */}
        <section className="viz-section">
          <h2>Session Visualizations</h2>
          <div className="viz-grid">
            {/* Performance Trends Chart (UPDATED: Clickable) */}
            <div 
              className="viz-card actionable" 
              onClick={() => handleOpenDetailed('trends')}
              style={{ cursor: 'pointer' }}
            >
              <h3>Performance Trends (Error & Sync)</h3>
              <PerformanceLineChart 
                series={performanceSeries} 
                duration={sessionData.duration} 
                hitTimes={hitTimes}
              />
            </div>

            {/* Gaze Heatmap (UPDATED: Clickable) */}
            <div 
              className="viz-card actionable"
              onClick={() => handleOpenDetailed('heatmap')}
              style={{ cursor: 'pointer' }}
            >
              <h3>Gaze Heatmap</h3>
              <div className="heatmap-wrapper">
                {heatmapPoints.length ? (
                  <div
                    className="heatmap-container"
                    ref={heatmapContainerRef}
                    style={{ aspectRatio: `${baseScreenWidth} / ${baseScreenHeight}` }}
                  >
                    <canvas ref={heatmapCanvasRef} className="heatmap-canvas" aria-label="Gaze heatmap" />
                    <div className="heatmap-overlay" aria-hidden="true">
                      <div className="heatmap-grid"></div>
                    </div>
                  </div>
                ) : (
                  <div className="chart-empty">No gaze samples collected for this session.</div>
                )}
                
                {/* UPDATED: Heatmap Legend Added */}
                {heatmapPoints.length > 0 && (
                  <div className="heatmap-legend" style={{ marginTop: '0px', padding: '0 8px' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      fontSize: '0.75rem', 
                      color: '#666', 
                      marginBottom: '4px',
                      fontWeight: 500
                    }}>
                      <span>Low Focus</span>
                      <span>High Focus</span>
                    </div>
                    <div style={{
                      height: '6px',
                      width: '100%',
                      background: 'linear-gradient(to right, hsla(240, 100%, 50%, 0.5), hsla(180, 100%, 50%, 0.6), hsla(120, 100%, 50%, 0.7), hsla(60, 100%, 50%, 0.8), hsla(0, 100%, 50%, 0.9))',
                      borderRadius: '4px'
                    }} aria-label="Heatmap density legend from blue (low) to red (high)"></div>
                  </div>
                )}

                <div className="heatmap-footer">
                  <p className="viz-description">
                    Visualize where your gaze was focused during the session
                  </p>
                  {heatmapPoints.length > 0 && (
                    <div className="heatmap-meta">
                      <span>{heatmapPoints.length} gaze samples</span>
                      <span>
                        Rendered at {Math.round(baseScreenWidth)} × {Math.round(baseScreenHeight)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Raw Data */}
        <section className="data-section">
          <h2>Session Data</h2>
          <div className="data-actions">
            {autoUploadStatus === 'error' && (
              <span className="upload-status error">Automatic upload failed. You can retry below.</span>
            )}
            <button
              className="download-button"
              onClick={() => handleExport({ upload: false })}
              disabled={isExporting}
            >
              {isExporting ? 'Preparing…' : 'Download CSV'}
            </button>
            {autoUploadStatus === 'success' ? (
              <span className="upload-status success upload-status-inline">
                CSV automatically uploaded to Firebase Storage.
              </span>
            ) : (
              <button
                className="upload-button"
                onClick={handleManualUpload}
                disabled={isExporting}
              >
                {isExporting
                  ? 'Uploading…'
                  : autoUploadStatus === 'error'
                    ? 'Retry Upload'
                    : 'Upload to Firebase Storage'}
              </button>
            )}
            <button className="secondary-button" onClick={handleTrainAgain}>
              Train Again
            </button>
            <button className="secondary-button" onClick={handleBackToDashboard}>
              Back to Dashboard
            </button>
          </div>
        </section>
      </main>
      {toast && (
        <div className={`toast ${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
      {/* --- 연구 감사 인사용 페이지 이동 영역--- */}
      <div className="finish-action-area" style={{ 
        marginTop: '-50px', 
        padding: '15px', 
        textAlign: 'center',
        borderTop: '0.5px solid #eee' 
      }}>
        <p style={{ marginBottom: '15px', color: '#ffffffff' }}>
          모든 결과를 확인하셨나요? 아래 버튼을 눌러 연구 참여를 종료해 주세요.
        </p>
        <button 
          onClick={() => navigate('/thank-you')}
          style={{
            padding: '15px 40px',
            fontSize: '1rem',
            fontWeight: 'bold',
            backgroundColor: '#760215ff', // 혹은 기존 테마의 primary color
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(36, 26, 26, 0.1)'
          }}
        >
          연구 참여 종료하기
        </button>
      </div>
    </div>
  );
};

export default ResultsPage;