import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Info, Maximize2, Target } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import './DetailedResultsPage.css';
import {
  CalibrationResult,
  TrainingDataPoint,
  TrainingSessionSummary,
  useTrackingSession,
} from '../state/trackingSessionContext';
import { useTranslation } from '../state/languageContext';
import { loadStoredCalibration, loadStoredSession, persistLatestSession } from '../utils/resultsStorage';
import { calculatePerformanceAnalytics, generateErrorTimeSeries } from '../utils/analytics';
import type { PerformanceAnalytics } from '../utils/analytics';
import { predictScore } from '../services/predictionService';

// UPDATED: Added 'trends' and 'heatmap' to focus metrics
type FocusMetric = 'accuracy' | 'targets' | 'reaction' | 'gaze' | 'mouse' | 'trends' | 'heatmap';

const vizDescriptions: Record<'trends' | 'rolling' | 'velocity' | 'heatmap', string> = {
  trends: '시간 흐름에 따른 시선·마우스 오차와 동기화 추세를 확인합니다.',
  rolling: '최근 윈도우 기준의 정확도, 초당 히트, 히트 타이밍을 보여줍니다.',
  velocity: '마우스 속도와 반응 시간을 한눈에 비교합니다.',
  heatmap: '세션 동안의 시선 집중 분포를 시각화합니다.',
};

interface ErrorStats {
  avg: number;
  median: number;
  p95: number;
  max: number;
  samples: number;
}

interface HitIntervals {
  avg: number;
  min: number;
  max: number;
  samples: number;
}

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
  fill?: boolean;
  showPoints?: boolean;
};

type HeatmapPoint = { x: number; y: number };
type TargetSampleSummary = {
  targetId: string;
  gazeErr: number | null;
  mouseErr: number | null;
  targetHit: boolean;
  timeToHitMs: number | null;
  lastTimestamp: number;
  firstTimestamp: number;
};

type ReplayFrame = TrainingDataPoint & {
  displayGazeX: number | null;
  displayGazeY: number | null;
  displayMouseX: number | null;
  displayMouseY: number | null;
};

// --- Shared drag-to-pan helper ---
const useDragToScroll = (enabled: boolean) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || event.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    event.preventDefault();
    start.current = { x: event.clientX, y: event.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    setDragging(true);
    el.setPointerCapture?.(event.pointerId);
  }, [enabled]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || !dragging) return;
    const el = ref.current;
    if (!el) return;
    const { x, y, scrollLeft, scrollTop } = start.current;
    el.scrollLeft = scrollLeft - (event.clientX - x);
    el.scrollTop = scrollTop - (event.clientY - y);
  }, [dragging, enabled]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    const el = ref.current;
    if (el?.hasPointerCapture?.(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
  }, [dragging]);

  return {
    ref,
    dragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: endDrag,
    handlePointerLeave: endDrag,
    handlePointerCancel: endDrag,
  };
};

const metricTooltips: Record<string, string> = {
  accuracy: '명중률은 교전 성공률과 직접 연결됩니다. 높은 명중률은 라운드 승률을 끌어올립니다.',
  reaction: '반응 속도가 빠를수록 첫 발 이점을 확보해 피킹/트레이드에서 유리합니다.',
  gaze: '시선 반응은 목표 포착 속도를 의미하며, 인게임 정보 수집과 트래킹 정확도를 좌우합니다.',
  gazeAim: '눈-손 딜레이가 짧을수록 시선과 사격이 한몸처럼 맞물려 교전 시간이 줄어듭니다.',
  sync: '시선-마우스 동기화는 시선이 향한 곳으로 총구가 따라가는 정도로, 플릭·트래킹 일관성을 높입니다.',
  coverage: '높은 커버리지는 더 신뢰도 높은 데이터와 정확한 분석을 보장합니다.',
};

type RankLevel = {
  key: 'trainee' | 'green' | 'blue' | 'indigo' | 'purple';
  labelKo: string;
  labelEn: string;
  min: number;
  max: number;
  color: string;
};

const rankLevels: RankLevel[] = [
  { key: 'trainee', labelKo: '훈련병', labelEn: 'Grey Trainee', min: 0, max: 19.9, color: '#9E9E9E' },
  { key: 'green', labelKo: '연습 사수', labelEn: 'Green Shooter', min: 20, max: 39.9, color: '#4CAF50' },
  { key: 'blue', labelKo: '초급 사수', labelEn: 'Blue Shooter', min: 40, max: 59.9, color: '#2196F3' },
  { key: 'indigo', labelKo: '중급 사수', labelEn: 'Indigo Shooter', min: 60, max: 79.9, color: '#3F51B5' },
  { key: 'purple', labelKo: '고급 사수', labelEn: 'Purple Marksman', min: 80, max: 100, color: '#9C27B0' },
];

const getRankLevel = (score: number | null): RankLevel => {
  if (score === null || Number.isNaN(score)) {
    return rankLevels[0];
  }
  const clamped = Math.min(100, Math.max(0, score));
  return rankLevels.find(level => clamped >= level.min && clamped <= level.max) ?? rankLevels[rankLevels.length - 1];
};

const metricDetailLevel = (
  key: 'accuracy' | 'reaction' | 'gaze' | 'gazeAim' | 'sync' | 'coverage',
  analytics: PerformanceAnalytics,
  coverage?: { gaze: number; mouse: number },
) => {
  const badColor = '#ff6b6b';
  const midColor = '#f1c40f';
  const goodColor = '#66d9ff';

  switch (key) {
    case 'accuracy': {
      const ratio = analytics.totalTargets > 0 ? analytics.targetsHit / analytics.totalTargets : 0;
      if (ratio >= 0.8) return { label: '상위권 명중률', color: goodColor };
      if (ratio >= 0.5) return { label: '보통 명중률', color: midColor };
      return { label: '명중률 개선 필요', color: badColor };
    }
    case 'reaction': {
      const v = analytics.avgReactionTime;
      if (v <= 300) return { label: '반응 속도 우수', color: goodColor };
      if (v <= 600) return { label: '평균 반응 속도', color: midColor };
      return { label: '반응 속도 개선 필요', color: badColor };
    }
    case 'gaze': {
      const v = analytics.avgGazeReactionTime;
      if (v <= 250) return { label: '시선 포착 빠름', color: goodColor };
      if (v <= 450) return { label: '시선 포착 보통', color: midColor };
      return { label: '시선 포착 지연', color: badColor };
    }
    case 'gazeAim': {
      const v = analytics.gazeAimLatency;
      if (v <= 300) return { label: '눈-손 딜레이 짧음', color: goodColor };
      if (v <= 600) return { label: '눈-손 딜레이 보통', color: midColor };
      return { label: '딜레이 개선 필요', color: badColor };
    }
    case 'sync': {
      const v = analytics.synchronization;
      if (v <= 120) return { label: '시선-마우스 잘 맞음', color: goodColor };
      if (v <= 200) return { label: '동기화 보통', color: midColor };
      return { label: '동기화 개선 필요', color: badColor };
    }
    case 'coverage': {
      const gazeCov = coverage?.gaze ?? 0;
      const mouseCov = coverage?.mouse ?? 0;
      const avgCov = (gazeCov + mouseCov) / 2;
      if (avgCov >= 90) return { label: '데이터 커버 우수', color: goodColor };
      if (avgCov >= 70) return { label: '데이터 커버 보통', color: midColor };
      return { label: '데이터 커버 부족', color: badColor };
    }
    default:
      return { label: '', color: '#d8ddf3' };
  }
};

type DetailMetricKey = 'accuracy' | 'reaction' | 'gaze' | 'gazeAim' | 'sync' | 'coverage';
type MetricPercentile = { value: number; label: string };

const clampPercentile = (value: number): number => Math.min(99, Math.max(1, Math.round(value)));
const formatPercentileLabel = (value: number) => `상위 ${clampPercentile(value)}%`;

const metricPercentile = (
  key: DetailMetricKey,
  analytics: PerformanceAnalytics,
  coverage?: { gaze: number; mouse: number }
): MetricPercentile => {
  switch (key) {
    case 'accuracy': {
      const ratio = analytics.totalTargets > 0 ? analytics.targetsHit / analytics.totalTargets : 0;
      if (ratio >= 0.9) return { value: 10, label: formatPercentileLabel(10) };
      if (ratio >= 0.8) return { value: 20, label: formatPercentileLabel(20) };
      if (ratio >= 0.65) return { value: 40, label: formatPercentileLabel(40) };
      if (ratio >= 0.5) return { value: 60, label: formatPercentileLabel(60) };
      return { value: 85, label: formatPercentileLabel(85) };
    }
    case 'reaction': {
      const v = analytics.avgReactionTime;
      if (v <= 200) return { value: 10, label: formatPercentileLabel(10) };
      if (v <= 250) return { value: 25, label: formatPercentileLabel(25) };
      if (v <= 300) return { value: 50, label: formatPercentileLabel(50) };
      if (v <= 350) return { value: 70, label: formatPercentileLabel(70) };
      return { value: 90, label: formatPercentileLabel(90) };
    }
    case 'gaze': {
      const v = analytics.avgGazeReactionTime;
      if (v <= 200) return { value: 12, label: formatPercentileLabel(12) };
      if (v <= 250) return { value: 25, label: formatPercentileLabel(25) };
      if (v <= 350) return { value: 45, label: formatPercentileLabel(45) };
      if (v <= 450) return { value: 65, label: formatPercentileLabel(65) };
      return { value: 88, label: formatPercentileLabel(88) };
    }
    case 'gazeAim': {
      const v = analytics.gazeAimLatency;
      if (v <= 250) return { value: 15, label: formatPercentileLabel(15) };
      if (v <= 400) return { value: 35, label: formatPercentileLabel(35) };
      if (v <= 600) return { value: 60, label: formatPercentileLabel(60) };
      return { value: 85, label: formatPercentileLabel(85) };
    }
    case 'sync': {
      const v = analytics.synchronization;
      if (v <= 90) return { value: 15, label: formatPercentileLabel(15) };
      if (v <= 140) return { value: 35, label: formatPercentileLabel(35) };
      if (v <= 200) return { value: 60, label: formatPercentileLabel(60) };
      return { value: 85, label: formatPercentileLabel(85) };
    }
    case 'coverage': {
      const gazeCov = coverage?.gaze ?? 0;
      const mouseCov = coverage?.mouse ?? 0;
      const avgCov = (gazeCov + mouseCov) / 2;
      if (avgCov >= 95) return { value: 12, label: formatPercentileLabel(12) };
      if (avgCov >= 85) return { value: 28, label: formatPercentileLabel(28) };
      if (avgCov >= 70) return { value: 48, label: formatPercentileLabel(48) };
      if (avgCov >= 55) return { value: 68, label: formatPercentileLabel(68) };
      return { value: 88, label: formatPercentileLabel(88) };
    }
    default:
      return { value: 50, label: formatPercentileLabel(50) };
  }
};

// --- Zoom Control Component ---
const ZoomControls = ({ 
  scale, 
  onZoomIn, 
  onZoomOut, 
  onReset 
}: { 
  scale: number; 
  onZoomIn: () => void; 
  onZoomOut: () => void; 
  onReset: () => void; 
}) => (
  <div className="zoom-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
    <button 
      className="detail-button small" 
      onClick={onZoomOut} 
      disabled={scale <= 1}
      style={{ padding: '4px 12px', minWidth: '32px' }}
    >
      -
    </button>
    <span style={{ fontSize: '0.9rem', minWidth: '40px', textAlign: 'center', fontWeight: 500 }}>
      {Math.round(scale * 100)}%
    </span>
    <button 
      className="detail-button small" 
      onClick={onZoomIn} 
      disabled={scale >= 4}
      style={{ padding: '4px 12px', minWidth: '32px' }}
    >
      +
    </button>
    <button 
      className="detail-button small ghost" 
      onClick={onReset}
      style={{ padding: '4px 12px', marginLeft: '4px' }}
    >
      Reset
    </button>
  </div>
);

// --- PerformanceLineChart Component (UPDATED with filtering) ---
const PerformanceLineChart = ({
  series,
  duration,
  hitTimes = [],
  zoomLevel = 1,
  showHitMarkers = true, // NEW: 마커 표시 여부 제어
  yAxisLabel = 'Error (px)',
  constrainHeight = false,
  tickDensityMultiplier = 1,
  enablePan = false,
}: {
  series: SeriesConfig[];
  duration: number;
  hitTimes?: number[];
  zoomLevel?: number;
  showHitMarkers?: boolean;
  yAxisLabel?: string;
  constrainHeight?: boolean;
  tickDensityMultiplier?: number;
  enablePan?: boolean;
}) => {
  const activeSeries = series.filter(s => s.points.some(p => p.value !== null));

  // 데이터가 없고 마커도 안 보여준다면 빈 화면 처리
  if (!activeSeries.length && (!showHitMarkers || !hitTimes.length)) {
    return <div className="chart-empty">No data selected to display.</div>;
  }

  const width = 700; 
  const height = 320;
  const basePadding = 56;
  
  // X축 최대값: 시리즈가 없으면 duration 기준
  const xMax = Math.max(duration, ...activeSeries.map(s => s.points.at(-1)?.time ?? 0), 1);
  
  // Y축 최대값: 시리즈가 없으면 기본 100
  const allValues = activeSeries.flatMap(s => s.points.map(p => p.value).filter((v): v is number => v !== null));
  const maxVal = allValues.length ? Math.max(...allValues) : 100;
  const yMax = Math.ceil(maxVal * 1.1);

  const xTickCount = Math.max(6, Math.round(6 * zoomLevel * tickDensityMultiplier));
  const yTickCount = Math.max(5, Math.round(5 * zoomLevel * tickDensityMultiplier));

  const xTickValues = Array.from({ length: xTickCount }, (_, i) => {
    const value = (xMax / (xTickCount - 1 || 1)) * i;
    return Number(value.toFixed(1));
  });

  const yTickValues = Array.from({ length: yTickCount }, (_, i) => {
    const value = (yMax / (yTickCount - 1 || 1)) * i;
    return Number(value.toFixed(1));
  });

  const formatTime = (seconds: number) => (seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(1)}s`);

  const longestYLabelChars = yTickValues.reduce((max, val) => Math.max(max, val.toString().length), 0);
  const paddingLeft = Math.max(basePadding, 24 + longestYLabelChars * 7);
  const paddingRight = basePadding;
  const paddingTop = basePadding;
  const paddingBottom = basePadding;
  const yLabelX = Math.max(16, paddingLeft - 40);

  const xScale = (time: number) => paddingLeft + (time / xMax) * (width - paddingLeft - paddingRight);
  const yScale = (value: number) =>
    height - paddingBottom - (value / yMax) * (height - paddingTop - paddingBottom);

  const canPan = enablePan && zoomLevel > 1;
  const {
    ref: panRef,
    dragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handlePointerCancel,
  } = useDragToScroll(canPan);

  const wrapperStyle: CSSProperties = constrainHeight
    ? {
        overflow: 'auto',
        maxWidth: '100%',
        maxHeight: '70vh',
        height: '100%',
        flex: 1,
        minHeight: 360,
        cursor: canPan ? (dragging ? 'grabbing' : 'grab') : undefined,
      }
    : {
        overflowX: 'auto',
        overflowY: 'visible',
        maxWidth: '100%',
        cursor: canPan ? (dragging ? 'grabbing' : 'grab') : undefined,
      };

  return (
    <div
      className="chart-scroll-wrapper"
      ref={panRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
      style={wrapperStyle}
    >
      <div
        style={{
          width: `${zoomLevel * 100}%`,
          height: `${zoomLevel * 100}%`,
          minWidth: '100%',
          minHeight: '100%',
          position: 'relative',
          transition: 'width 0.2s ease-out, height 0.2s ease-out',
        }}
      >
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="chart-svg" 
          role="img" 
          aria-label="Performance trends over time" 
          style={{ width: '100%', height: '100%', display: 'block' }} 
        >
          <defs>
            {activeSeries.map(({ gradientId, color }) => (
              <linearGradient key={gradientId} id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={color} stopOpacity="0.1" />
              </linearGradient>
            ))}
          </defs>

          <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} className="chart-axis" />
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} className="chart-axis" />

          {xTickValues.map(tick => (
            <line key={`x-${tick}`} x1={xScale(tick)} x2={xScale(tick)} y1={paddingTop} y2={height - paddingBottom} className="chart-grid" />
          ))}
          {yTickValues.map(tick => (
            <line key={`y-${tick}`} x1={paddingLeft} x2={width - paddingRight} y1={yScale(tick)} y2={yScale(tick)} className="chart-grid" />
          ))}

          {/* NEW: Conditional rendering for hit markers */}
          {showHitMarkers && hitTimes.map((time, idx) => (
            <g key={`hit-${idx}`}>
              <line x1={xScale(time)} x2={xScale(time)} y1={paddingTop} y2={height - paddingBottom} stroke="rgba(127, 9, 9, 0.79)" strokeWidth="1.5" strokeDasharray="4 4" />
              <circle cx={xScale(time)} cy={height - paddingBottom} r={3} fill="#871212ff" opacity="0.8" />
            </g>
          ))}

          {xTickValues.map(tick => (
            <text key={`xlabel-${tick}`} x={xScale(tick)} y={height - paddingBottom + 24} className="chart-label" textAnchor="middle">{formatTime(tick)}</text>
          ))}
          {yTickValues.map(tick => (
            <text key={`ylabel-${tick}`} x={paddingLeft - 12} y={yScale(tick) + 4} className="chart-label" textAnchor="end">{tick}</text>
          ))}

          <text x={(width + paddingLeft - paddingRight) / 2} y={height - 12} className="chart-axis-title" textAnchor="middle">Time (seconds)</text>
          <text x={yLabelX} y={height / 2} className="chart-axis-title" textAnchor="middle" transform={`rotate(-90 ${yLabelX} ${height / 2})`}>
            {yAxisLabel}
          </text>

          {activeSeries.map(({ key, points, gradientId, color, fill = true, showPoints = false }) => {
            const validPoints = points.filter(p => p.value !== null) as { time: number, value: number }[];
            if (!validPoints.length) return null;
            const pathD = validPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${xScale(point.time)},${yScale(point.value)}`).join(' ');
            return (
              <g key={key}>
                {validPoints.length >= 2 && (
                  <>
                    <path d={pathD} className="chart-line" stroke={color} strokeWidth="2" fill="none" />
                    {fill && (
                      <path
                        d={`${pathD} L${xScale(validPoints[validPoints.length-1].time)},${height - paddingBottom} L${xScale(validPoints[0].time)},${height - paddingBottom} Z`}
                        fill={`url(#${gradientId})`}
                        stroke="none"
                      />
                    )}
                  </>
                )}
                {showPoints && validPoints.map(point => (
                  <circle key={`${key}-${point.time}`} cx={xScale(point.time)} cy={yScale(point.value)} r={3} fill={color} opacity={0.95} />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
       <div className="chart-legend" style={{marginTop: '12px'}}>
        {activeSeries.map(({ key, label, color }) => (
          <div key={key} className="legend-item">
            <span className="legend-swatch" style={{ backgroundColor: color }} />
            <span className="legend-label">{label}</span>
          </div>
        ))}
        {/* NEW: Conditional legend item */}
        {showHitMarkers && (
          <div className="legend-item">
            <span className="legend-swatch legend-swatch--hit" />
            <span className="legend-label">Hits</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ... [Helper functions remain unchanged] ...
const percentile = (values: number[], percentileRank: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((percentileRank / 100) * sorted.length));
  return sorted[idx];
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const calculateCoverage = (data: TrainingDataPoint[]) => {
  if (!data.length) return { gaze: 0, mouse: 0 };
  
  const gazeSamples = data.filter(d => d.gazeX !== null && d.gazeY !== null).length;
  const mouseSamples = data.filter(d => d.mouseX !== null && d.mouseY !== null).length;

  return {
    gaze: (gazeSamples / data.length) * 100,
    mouse: (mouseSamples / data.length) * 100,
  };
};

const calculateErrorStats = (data: TrainingDataPoint[], mode: 'gaze' | 'mouse'): ErrorStats => {
  const errors: number[] = [];
  data.forEach(point => {
    const targetX = point.targetX;
    const targetY = point.targetY;
    const sourceX = mode === 'gaze' ? point.gazeX : point.mouseX;
    const sourceY = mode === 'gaze' ? point.gazeY : point.mouseY;

    if (targetX === null || targetY === null || sourceX === null || sourceY === null) return;
    errors.push(Math.hypot(sourceX - targetX, sourceY - targetY));
  });

  if (!errors.length) return { avg: 0, median: 0, p95: 0, max: 0, samples: 0 };

  return {
    avg: errors.reduce((a, b) => a + b, 0) / errors.length,
    median: median(errors),
    p95: percentile(errors, 95),
    max: Math.max(...errors),
    samples: errors.length,
  };
};

const calculateHitIntervals = (data: TrainingDataPoint[]): HitIntervals => {
  const hitTimes = data.filter(d => d.targetHit).map(d => d.timestamp).sort((a, b) => a - b);
  if (hitTimes.length < 2) return { avg: 0, min: 0, max: 0, samples: hitTimes.length };
  const deltas = hitTimes.slice(1).map((time, idx) => time - hitTimes[idx]);
  return {
    avg: deltas.reduce((a, b) => a + b, 0) / deltas.length,
    min: Math.min(...deltas),
    max: Math.max(...deltas),
    samples: deltas.length,
  };
};

const DetailedResultsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useTranslation();
  const focusMetric = (location.state as { focusMetric?: FocusMetric } | null)?.focusMetric;
  const { activeSession, calibrationResult } = useTrackingSession();

  const [sessionData, setSessionData] = useState<TrainingSessionSummary | null>(activeSession);
  const [calibration, setCalibration] = useState<CalibrationResult | null>(calibrationResult);
  const [predictedScore, setPredictedScore] = useState<number | null>(null);
  const [isPredictingScore, setIsPredictingScore] = useState(false);

  const [replayTargetId, setReplayTargetId] = useState<string | null>(null);
  const [replayTargetIndex, setReplayTargetIndex] = useState<number | null>(null);


  const [replaySamples, setReplaySamples] = useState<TrainingDataPoint[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(0.2);

  // --- NEW: Metric Visibility State ---
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({
    'gaze-error': true,
    'mouse-error': true,
    'synchronization': true,
    'hit-moment': true,
  });

  const [activeModal, setActiveModal] = useState<'trends' | 'rolling' | 'velocity' | 'heatmap' | null>(null);
  const [modalZoom, setModalZoom] = useState(1);
  const modalHeatmapPan = useDragToScroll(activeModal === 'heatmap' && modalZoom > 1);

  const [rollingVisibility, setRollingVisibility] = useState<Record<string, boolean>>({
    'rolling-accuracy': true,
    'rolling-hps': true,
    'rolling-hits': true,
  });

  const [velocityVisibility, setVelocityVisibility] = useState<Record<string, boolean>>({
    'mouse-velocity': true,
    'reaction-time': true,
    'velocity-hits': false,
  });

  const rollingWindowSeconds = 3;

  const toggleMetric = (key: string) => {
    setVisibleMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleRollingMetric = (key: string) => {
    setRollingVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleVelocityMetric = (key: string) => {
    setVelocityVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatText = (key: string, fallback: string, params: Record<string, string | number>) => {
    let text = t(key, fallback);
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
    return text;
  };

  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatmapContainerRef = useRef<HTMLDivElement | null>(null);
  const modalHeatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalHeatmapContainerRef = useRef<HTMLDivElement | null>(null);

  const openModal = (type: 'trends' | 'rolling' | 'velocity' | 'heatmap') => {
    setActiveModal(type);
    setModalZoom(1);
  };

  const closeModal = () => setActiveModal(null);

  const handleModalWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.2 : 0.2;
    setModalZoom(prev => Math.max(0.8, Math.min(3, +(prev + direction).toFixed(2))));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };
    if (activeModal) {
      window.addEventListener('keydown', onKeyDown);
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal]);

  useEffect(() => {
    if (activeSession) {
      setSessionData(activeSession);
      persistLatestSession(activeSession, calibrationResult ?? calibration);
      return;
    }
    const stored = loadStoredSession();
    if (stored) {
      setSessionData(stored);
    }
  }, [activeSession, calibrationResult, calibration]);

  useEffect(() => {
    if (calibrationResult) {
      setCalibration(calibrationResult);
    } else {
      const storedCalibration = loadStoredCalibration();
      if (storedCalibration) {
        setCalibration(storedCalibration);
      }
    }
  }, [calibrationResult]);

  // 세션이 바뀔 때 예측 점수를 초기화 (목업 값 표시 방지)
  useEffect(() => {
    setPredictedScore(null);
  }, [sessionData?.id]);

  useEffect(() => {
    let cancelled = false;

    const runPrediction = async () => {
      if (!sessionData) {
        setPredictedScore(null);
        return;
      }

      // 이전 값 제거 후 새 예측 시작해 초기 75 노출 방지
      setPredictedScore(null);
      setIsPredictingScore(true);
      try {
        const result = await predictScore(sessionData);
        if (!cancelled) {
          setPredictedScore(result.predictedScore ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to predict score on detail page:', error);
          setPredictedScore(null);
        }
      } finally {
        if (!cancelled) {
          setIsPredictingScore(false);
        }
      }
    };

    runPrediction();

    return () => {
      cancelled = true;
    };
  }, [sessionData]);

  // ResultsPage와 동일한 Analytics 사용
  const analytics = useMemo(() => sessionData ? calculatePerformanceAnalytics(sessionData.rawData) : null, [sessionData]);
  
  // Coverage는 별도 계산
  const coverage = useMemo(() => sessionData ? calculateCoverage(sessionData.rawData) : null, [sessionData]);
  const gazeError = useMemo(() => sessionData ? calculateErrorStats(sessionData.rawData, 'gaze') : null, [sessionData]);
  const mouseError = useMemo(() => sessionData ? calculateErrorStats(sessionData.rawData, 'mouse') : null, [sessionData]);
  const hitIntervals = useMemo(() => sessionData ? calculateHitIntervals(sessionData.rawData) : null, [sessionData]);

  const dataQuality = useMemo(() => {
    if (!sessionData || !analytics || !coverage) return null;
    const total = sessionData.rawData.length || 1;
    const withTargets = sessionData.rawData.filter(d => d.targetX !== null && d.targetY !== null).length;
    return {
      withTargetsPct: (withTargets / total) * 100,
      gazeCoverage: coverage.gaze,
      mouseCoverage: coverage.mouse,
      hitRate: analytics.totalTargets > 0 ? (analytics.targetsHit / analytics.totalTargets) * 100 : 0,
    };
  }, [analytics, coverage, sessionData]);

  const sortedRawData = useMemo(() => {
    if (!sessionData?.rawData.length) return [] as TrainingDataPoint[];
    return [...sessionData.rawData].sort((a, b) => a.timestamp - b.timestamp);
  }, [sessionData]);

  const recentTargets = useMemo<TargetSampleSummary[]>(() => {
    if (!sortedRawData.length) return [];

    const withTargetId = sortedRawData.filter(point => point.targetId !== null);
    if (!withTargetId.length) return [];

    const summaries = new Map<
      string,
      {
        firstTimestamp: number;
        lastSample: TrainingDataPoint;
        hitTimestamp: number | null;
        preHitSample: TrainingDataPoint | null;
      }
    >();

    withTargetId.forEach(point => {
      const targetId = point.targetId as string;
      const existing = summaries.get(targetId);

      const firstTimestamp = existing ? existing.firstTimestamp : point.timestamp;
      let hitTimestamp = existing?.hitTimestamp ?? null;
      let lastSample = !existing || point.timestamp >= existing.lastSample.timestamp ? point : existing.lastSample;
      let preHitSample = existing?.preHitSample ?? null;

      if (hitTimestamp === null) {
        if (point.targetHit) {
          hitTimestamp = point.timestamp;
          preHitSample = existing?.lastSample ?? point;
        } else {
          preHitSample = point;
        }
      }

      summaries.set(targetId, { firstTimestamp, lastSample, hitTimestamp, preHitSample });
    });

    return Array.from(summaries.entries())
      .map(([targetId, { firstTimestamp, lastSample, hitTimestamp, preHitSample }]) => {
        const sampleForError = hitTimestamp !== null ? preHitSample ?? lastSample : lastSample;
        const gazeErr = sampleForError.targetX !== null && sampleForError.targetY !== null && sampleForError.gazeX !== null && sampleForError.gazeY !== null
          ? Math.hypot(sampleForError.gazeX - sampleForError.targetX, sampleForError.gazeY - sampleForError.targetY)
          : null;
        const mouseErr = sampleForError.targetX !== null && sampleForError.targetY !== null && sampleForError.mouseX !== null && sampleForError.mouseY !== null
          ? Math.hypot(sampleForError.mouseX - sampleForError.targetX, sampleForError.mouseY - sampleForError.targetY)
          : null;
        const timeToHitMs = hitTimestamp !== null ? hitTimestamp - firstTimestamp : null;

        return {
          targetId,
          gazeErr,
          mouseErr,
          targetHit: hitTimestamp !== null,
          timeToHitMs,
          lastTimestamp: lastSample.timestamp,
          firstTimestamp,
        };
      })
      .sort((a, b) => a.firstTimestamp - b.firstTimestamp);
  }, [sortedRawData]);

  const performanceSeries = useMemo<SeriesConfig[]>(() => {
    if (!sessionData) return [];
    const timeSeries = generateErrorTimeSeries(sortedRawData, sessionData.duration);
    return [
      { key: 'gaze-error', label: 'Gaze Error', color: '#4ecdc4', gradientId: 'grad-gaze', points: timeSeries.map(p => ({ time: p.time, value: p.gazeError })) },
      { key: 'mouse-error', label: 'Mouse Error', color: '#ffb86c', gradientId: 'grad-mouse', points: timeSeries.map(p => ({ time: p.time, value: p.mouseError })) },
      { key: 'synchronization', label: 'Synchronization', color: '#7a5ff5', gradientId: 'grad-sync', points: timeSeries.map(p => ({ time: p.time, value: p.synchronization })) },
    ];
  }, [sessionData, sortedRawData]);

  // --- NEW: Filter Series Logic ---
  const filteredSeries = useMemo(() => {
    return performanceSeries.filter(s => visibleMetrics[s.key]);
  }, [performanceSeries, visibleMetrics]);

  const hitTimes = useMemo(() => {
    if (!sortedRawData.length) return [];
    const startTime = sortedRawData[0].timestamp;
    return sortedRawData.filter(d => d.targetHit).map(d => (d.timestamp - startTime) / 1000);
  }, [sortedRawData]);

  const rollingPerformance = useMemo(() => {
    if (!sortedRawData.length || !sessionData) {
      return { accuracySeries: [], hpsSeries: [], hitTimes: [] as number[] };
    }

    const sorted = sortedRawData;
    const startTime = sorted[0].timestamp;
    const endTime = sorted.at(-1)?.timestamp ?? startTime;
    const durationSeconds = Math.max(sessionData.duration, Math.ceil((endTime - startTime) / 1000));

    const targetFirstSeen = new Map<string, number>();
    const hitTimestamps: number[] = [];

    sorted.forEach(point => {
      if (point.targetId && !targetFirstSeen.has(point.targetId)) {
        targetFirstSeen.set(point.targetId, point.timestamp);
      }
      if (point.targetHit) {
        hitTimestamps.push(point.timestamp);
      }
    });

    const targetFirstList = Array.from(targetFirstSeen.values()).sort((a, b) => a - b);
    hitTimestamps.sort((a, b) => a - b);

    let targetWindowStart = 0;
    let targetWindowEnd = 0;
    let hitWindowStart = 0;
    let hitWindowEnd = 0;
    const windowMs = rollingWindowSeconds * 1000;

    const accuracySeries: SeriesPoint[] = [];
    const hpsSeries: SeriesPoint[] = [];

    for (let sec = 0; sec <= durationSeconds; sec += 1) {
      const windowEnd = startTime + sec * 1000;
      const windowStart = Math.max(startTime, windowEnd - windowMs);

      while (targetWindowStart < targetFirstList.length && targetFirstList[targetWindowStart] < windowStart) targetWindowStart += 1;
      while (targetWindowEnd < targetFirstList.length && targetFirstList[targetWindowEnd] <= windowEnd) targetWindowEnd += 1;
      while (hitWindowStart < hitTimestamps.length && hitTimestamps[hitWindowStart] < windowStart) hitWindowStart += 1;
      while (hitWindowEnd < hitTimestamps.length && hitTimestamps[hitWindowEnd] <= windowEnd) hitWindowEnd += 1;

      const targetsInWindow = targetWindowEnd - targetWindowStart;
      const hitsInWindow = hitWindowEnd - hitWindowStart;

      accuracySeries.push({ time: sec, value: targetsInWindow ? (hitsInWindow / targetsInWindow) * 100 : null });
      hpsSeries.push({ time: sec, value: hitsInWindow / rollingWindowSeconds });
    }

    return {
      accuracySeries,
      hpsSeries,
      hitTimes: hitTimestamps.map(ts => (ts - startTime) / 1000),
    };
  }, [rollingWindowSeconds, sessionData]);

  const velocityReaction = useMemo(() => {
    if (!sessionData?.rawData.length) {
      return { velocitySeries: [] as SeriesPoint[], reactionPoints: [] as SeriesPoint[], hitTimes: [] as number[] };
    }

    const sorted = [...sessionData.rawData].sort((a, b) => a.timestamp - b.timestamp);
    const startTime = sorted[0].timestamp;
    const endTime = sorted.at(-1)?.timestamp ?? startTime;
    const durationSeconds = Math.max(sessionData.duration, Math.ceil((endTime - startTime) / 1000));

    const velocityBuckets = new Map<number, { sum: number; count: number }>();
    
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      
      const deltaMs = curr.timestamp - prev.timestamp;
      if (deltaMs <= 0) continue;

      // --- FPS Mouse Velocity Calculation Fix ---
      // 1. Priority: Use raw 'movementX/Y' if available (Pointer Lock API standard)
      // 2. Fallback: If mouse coordinates are center-locked (delta ~ 0) and target is tracked,
      //    use Target Screen Displacement as a proxy for Camera Movement.
      //    (Assuming stationary target in world -> Target moves on screen ONLY if camera moves)
      // 3. Legacy: Use absolute mouse position delta (for 2D modes)
      
      let distance = 0;
      
      // Check for raw movement data (Need to cast if type doesn't explicitly have it yet)
      // @ts-ignore - 'movementX' might not be in TrainingDataPoint type yet
      if (curr.movementX !== undefined && curr.movementY !== undefined) {
        // @ts-ignore
        distance = Math.hypot(curr.movementX, curr.movementY);
      } 
      // Check if mouse is effectively static (FPS center lock) but Target moves
      else if (
        curr.mouseX !== null && prev.mouseX !== null &&
        Math.abs(curr.mouseX - prev.mouseX) < 0.01 && // Mouse didn't move on screen
        Math.abs(curr.mouseY! - prev.mouseY!) < 0.01 &&
        curr.targetId === prev.targetId && // Same target (ignore respawn jumps)
        curr.targetX !== null && prev.targetX !== null &&
        curr.targetY !== null && prev.targetY !== null
      ) {
        // In FPS, if I aim RIGHT, the target moves LEFT on screen. 
        // Magnitude of Target Screen Delta ≈ Magnitude of Camera Rotation (in pixels)
        distance = Math.hypot(curr.targetX - prev.targetX, curr.targetY - prev.targetY);
      }
      // Standard 2D fallback
      else if (curr.mouseX !== null && prev.mouseX !== null && curr.mouseY !== null && prev.mouseY !== null) {
        distance = Math.hypot(curr.mouseX - prev.mouseX, curr.mouseY - prev.mouseY);
      }

      const speed = (distance / deltaMs) * 1000; // px per second
      const bucket = Math.floor((curr.timestamp - startTime) / 1000);
      const existing = velocityBuckets.get(bucket) ?? { sum: 0, count: 0 };
      existing.sum += speed;
      existing.count += 1;
      velocityBuckets.set(bucket, existing);
    }

    const velocitySeries: SeriesPoint[] = [];
    for (let sec = 0; sec <= durationSeconds; sec += 1) {
      const bucket = velocityBuckets.get(sec);
      velocitySeries.push({ time: sec, value: bucket && bucket.count ? bucket.sum / bucket.count : null });
    }

    const targetFirstSeen = new Map<string, number>();
    const reactionPoints: SeriesPoint[] = [];
    const hitTimes: number[] = [];

    sorted.forEach(point => {
      if (point.targetId && !targetFirstSeen.has(point.targetId)) {
        targetFirstSeen.set(point.targetId, point.timestamp);
      }
      if (point.targetHit) {
        hitTimes.push((point.timestamp - startTime) / 1000);
        if (point.targetId) {
          const firstSeen = targetFirstSeen.get(point.targetId);
          if (firstSeen !== undefined && point.timestamp >= firstSeen) {
            reactionPoints.push({ time: (point.timestamp - startTime) / 1000, value: point.timestamp - firstSeen });
          }
        }
      }
    });

    return { velocitySeries, reactionPoints, hitTimes };
  }, [sessionData]);

  const rollingSeries = useMemo<SeriesConfig[]>(() => [
    {
      key: 'rolling-accuracy',
      label: `Rolling Accuracy (${rollingWindowSeconds}s)`,
      color: '#7c9bff',
      gradientId: 'grad-rolling-acc',
      points: rollingPerformance.accuracySeries,
    },
    {
      key: 'rolling-hps',
      label: 'Hits Per Second',
      color: '#f1c40f',
      gradientId: 'grad-rolling-hps',
      points: rollingPerformance.hpsSeries,
    },
  ], [rollingPerformance.accuracySeries, rollingPerformance.hpsSeries, rollingWindowSeconds]);

  const filteredRollingSeries = useMemo(() => {
    return rollingSeries.filter(s => rollingVisibility[s.key]);
  }, [rollingSeries, rollingVisibility]);

  const velocitySeries = useMemo<SeriesConfig[]>(() => [
    {
      key: 'mouse-velocity',
      label: 'Mouse Velocity (px/s)',
      color: '#4ecdc4',
      gradientId: 'grad-velocity',
      points: velocityReaction.velocitySeries,
    },
    {
      key: 'reaction-time',
      label: 'Reaction Time (ms)',
      color: '#ff6b6b',
      gradientId: 'grad-reaction',
      points: velocityReaction.reactionPoints,
      fill: false,
      showPoints: true,
    },
  ], [velocityReaction.reactionPoints, velocityReaction.velocitySeries]);

  const filteredVelocitySeries = useMemo(() => {
    return velocitySeries.filter(s => velocityVisibility[s.key]);
  }, [velocitySeries, velocityVisibility]);

  // [Heatmap calculation logic remains same]
  const { heatmapPoints, baseScreenWidth, baseScreenHeight } = useMemo(() => {
    if (!sessionData) return { heatmapPoints: [] as HeatmapPoint[], baseScreenWidth: 1920, baseScreenHeight: 1080 };
    const validGazePoints = sessionData.rawData.filter(point => point.gazeX !== null && point.gazeY !== null);
    
    const maxGazeX = validGazePoints.reduce((max, point) => Math.max(max, point.gazeX ?? 0), 0);
    const maxGazeY = validGazePoints.reduce((max, point) => Math.max(max, point.gazeY ?? 0), 0);
    
    const baseScreenWidth = sessionData.screenSize?.width || (maxGazeX || 1920);
    const baseScreenHeight = sessionData.screenSize?.height || (maxGazeY || 1080);
    
    const heatmapPoints = validGazePoints
      .map(point => ({ x: (point.gazeX ?? 0) / baseScreenWidth, y: (point.gazeY ?? 0) / baseScreenHeight }))
      .filter(point => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
    
    return { heatmapPoints, baseScreenWidth, baseScreenHeight };
  }, [sessionData]);

  const drawHeatmap = useCallback((canvasEl?: HTMLCanvasElement | null, containerEl?: HTMLDivElement | null) => {
    const canvas = canvasEl ?? heatmapCanvasRef.current;
    const container = containerEl ?? heatmapContainerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const displayWidth = Math.max(1, Math.round(rect.width));
    const displayHeight = Math.max(1, Math.round(rect.height));

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!heatmapPoints.length) return;

    const gridSize = 64;
    const grid = new Float32Array(gridSize * gridSize);
    let maxCount = 0;

    heatmapPoints.forEach(point => {
      const gx = Math.min(gridSize - 1, Math.max(0, Math.floor(point.x * gridSize)));
      const gy = Math.min(gridSize - 1, Math.max(0, Math.floor(point.y * gridSize)));
      const idx = gy * gridSize + gx;
      grid[idx] += 1;
      if (grid[idx] > maxCount) maxCount = grid[idx];
    });

    if (!maxCount) return;

    const cellWidth = displayWidth / gridSize;
    const cellHeight = displayHeight / gridSize;
    const colorForIntensity = (value: number) => {
      const clamped = Math.min(1, Math.max(0, value));
      const hue = (1 - clamped) * 240;
      const alpha = 0.5 + (clamped * 0.4);
      return `hsla(${hue}, 100%, 50%, ${alpha})`;
    };

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'blur(3px)';
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

  useEffect(() => {
    const container = heatmapContainerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => drawHeatmap());
    resizeObserver.observe(container);
    drawHeatmap();
    return () => resizeObserver.disconnect();
  }, [drawHeatmap, heatmapPoints.length]);

  useEffect(() => {
    if (activeModal !== 'heatmap') return;
    const container = modalHeatmapContainerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => drawHeatmap(modalHeatmapCanvasRef.current, container));
    resizeObserver.observe(container);
    drawHeatmap(modalHeatmapCanvasRef.current, container);
    return () => resizeObserver.disconnect();
  }, [activeModal, drawHeatmap, heatmapPoints.length]);

  useEffect(() => {
    if (activeModal === 'heatmap') {
      drawHeatmap(modalHeatmapCanvasRef.current, modalHeatmapContainerRef.current);
    }
  }, [activeModal, modalZoom, drawHeatmap]);

  const resolveReplayFrame = useCallback((samples: TrainingDataPoint[], index: number): ReplayFrame | null => {
    if (!samples.length) return null;
    const safeIndex = Math.min(index, samples.length - 1);
    const frame = samples[safeIndex];

    const fallback = frame.targetHit
      ? [...samples]
        .slice(0, safeIndex)
        .reverse()
        .find(s => s.targetId === frame.targetId && (s.gazeX !== null || s.mouseX !== null))
      : null;

    return {
      ...frame,
      displayGazeX: frame.gazeX ?? fallback?.gazeX ?? null,
      displayGazeY: frame.gazeY ?? fallback?.gazeY ?? null,
      displayMouseX: frame.mouseX ?? fallback?.mouseX ?? null,
      displayMouseY: frame.mouseY ?? fallback?.mouseY ?? null,
    };
  }, []);

  const openReplayForTarget = useCallback((targetId: string, targetIndex: number) => {
    if (!sortedRawData.length) return;
    const startIdx = sortedRawData.findIndex(p => p.targetId === targetId);
    if (startIdx === -1) return;

    const segment: TrainingDataPoint[] = [];
    for (let i = startIdx; i < sortedRawData.length; i += 1) {
      const point = sortedRawData[i];
      if (point.targetId === targetId) {
        segment.push(point);
        if (point.targetHit && sortedRawData[i + 1]?.targetId !== targetId) {
          break;
        }
      } else if (segment.length) {
        break;
      }
    }

    if (!segment.length) return;

    setReplayTargetId(targetId);
    setReplayTargetIndex(targetIndex); // 순서 저장
    setReplaySamples(segment);
    setReplayIndex(0);
    setIsReplaying(true);
  }, [sortedRawData]);

  useEffect(() => {
    if (!isReplaying || replaySamples.length < 2) return undefined;
    const currentIndex = replayIndex;
    if (currentIndex >= replaySamples.length - 1) {
      setIsReplaying(false);
      return undefined;
    }

    const current = replaySamples[currentIndex];
    const next = replaySamples[currentIndex + 1];
    const delay = Math.max(120, (next.timestamp - current.timestamp) / replaySpeed);

    const timeout = window.setTimeout(() => {
      setReplayIndex(idx => Math.min(idx + 1, replaySamples.length - 1));
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [isReplaying, replayIndex, replaySamples, replaySpeed]);

  const closeReplay = useCallback(() => {
    setIsReplaying(false);
    setReplayTargetId(null);
    setReplayTargetIndex(null); // 추가
    setReplaySamples([]);
    setReplayIndex(0);
  }, []);

  const currentReplayFrame = useMemo(() => resolveReplayFrame(replaySamples, replayIndex), [replaySamples, replayIndex, resolveReplayFrame]);

  const replayBounds = useMemo(() => {
    if (!replaySamples.length) {
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    const consider = (value: number | null, isX: boolean) => {
      if (value === null) return;
      if (isX) {
        minX = Math.min(minX, value);
        maxX = Math.max(maxX, value);
      } else {
        minY = Math.min(minY, value);
        maxY = Math.max(maxY, value);
      }
    };

    replaySamples.forEach((sample, idx) => {
      const frame = resolveReplayFrame(replaySamples, idx);
      if (!frame) return;
      consider(frame.targetX, true);
      consider(frame.targetY, false);
      consider(frame.displayGazeX, true);
      consider(frame.displayGazeY, false);
      consider(frame.displayMouseX, true);
      consider(frame.displayMouseY, false);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    }

    const padX = (maxX - minX || 1) * 0.05;
    const padY = (maxY - minY || 1) * 0.05;

    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY,
    };
  }, [replaySamples, resolveReplayFrame]);

  const replayStartTime = replaySamples[0]?.timestamp ?? 0;
  const replayDurationMs = (replaySamples.at(-1)?.timestamp ?? replayStartTime) - replayStartTime;
  const replayElapsedMs = currentReplayFrame ? currentReplayFrame.timestamp - replayStartTime : 0;
  const replayProgressPct = replayDurationMs > 0 ? Math.min(100, Math.max(0, (replayElapsedMs / replayDurationMs) * 100)) : 0;

  const scrubToProgress = (percent: number) => {
    if (!replaySamples.length || replayDurationMs <= 0) return;
    const clamped = Math.min(100, Math.max(0, percent));
    const targetTime = replayStartTime + (clamped / 100) * replayDurationMs;
    const nextIndex = replaySamples.findIndex(p => p.timestamp >= targetTime);
    if (nextIndex === -1) {
      setReplayIndex(replaySamples.length - 1);
    } else {
      setReplayIndex(nextIndex);
    }
  };

  const projectReplayPoint = useCallback((value: number | null, isX: boolean, size: number) => {
    const min = isX ? replayBounds.minX : replayBounds.minY;
    const max = isX ? replayBounds.maxX : replayBounds.maxY;
    if (value === null || max === min) return null;
    return ((value - min) / (max - min)) * size;
  }, [replayBounds]);

  const handleBack = () => navigate('/results');

  if (!sessionData || !analytics || !coverage) {
    return (
      <div className="detailed-results-page">
        <div className="detail-empty">
          <p>{t('detailed.empty.message', '최근 세션 정보를 찾을 수 없어요.')}</p>
          <button type="button" className="detail-button" onClick={handleBack}>
            {t('detailed.empty.back', '결과 페이지로 돌아가기')}
          </button>
        </div>
      </div>
    );
  }

  // 정확도 계산 (안전하게 0으로 나누기 방지)
  const accuracyPct = analytics.totalTargets > 0 
    ? (analytics.targetsHit / analytics.totalTargets) * 100 
    : 0;

  const rankLevel = useMemo(() => getRankLevel(predictedScore), [predictedScore]);
  const rankLabel = useMemo(
    () => (language === 'ko' ? rankLevel.labelKo : rankLevel.labelEn),
    [language, rankLevel],
  );
  const rankRangeText = useMemo(
    () =>
      rankLevels
        .map(level => {
          const label = language === 'ko' ? level.labelKo : level.labelEn;
          return `${label}: ${level.min}-${level.max}`;
        })
        .join(' • '),
    [language],
  );

  const predictionFactors = useMemo(
    () => {
      if (!sessionData) return [];
      return [
        {
          label: t('detailed.training.factor.accuracy', '명중률'),
          value: `${sessionData.accuracy.toFixed(1)}%`,
          desc: t('detailed.training.factor.accuracyDesc', '타겟 명중률 반영'),
        },
        {
          label: t('detailed.training.factor.tracking', '트래킹'),
          value: `${sessionData.mouseAccuracy.toFixed(1)}%`,
          desc: t('detailed.training.factor.trackingDesc', '마우스-타겟 정렬도'),
        },
        {
          label: t('detailed.training.factor.reaction', '반응'),
          value: `${sessionData.avgReactionTime.toFixed(0)} ms`,
          desc: t('detailed.training.factor.reactionDesc', '평균 클릭 속도'),
        },
      ];
    },
    [sessionData, t],
  );

  const renderModalContent = () => {
    if (!activeModal) return null;

    const titles: Record<'trends' | 'rolling' | 'velocity' | 'heatmap', string> = {
      trends: 'Performance Trends',
      rolling: 'Rolling Performance',
      velocity: 'Velocity & Reaction',
      heatmap: 'Gaze Heatmap',
    };

    const modalBody = (() => {
      if (activeModal === 'trends') {
        return (
          <PerformanceLineChart
            series={filteredSeries}
            duration={sessionData.duration}
            hitTimes={hitTimes}
            zoomLevel={modalZoom}
            enablePan
            showHitMarkers={visibleMetrics['hit-moment']}
            constrainHeight
            tickDensityMultiplier={2}
          />
        );
      }
      if (activeModal === 'rolling') {
        return (
          <PerformanceLineChart
            series={filteredRollingSeries}
            duration={sessionData.duration}
            hitTimes={rollingVisibility['rolling-hits'] ? rollingPerformance.hitTimes : []}
            zoomLevel={modalZoom}
            enablePan
            showHitMarkers={rollingVisibility['rolling-hits']}
            yAxisLabel={`Last ${rollingWindowSeconds}s window`}
            constrainHeight
            tickDensityMultiplier={2}
          />
        );
      }
      if (activeModal === 'velocity') {
        return (
          <PerformanceLineChart
            series={filteredVelocitySeries}
            duration={sessionData.duration}
            hitTimes={velocityVisibility['velocity-hits'] ? velocityReaction.hitTimes : []}
            zoomLevel={modalZoom}
            enablePan
            showHitMarkers={velocityVisibility['velocity-hits']}
            yAxisLabel="Speed (px/s) · Reaction (ms)"
            constrainHeight
            tickDensityMultiplier={2}
          />
        );
      }
      return (
        <div className="heatmap-wrapper" style={{ border: '1px solid #333', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#1a1d24' }}>
          <div
            style={{
              width: '100%',
              overflow: 'auto',
              maxHeight: '70vh',
              backgroundColor: '#1a1d24',
              cursor: activeModal === 'heatmap' && modalZoom > 1
                ? (modalHeatmapPan.dragging ? 'grabbing' : 'grab')
                : undefined,
            }}
            ref={modalHeatmapPan.ref}
            onPointerDown={modalHeatmapPan.handlePointerDown}
            onPointerMove={modalHeatmapPan.handlePointerMove}
            onPointerUp={modalHeatmapPan.handlePointerUp}
            onPointerLeave={modalHeatmapPan.handlePointerLeave}
            onPointerCancel={modalHeatmapPan.handlePointerCancel}
          >
            <div
              className="heatmap-container"
              ref={modalHeatmapContainerRef}
              style={{
                position: 'relative',
                width: `${modalZoom * 100}%`,
                height: 'auto',
                aspectRatio: `${baseScreenWidth} / ${baseScreenHeight}`,
                transition: 'width 0.1s ease-out',
              }}
            >
              <canvas
                ref={modalHeatmapCanvasRef}
                className="heatmap-canvas"
                style={{ width: '100%', height: '100%', display: 'block' }}
                aria-label="Gaze heatmap enlarged"
              />
              <div className="heatmap-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div className="heatmap-grid"></div>
              </div>
            </div>
          </div>
          {heatmapPoints.length > 0 && (
            <div className="heatmap-legend" style={{ marginTop: '12px', padding: '0 8px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666', marginBottom: '4px', fontWeight: 500 }}>
                <span>Low Focus</span>
                <span>High Focus</span>
              </div>
              <div style={{ height: '6px', width: '100%', background: 'linear-gradient(to right, hsla(240, 100%, 50%, 0.5), hsla(180, 100%, 50%, 0.6), hsla(120, 100%, 50%, 0.7), hsla(60, 100%, 50%, 0.8), hsla(0, 100%, 50%, 0.9))', borderRadius: '4px' }} />
            </div>
          )}
        </div>
      );
    })();

    return (
      <div className="viz-modal-overlay" role="dialog" aria-modal="true" onClick={closeModal}>
        <div className="viz-modal detail-card" onClick={e => e.stopPropagation()}>
          <div className="viz-modal__header">
            <h3>{titles[activeModal]}</h3>
            <div className="viz-modal__actions">
              <span className="zoom-readout">{Math.round(modalZoom * 100)}%</span>
              <button className="detail-button small ghost" type="button" onClick={closeModal}>
                {t('common.close', '닫기')}
              </button>
            </div>
          </div>
          <div className="viz-modal__body" onWheel={handleModalWheel}>
            <p className="viz-modal__hint">
              {t('detailed.modal.hint', '마우스 스크롤로 확대/축소하고, 그래프를 드래그해 이동할 수 있어요.')}
            </p>
            <div className="viz-modal__content">{modalBody}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="detailed-results-page">
      <header className="detailed-header">
        <div>
          
          <h1>Performance Breakdown</h1>
          <p className="subhead"> {new Date(sessionData.date).toLocaleString()}</p>
        </div>
        <div className="header-actions">
          {calibration && calibration.validationError !== null && (
            <div className="pill">Session calibration error: {calibration.validationError.toFixed(1)} px</div>
          )}
          <button type="button" className="detail-button ghost" onClick={handleBack}>Back to overview</button>
        </div>
      </header>

      <section className="detail-section training-results">
        <div className="prediction-card detail-card bordered">
          <div className="prediction-top">
            <div className="prediction-left rank-tooltip-container">
              <div className="rank-left-row">
                <div className="rank-stack">
                  <div className="rank-medal" style={{ ['--rank-color' as string]: rankLevel.color }}>
                    <Target size={32} />
                  </div>
                  <div className="rank-row rank-row--stacked">
                    <span
                      className="rank-name"
                      style={{ color: rankLevel.color }}
                      title={`${rankLabel}: ${rankLevel.min}-${rankLevel.max}`}
                    >
                      {rankLabel}
                    </span>
                  </div>
                </div>
                <div className="prediction-left__body">
                  <div className="title-wrap">
                    <p className="card-label">{t('detailed.training.title', 'Training Results')}</p>
                  </div>
                  <div className="score-row">
                    <span className="card-value">
                      {predictedScore != null ? predictedScore.toFixed(1) : t('detailed.training.noScore', '점수 없음')}
                    </span>
                    <span className="score-scale">/ 100</span>
                    {isPredictingScore && <span className="chip">{t('detailed.training.predicting', '예측 중')}</span>}
                  </div>
                  <p className="card-meta">
                    {t('detailed.training.desc', '리포트 생성에 사용되는 예측 점수와 랭크입니다.')}
                  </p>
                </div>
              </div>
              <div className="rank-tooltip">
                <strong className="rank-tooltip-title">{t('detailed.training.rankTitle', '점수대별 랭크')}</strong>
                <ul>
                  {rankLevels.map(level => {
                    const label = language === 'ko' ? level.labelKo : level.labelEn;
                    return (
                      <li key={level.key}>
                        <span style={{ color: level.color, fontWeight: 700 }}>{label}</span>{' '}
                        <span className="rank-range">({level.min}-{level.max})</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="prediction-right">
              <span className="inline-note">
                {formatText(
                  'detailed.training.inlineNote',
                  '객체를 {gazeMs}ms에 보고, {aimMs}ms 동안 마우스를 움직여, {clickMs}ms에 쐈어요.',
                  {
                    gazeMs: analytics.avgGazeReactionTime.toFixed(0),
                    aimMs: analytics.gazeAimLatency.toFixed(0),
                    clickMs: analytics.avgReactionTime.toFixed(0),
                  },
                )}
              </span>
              <div className="prediction-inline-factors condensed">
                {predictionFactors.map(factor => (
                  <span key={factor.label} className="inline-factor">
                    <span className="factor-label">{factor.label}</span>
                    <strong>{factor.value}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="section-header">
          <h2>Detailed Visualizations</h2>
          <p className="muted">
            {t('detailed.viz.subtitle', '세션 중 발생한 오차 추세와 시선 분포를 확인하세요.')}
          </p>
        </div>
        
        <div className="viz-grid detailed-viz-grid">
          
          <div
            className={`viz-card viz-card--accent detail-card bordered ${focusMetric === 'trends' ? 'focused' : ''}`}
            data-tone="trends"
            style={{ padding: '20px' }}
          >
            <div className="viz-card__header">
              <div className="viz-card__title">
                <h3>Performance Trends</h3>
                <div className="viz-info">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Performance Trends 설명"
                  >
                    <Info size={16} />
                  </button>
                  <div className="viz-tooltip" role="tooltip">
                    <p>{formatText('detailed.viz.trends.meta.session', '세션 {seconds}s', { seconds: sessionData.duration })}</p>
                    <p>{formatText('detailed.viz.trends.meta.targets', '타겟 {count}개', { count: analytics.totalTargets })}</p>
                    <p>{formatText('detailed.viz.trends.meta.hits', '히트 {count}회', { count: analytics.targetsHit })}</p>
                    <p className="viz-tooltip__desc">{t('detailed.viz.trends.desc', '시선·마우스 오차와 동기화 추세를 시간 흐름에 따라 확인해요.')}</p>
                  </div>
                </div>
              </div>
              <div className="viz-card__actions viz-card__actions--compact">
                <div className="visibility-controls" style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { key: 'gaze-error', label: 'Gaze', color: '#4ecdc4', textColor: '#1a1d24' },
                    { key: 'mouse-error', label: 'Mouse', color: '#ffb86c', textColor: '#1a1d24' },
                    { key: 'synchronization', label: 'Sync', color: '#7a5ff5', textColor: '#fff' },
                    { key: 'hit-moment', label: 'Hits', color: '#871212', textColor: '#fff' }
                  ].map(({ key, label, color, textColor }) => (
                    <button
                      key={key}
                      onClick={() => toggleMetric(key)}
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.8rem',
                        borderRadius: '16px',
                        border: `1px solid ${color}`,
                        backgroundColor: visibleMetrics[key] ? color : 'transparent',
                        color: visibleMetrics[key] ? textColor : color,
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                      }}
                      aria-pressed={visibleMetrics[key]}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button className="detail-button small ghost icon-button--inline" type="button" onClick={() => openModal('trends')}>
                  <Maximize2 size={14} />
                  <span>{t('detailed.viz.expand', '확대')}</span>
                </button>
              </div>
            </div>
            <div className="viz-preview viz-preview--chart" onClick={() => openModal('trends')}>
              <PerformanceLineChart
                series={filteredSeries}
                duration={sessionData.duration}
                hitTimes={hitTimes}
                zoomLevel={1}
                showHitMarkers={visibleMetrics['hit-moment']}
              />
            </div>
          </div>

          <div className="viz-card viz-card--accent detail-card bordered" data-tone="rolling" style={{ padding: '20px' }}>
            <div className="viz-card__header">
              <div className="viz-card__title">
                <h3>Rolling Performance</h3>
                <div className="viz-info">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Rolling Performance 설명"
                  >
                    <Info size={16} />
                  </button>
                  <div className="viz-tooltip" role="tooltip">
                    <p>{formatText('detailed.viz.rolling.meta.session', '세션 {seconds}s', { seconds: sessionData.duration })}</p>
                    <p>{formatText('detailed.viz.rolling.meta.window', '롤링 윈도우 {window}s', { window: rollingWindowSeconds })}</p>
                    <p>{formatText('detailed.viz.rolling.meta.hits', '히트 {count}회', { count: rollingPerformance.hitTimes.length })}</p>
                    <p className="viz-tooltip__desc">{t('detailed.viz.rolling.desc', '최근 구간의 정확도·초당 히트·히트 시점을 묶어 단기 흐름을 보여줘요.')}</p>
                  </div>
                </div>
              </div>
              <div className="viz-card__actions viz-card__actions--compact">
                <div className="visibility-controls" style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
                {[{ key: 'rolling-accuracy', label: 'Rolling Accuracy', color: '#7c9bff' }, { key: 'rolling-hps', label: 'HPS', color: '#f1c40f' }, { key: 'rolling-hits', label: 'Hits', color: '#d14b4b' }].map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => toggleRollingMetric(key)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      borderRadius: '16px',
                      border: `1px solid ${color}`,
                      backgroundColor: rollingVisibility[key] ? color : 'transparent',
                      color: rollingVisibility[key] ? '#0b1021' : color,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                    aria-pressed={rollingVisibility[key]}
                  >
                    {label}
                  </button>
                ))}
                </div>
                <button className="detail-button small ghost icon-button--inline" type="button" onClick={() => openModal('rolling')}>
                  <Maximize2 size={14} />
                  <span>{t('detailed.viz.expand', '확대')}</span>
                </button>
              </div>
            </div>
            <div className="viz-preview viz-preview--chart" onClick={() => openModal('rolling')}>
              <PerformanceLineChart
                series={filteredRollingSeries}
                duration={sessionData.duration}
                hitTimes={rollingVisibility['rolling-hits'] ? rollingPerformance.hitTimes : []}
                zoomLevel={1}
                showHitMarkers={rollingVisibility['rolling-hits']}
                yAxisLabel={`Last ${rollingWindowSeconds}s window`}
              />
            </div>
          </div>

          <div className="viz-card viz-card--accent detail-card bordered" data-tone="velocity" style={{ padding: '20px' }}>
            <div className="viz-card__header">
              <div className="viz-card__title">
                <h3>Velocity & Reaction</h3>
                <div className="viz-info">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Velocity & Reaction 설명"
                  >
                    <Info size={16} />
                  </button>
                  <div className="viz-tooltip" role="tooltip">
                    <p>{formatText('detailed.viz.velocity.meta.session', '세션 {seconds}s', { seconds: sessionData.duration })}</p>
                    <p>{formatText('detailed.viz.velocity.meta.reaction', '평균 반응 {ms}ms', { ms: Math.round(analytics.avgReactionTime) })}</p>
                    <p>{formatText('detailed.viz.velocity.meta.gaze', '시선 반응 {ms}ms', { ms: Math.round(analytics.avgGazeReactionTime) })}</p>
                    <p className="viz-tooltip__desc">{t('detailed.viz.velocity.desc', '마우스 이동 속도와 반응 시간의 관계를 비교해 느린 구간을 찾을 수 있어요.')}</p>
                  </div>
                </div>
              </div>
              <div className="viz-card__actions">
                <div className="visibility-controls" style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
                  {[{ key: 'mouse-velocity', label: 'Mouse Velocity', color: '#4ecdc4' }, { key: 'reaction-time', label: 'Reaction Time', color: '#ff6b6b' }, { key: 'velocity-hits', label: 'Hits', color: '#d14b4b' }].map(({ key, label, color }) => (
                    <button
                      key={key}
                      onClick={() => toggleVelocityMetric(key)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.8rem',
                        borderRadius: '16px',
                        border: `1px solid ${color}`,
                        backgroundColor: velocityVisibility[key] ? color : 'transparent',
                        color: velocityVisibility[key] ? '#0b1021' : color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                      }}
                      aria-pressed={velocityVisibility[key]}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button className="detail-button small ghost icon-button--inline" type="button" onClick={() => openModal('velocity')}>
                  <Maximize2 size={14} />
                  <span>{t('detailed.viz.expand', '확대')}</span>
                </button>
              </div>
            </div>
            <div className="viz-preview viz-preview--chart" onClick={() => openModal('velocity')}>
              <PerformanceLineChart
                series={filteredVelocitySeries}
                duration={sessionData.duration}
                hitTimes={velocityVisibility['velocity-hits'] ? velocityReaction.hitTimes : []}
                zoomLevel={1}
                showHitMarkers={velocityVisibility['velocity-hits']}
                yAxisLabel="Speed (px/s) · Reaction (ms)"
              />
            </div>
          </div>

          {/* Heatmap (UPDATED: Added conditional class for 'heatmap' focus) */}
          <div
            className={`viz-card viz-card--accent detail-card bordered ${focusMetric === 'heatmap' ? 'focused' : ''}`}
            data-tone="heatmap"
            style={{ padding: '20px' }}
          >
             <div className="viz-card__header">
              <div className="viz-card__title">
                <h3>Gaze Heatmap</h3>
                <div className="viz-info">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Gaze Heatmap 설명"
                  >
                    <Info size={16} />
                  </button>
                  <div className="viz-tooltip" role="tooltip">
                    <p>{formatText('detailed.viz.heatmap.meta.gaze', '시선 커버 {pct}%', { pct: coverage.gaze.toFixed(0) })}</p>
                    <p>{formatText('detailed.viz.heatmap.meta.mouse', '입력 커버 {pct}%', { pct: coverage.mouse.toFixed(0) })}</p>
                    <p>{formatText('detailed.viz.heatmap.meta.points', '포인트 {count}개', { count: heatmapPoints.length })}</p>
                    <p className="viz-tooltip__desc">{t('detailed.viz.heatmap.desc', '세션 동안 시선이 오래 머문 영역을 색상 농도로 보여줘요.')}</p>
                  </div>
                </div>
              </div>
              <div className="viz-card__actions">
                <button className="detail-button small ghost icon-button--inline" type="button" onClick={() => openModal('heatmap')}>
                  <Maximize2 size={14} />
                  <span>{t('detailed.viz.expand', '확대')}</span>
                </button>
              </div>
            </div>
            <div className="heatmap-wrapper viz-preview viz-preview--heatmap" onClick={() => openModal('heatmap')}>
              <div className="heatmap-scroll">
                <div 
                  className="heatmap-container"
                  ref={heatmapContainerRef}
                  style={{ 
                    position: 'relative', 
                    width: '100%',
                    height: 'auto',
                    aspectRatio: `${baseScreenWidth} / ${baseScreenHeight}`, 
                    transition: 'width 0.2s ease-out'
                  }}
                >
                  <canvas ref={heatmapCanvasRef} className="heatmap-canvas" style={{ width: '100%', height: '100%', display: 'block' }} aria-label="Gaze heatmap" />
                  <div className="heatmap-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    <div className="heatmap-grid"></div>
                  </div>
                </div>
              </div>
              
              {heatmapPoints.length > 0 && (
                <div className="heatmap-legend" style={{ marginTop: '12px', padding: '0 8px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666', marginBottom: '4px', fontWeight: 500 }}>
                    <span>Low Focus</span>
                    <span>High Focus</span>
                  </div>
                  <div style={{ height: '6px', width: '100%', background: 'linear-gradient(to right, hsla(240, 100%, 50%, 0.5), hsla(180, 100%, 50%, 0.6), hsla(120, 100%, 50%, 0.7), hsla(60, 100%, 50%, 0.8), hsla(0, 100%, 50%, 0.9))', borderRadius: '4px' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Metrics & Data Quality Sections */}
      <section className="detail-section">
        <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {/* 1. Accuracy */}
          <div className={`detail-card ${focusMetric === 'accuracy' ? 'focused' : ''}`}>
            <p className="card-label">{t('detailed.metrics.hitRate', 'Hit Rate (Accuracy)')}</p>
            <p className="card-value">{accuracyPct.toFixed(1)}%</p>
            <p className="card-meta">
              {formatText(
                'detailed.metrics.hitRateMeta',
                '{hits} / {total} targets hit',
                { hits: analytics.targetsHit, total: analytics.totalTargets },
              )}
            </p>
            {(() => {
              const level = metricDetailLevel('accuracy', analytics);
              const percentile = metricPercentile('accuracy', analytics);
              return (
                <>
                  <div className="detail-level-row">
                    <span className="detail-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                  <div className="detail-metric-tooltip">
                    <Info size={14} />
                    <span>{metricTooltips.accuracy}</span>
                    <span className="card-level" style={level}>{level.label}</span>
                    <span className="card-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 2. Avg Reaction Time */}
          <div className={`detail-card ${focusMetric === 'reaction' ? 'focused' : ''}`}>
            <p className="card-label">{t('detailed.metrics.reaction', 'Avg Reaction Time')}</p>
            <p className="card-value">{analytics.avgReactionTime.toFixed(0)} ms</p>
            <p className="card-meta">{t('detailed.metrics.reactionDesc', 'Mouse click latency')}</p>
            {(() => {
              const level = metricDetailLevel('reaction', analytics);
              const percentile = metricPercentile('reaction', analytics);
              return (
                <>
                  <div className="detail-level-row">
                    <span className="detail-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                  <div className="detail-metric-tooltip">
                    <Info size={14} />
                    <span>{metricTooltips.reaction}</span>
                    <span className="card-level" style={level}>{level.label}</span>
                    <span className="card-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 3. Gaze Reaction */}
          <div className={`detail-card ${focusMetric === 'gaze' ? 'focused' : ''}`}>
            <p className="card-label">{t('detailed.metrics.gaze', 'Gaze Reaction')}</p>
            <p className="card-value">{analytics.avgGazeReactionTime.toFixed(0)} ms</p>
            <p className="card-meta">{t('detailed.metrics.gazeDesc', 'Time to first look at target')}</p>
            {(() => {
              const level = metricDetailLevel('gaze', analytics);
              const percentile = metricPercentile('gaze', analytics);
              return (
                <>
                  <div className="detail-level-row">
                    <span className="detail-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                  <div className="detail-metric-tooltip">
                    <Info size={14} />
                    <span>{metricTooltips.gaze}</span>
                    <span className="card-level" style={level}>{level.label}</span>
                    <span className="card-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 4. Gaze-Aim Latency */}
          <div className="detail-card">
            <p className="card-label">{t('detailed.metrics.gazeAim', 'Gaze-Aim Latency')}</p>
            <p className="card-value">{analytics.gazeAimLatency.toFixed(0)} ms</p>
            <p className="card-meta">{t('detailed.metrics.gazeAimDesc', 'Eye vs Hand delay')}</p>
            {(() => {
              const level = metricDetailLevel('gazeAim', analytics);
              const percentile = metricPercentile('gazeAim', analytics);
              return (
                <>
                  <div className="detail-level-row">
                    <span className="detail-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                  <div className="detail-metric-tooltip">
                    <Info size={14} />
                    <span>{metricTooltips.gazeAim}</span>
                    <span className="card-level" style={level}>{level.label}</span>
                    <span className="card-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                </>
              );
            })()}
          </div>

           {/* 5. Synchronization */}
          <div className="detail-card">
            <p className="card-label">{t('detailed.metrics.sync', 'Synchronization')}</p>
            <p className="card-value">{analytics.synchronization.toFixed(0)} px</p>
            <p className="card-meta">{t('detailed.metrics.syncDesc', 'Avg distance: Gaze ↔ Mouse')}</p>
            {(() => {
              const level = metricDetailLevel('sync', analytics);
              const percentile = metricPercentile('sync', analytics);
              return (
                <>
                  <div className="detail-level-row">
                    <span className="detail-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                  <div className="detail-metric-tooltip">
                    <Info size={14} />
                    <span>{metricTooltips.sync}</span>
                    <span className="card-level" style={level}>{level.label}</span>
                    <span className="card-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                </>
              );
            })()}
           </div>

          {/* 6. Gaze Coverage */}
          <div className={`detail-card ${focusMetric === 'gaze' ? 'focused' : ''}`}>
            <p className="card-label">{t('detailed.metrics.gazeSamples', 'Gaze Samples')}</p>
            <p className="card-value">{coverage.gaze.toFixed(1)}%</p>
            <p className="card-meta">{t('detailed.metrics.gazeSamplesDesc', 'Tracking coverage')}</p>
            {(() => {
              const level = metricDetailLevel('coverage', analytics, coverage);
              const percentile = metricPercentile('coverage', analytics, coverage);
              return (
                <>
                  <div className="detail-level-row">
                    <span className="detail-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                  <div className="detail-metric-tooltip">
                    <Info size={14} />
                    <span>{metricTooltips.coverage}</span>
                    <span className="card-level" style={level}>{level.label}</span>
                    <span className="card-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 7. Mouse Coverage */}
          <div className={`detail-card ${focusMetric === 'mouse' ? 'focused' : ''}`}>
            <p className="card-label">{t('detailed.metrics.mouseSamples', 'Mouse Samples')}</p>
            <p className="card-value">{coverage.mouse.toFixed(1)}%</p>
            <p className="card-meta">{t('detailed.metrics.mouseSamplesDesc', 'Input coverage')}</p>
            {(() => {
              const level = metricDetailLevel('coverage', analytics, coverage);
              const percentile = metricPercentile('coverage', analytics, coverage);
              return (
                <>
                  <div className="detail-level-row">
                    <span className="detail-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                  <div className="detail-metric-tooltip">
                    <Info size={14} />
                    <span>{metricTooltips.coverage}</span>
                    <span className="card-level" style={level}>{level.label}</span>
                    <span className="card-percentile" style={{ color: level.color }}>{percentile.label}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="section-header">
          <h2>Error Breakdown</h2>
          <p className="muted">
            {t('detailed.error.subtitle', '오차는 타겟 중심으로부터의 평균 픽셀 거리입니다.')}
          </p>
        </div>
        <div className="detail-grid two-col">
          <div className={`detail-card bordered ${focusMetric === 'gaze' ? 'focused' : ''}`}>
            <div className="card-heading">
              <span className="pill pill-blue">Gaze</span>
              <span className="chip">{gazeError?.samples ?? 0} samples</span>
            </div>
            <div className="stat-row">
              <span>Avg error (Session)</span>
              <strong>{gazeError ? gazeError.avg.toFixed(1) : '0.0'} px</strong>
            </div>
            <div className="stat-row">
              <span>Error at Hit (Moment)</span>
              {/* analytics의 gazeErrorAtHit 사용 */}
              <strong>{analytics.gazeErrorAtHit.toFixed(1)} px</strong>
            </div>
            <div className="stat-row">
              <span>Median / P95</span>
              <strong>{gazeError ? gazeError.median.toFixed(1) : '0.0'} px · {gazeError ? gazeError.p95.toFixed(1) : '0.0'} px</strong>
            </div>
            <div className="stat-row">
              <span>Max deviation</span>
              <strong>{gazeError ? gazeError.max.toFixed(1) : '0.0'} px</strong>
            </div>
          </div>

          <div className={`detail-card bordered ${focusMetric === 'mouse' ? 'focused' : ''}`}>
            <div className="card-heading">
              <span className="pill pill-green">Mouse</span>
              <span className="chip">{mouseError?.samples ?? 0} samples</span>
            </div>
            <div className="stat-row">
              <span>Avg error (Session)</span>
              <strong>{mouseError ? mouseError.avg.toFixed(1) : '0.0'} px</strong>
            </div>
             <div className="stat-row">
              <span>Error at Hit (Moment)</span>
              <strong>{analytics.mouseErrorAtHit.toFixed(1)} px</strong>
            </div>
            <div className="stat-row">
              <span>Median / P95</span>
              <strong>{mouseError ? mouseError.median.toFixed(1) : '0.0'} px · {mouseError ? mouseError.p95.toFixed(1) : '0.0'} px</strong>
            </div>
            <div className="stat-row">
              <span>Max deviation</span>
              <strong>{mouseError ? mouseError.max.toFixed(1) : '0.0'} px</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Data Quality 섹션 */}
      <section className="detail-section">
        <div className="section-header">
          <h2>Data Quality & Timing</h2>
          <p className="muted">
            {t('detailed.data.subtitle', '세션 동안 수집된 입력과 타겟 정보를 확인하세요.')}
          </p>
        </div>
        <div className="detail-grid three-col">
          <div className="detail-card bordered">
            <p className="card-label">{t('detailed.data.framesWithTargets', 'Frames with Target Data')}</p>
            <p className="card-value">{dataQuality ? dataQuality.withTargetsPct.toFixed(1) : '0.0'}%</p>
            <p className="card-meta">{t('detailed.data.framesWithTargetsDesc', '타겟 좌표가 함께 기록된 프레임')}</p>
          </div>
          <div className="detail-card bordered">
            <p className="card-label">{t('detailed.data.gazeCoverage', 'Gaze Coverage')}</p>
            <p className="card-value">{dataQuality ? dataQuality.gazeCoverage.toFixed(1) : '0.0'}%</p>
            <p className="card-meta">{t('detailed.data.coverageDesc', '가용한 전체 프레임 기준')}</p>
          </div>
          <div className="detail-card bordered">
            <p className="card-label">{t('detailed.data.mouseCoverage', 'Mouse Coverage')}</p>
            <p className="card-value">{dataQuality ? dataQuality.mouseCoverage.toFixed(1) : '0.0'}%</p>
            <p className="card-meta">{t('detailed.data.coverageDesc', '가용한 전체 프레임 기준')}</p>
          </div>
          <div className="detail-card bordered">
            <p className="card-label">{t('detailed.data.hitRate', 'Hit Rate')}</p>
            <p className="card-value">{dataQuality ? dataQuality.hitRate.toFixed(1) : '0.0'}%</p>
            <p className="card-meta">{t('detailed.data.hitRateDesc', '타겟당 명중률')}</p>
          </div>
          <div className="detail-card bordered">
            <p className="card-label">{t('detailed.data.hitInterval', 'Hit Interval (avg)')}</p>
            <p className="card-value">{hitIntervals ? hitIntervals.avg.toFixed(0) : '0'} ms</p>
            <p className="card-meta">
              {hitIntervals && hitIntervals.samples > 0
                ? formatText('detailed.data.hitIntervalRange', 'min {min} / max {max}', {
                  min: hitIntervals.min.toFixed(0),
                  max: hitIntervals.max.toFixed(0),
                })
                : t('detailed.data.insufficient', '충분한 데이터가 없습니다')}
            </p>
          </div>
          <div className="detail-card bordered">
            <p className="card-label">{t('detailed.data.rawPoints', 'Raw Points')}</p>
            <p className="card-value">{sessionData.rawData.length}</p>
            <p className="card-meta">{t('detailed.data.rawPointsDesc', '세션에 저장된 총 샘플')}</p>
          </div>
        </div>
      </section>

      {/* Session Targets 섹션 */}
      <section className="detail-section">
        <div className="section-header">
          <h2>Recent Targets</h2>
          <p className="muted">
            {t(
              'detailed.targets.subtitle',
              '세션동안 등장한 타겟의 오차와 반응 시간을 확인하세요. 한 번에 8개씩 표시되며 스크롤로 다음 타겟까지 탐색할 수 있습니다. 타겟 ID를 누르면 해당 타겟 등장부터 사라질 때까지의 슬로우모션 리플레이가 재생됩니다.',
            )}
          </p>
        </div>
        <div className="samples-table scrollable">
          <div className="samples-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col" className="align-left">Target</th>
                  <th scope="col">Gaze error</th>
                  <th scope="col">Mouse error</th>
                  <th scope="col">Time to hit</th>
                  <th scope="col">Hit</th>
                </tr>
              </thead>
              <tbody>
                {recentTargets.map((sample, idx) => (
                  <tr key={`${sample.targetId}-${idx}`}>
                    <td className="align-left">
                      <button type="button" className="target-link" onClick={() => openReplayForTarget(sample.targetId, idx + 1)}>
                        Target #{idx + 1}
                      </button>
                    </td>
                    <td>{sample.gazeErr !== null ? `${sample.gazeErr.toFixed(1)} px` : 'N/A'}</td>
                    <td>{sample.mouseErr !== null ? `${sample.mouseErr.toFixed(1)} px` : 'N/A'}</td>
                    <td>{sample.timeToHitMs !== null ? `${(sample.timeToHitMs / 1000).toFixed(2)} s` : '—'}</td>
                    <td>
                      <span className={sample.targetHit ? 'pill pill-green' : 'pill'}>
                        {sample.targetHit ? 'Hit' : 'Miss'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {renderModalContent()}

      {replayTargetId && (
        <div className="replay-overlay" role="dialog" aria-modal="true">
          <div className="replay-modal detail-card">
            <div className="replay-header">
              <div>
                <p className="card-label">Target Replay</p>
                <h3 className="replay-title">Target #{replayTargetIndex}</h3>
                <p className="muted">
                  등장부터 사라질 때까지를 {currentReplayFrame?.targetHit ? '명중 프레임 포함' : '마지막 프레임까지'} 느린 속도로 재생합니다. 배속을 선택하거나, 재생바를 움직여 원하는 구간을 바로 확인할 수 있습니다.
                </p>
              </div>
              <button type="button" className="detail-button ghost" onClick={closeReplay}>Close</button>
            </div>

            <div className="replay-body">
              <div className="replay-viewport">
                <svg viewBox="0 0 420 260" className="replay-canvas" role="presentation">
                  <rect x={0} y={0} width={420} height={260} rx={12} ry={12} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
                  {[0.25, 0.5, 0.75].map((ratio, idx) => (
                    <line
                      key={`v-${idx}`}
                      x1={420 * ratio}
                      x2={420 * ratio}
                      y1={0}
                      y2={260}
                      stroke="rgba(255,255,255,0.07)"
                      strokeDasharray="4 4"
                    />
                  ))}
                  {[0.25, 0.5, 0.75].map((ratio, idx) => (
                    <line
                      key={`h-${idx}`}
                      x1={0}
                      x2={420}
                      y1={260 * ratio}
                      y2={260 * ratio}
                      stroke="rgba(255,255,255,0.07)"
                      strokeDasharray="4 4"
                    />
                  ))}

                  {currentReplayFrame && (
                    <>
                      {currentReplayFrame.targetX !== null && currentReplayFrame.targetY !== null && (
                        <circle
                          className="replay-target"
                          cx={projectReplayPoint(currentReplayFrame.targetX, true, 420) ?? 210}
                          cy={projectReplayPoint(currentReplayFrame.targetY, false, 260) ?? 130}
                          r={12}
                        />
                      )}
                      {currentReplayFrame.displayMouseX !== null && currentReplayFrame.displayMouseY !== null && (
                        <circle
                          className="replay-mouse"
                          cx={projectReplayPoint(currentReplayFrame.displayMouseX, true, 420) ?? 210}
                          cy={projectReplayPoint(currentReplayFrame.displayMouseY, false, 260) ?? 130}
                          r={7}
                        />
                      )}
                      {currentReplayFrame.displayGazeX !== null && currentReplayFrame.displayGazeY !== null && (
                        <circle
                          className="replay-gaze"
                          cx={projectReplayPoint(currentReplayFrame.displayGazeX, true, 420) ?? 210}
                          cy={projectReplayPoint(currentReplayFrame.displayGazeY, false, 260) ?? 130}
                          r={7}
                        />
                      )}
                    </>
                  )}
                </svg>
              </div>
              <div className="replay-meta">
                <div className="replay-legend" aria-label="점 설명">
                  <span><span className="legend-dot target" /> Target</span>
                  <span><span className="legend-dot mouse" /> Mouse</span>
                  <span><span className="legend-dot gaze" /> Gaze</span>
                </div>
                <div className="stat-row">
                  <span>Time window</span>
                  <strong>{(replayDurationMs / 1000).toFixed(2)} s</strong>
                </div>
                <div className="stat-row">
                  <span>Current time</span>
                  <strong>{(replayElapsedMs / 1000).toFixed(2)} s</strong>
                </div>
                <div className="stat-row">
                  <span>Status</span>
                  <strong>{currentReplayFrame?.targetHit ? 'Hit' : 'Tracking'}</strong>
                </div>
                <div className="replay-progress" aria-label="replay progress">
                  <div style={{ width: `${replayProgressPct}%` }} />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={replayProgressPct}
                    onChange={e => scrubToProgress(Number(e.target.value))}
                    aria-label="재생 위치 조절"
                  />
                </div>
                <div className="replay-controls">
                  <label className="replay-speed" htmlFor="replay-speed-select">
                    Speed
                    <select
                      id="replay-speed-select"
                      value={replaySpeed}
                      onChange={e => setReplaySpeed(Number(e.target.value))}
                    >
                      {[0.1, 0.2, 0.3, 0.5, 1].map(speed => (
                        <option key={speed} value={speed}>{`${speed.toFixed(1)}×`}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="detail-button small"
                    onClick={() => setIsReplaying(prev => !prev)}
                  >
                    {isReplaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    type="button"
                    className="detail-button small ghost"
                    onClick={() => {
                      setReplayIndex(0);
                      setIsReplaying(true);
                    }}
                  >
                    Restart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedResultsPage;
