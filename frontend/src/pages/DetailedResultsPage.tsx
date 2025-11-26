import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './DetailedResultsPage.css';
import {
  CalibrationResult,
  TrainingDataPoint,
  TrainingSessionSummary,
  useTrackingSession,
} from '../state/trackingSessionContext';
import { loadStoredCalibration, loadStoredSession, persistLatestSession } from '../utils/resultsStorage';
import { calculatePerformanceAnalytics, generateErrorTimeSeries } from '../utils/analytics';

// UPDATED: Added 'trends' and 'heatmap' to focus metrics
type FocusMetric = 'accuracy' | 'targets' | 'reaction' | 'gaze' | 'mouse' | 'trends' | 'heatmap';

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
}: {
  series: SeriesConfig[];
  duration: number;
  hitTimes?: number[];
  zoomLevel?: number;
  showHitMarkers?: boolean;
  yAxisLabel?: string;
}) => {
  const activeSeries = series.filter(s => s.points.some(p => p.value !== null));

  // 데이터가 없고 마커도 안 보여준다면 빈 화면 처리
  if (!activeSeries.length && (!showHitMarkers || !hitTimes.length)) {
    return <div className="chart-empty">No data selected to display.</div>;
  }

  const width = 720; 
  const height = 360;
  const padding = 56;
  
  // X축 최대값: 시리즈가 없으면 duration 기준
  const xMax = Math.max(duration, ...activeSeries.map(s => s.points.at(-1)?.time ?? 0), 1);
  
  // Y축 최대값: 시리즈가 없으면 기본 100
  const allValues = activeSeries.flatMap(s => s.points.map(p => p.value).filter((v): v is number => v !== null));
  const maxVal = allValues.length ? Math.max(...allValues) : 100;
  const yMax = Math.ceil(maxVal * 1.1);

  const xScale = (time: number) => padding + (time / xMax) * (width - padding * 2);
  const yScale = (value: number) => height - padding - (value / yMax) * (height - padding * 2);

  const xTicks = 6;
  const xTickValues = Array.from({ length: xTicks }, (_, i) => Math.round((xMax / (xTicks - 1)) * i));
  const yTickValues = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i));

  const formatTime = (seconds: number) => `${seconds}s`;

  return (
    <div className="chart-scroll-wrapper" style={{ overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%' }}>
      <div style={{ width: `${zoomLevel * 100}%`, minWidth: '100%', position: 'relative', transition: 'width 0.2s ease-out' }}>
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="chart-svg" 
          role="img" 
          aria-label="Performance trends over time" 
          style={{ width: '100%', height: 'auto', display: 'block' }} 
        >
          <defs>
            {activeSeries.map(({ gradientId, color }) => (
              <linearGradient key={gradientId} id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={color} stopOpacity="0.1" />
              </linearGradient>
            ))}
          </defs>

          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="chart-axis" />

          {xTickValues.map(tick => (
            <line key={`x-${tick}`} x1={xScale(tick)} x2={xScale(tick)} y1={padding} y2={height - padding} className="chart-grid" />
          ))}
          {yTickValues.map(tick => (
            <line key={`y-${tick}`} x1={padding} x2={width - padding} y1={yScale(tick)} y2={yScale(tick)} className="chart-grid" />
          ))}

          {/* NEW: Conditional rendering for hit markers */}
          {showHitMarkers && hitTimes.map((time, idx) => (
            <g key={`hit-${idx}`}>
              <line x1={xScale(time)} x2={xScale(time)} y1={padding} y2={height - padding} stroke="rgba(127, 9, 9, 0.79)" strokeWidth="1.5" strokeDasharray="4 4" />
              <circle cx={xScale(time)} cy={height - padding} r={3} fill="#871212ff" opacity="0.8" />
            </g>
          ))}

          {xTickValues.map(tick => (
            <text key={`xlabel-${tick}`} x={xScale(tick)} y={height - padding + 24} className="chart-label" textAnchor="middle">{formatTime(tick)}</text>
          ))}
          {yTickValues.map(tick => (
            <text key={`ylabel-${tick}`} x={padding - 12} y={yScale(tick) + 4} className="chart-label" textAnchor="end">{tick}</text>
          ))}

          <text x={(width + padding) / 2} y={height - 12} className="chart-axis-title" textAnchor="middle">Time (seconds)</text>
          <text x={16} y={height / 2} className="chart-axis-title" textAnchor="middle" transform={`rotate(-90 16 ${height / 2})`}>
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
                      <path d={`${pathD} L${xScale(validPoints[validPoints.length-1].time)},${height-padding} L${xScale(validPoints[0].time)},${height-padding} Z`} fill={`url(#${gradientId})`} stroke="none" />
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
            <span className="legend-swatch" style={{ backgroundColor: '#871212ff', width: 8, height: 8, borderRadius: '50%' }} />
            <span className="legend-label">Hit Moment</span>
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
  const focusMetric = (location.state as { focusMetric?: FocusMetric } | null)?.focusMetric;
  const { activeSession, calibrationResult } = useTrackingSession();

  const [sessionData, setSessionData] = useState<TrainingSessionSummary | null>(activeSession);
  const [calibration, setCalibration] = useState<CalibrationResult | null>(calibrationResult);

  const [chartZoom, setChartZoom] = useState(1);
  const [heatmapZoom, setHeatmapZoom] = useState(1);
  const [rollingZoom, setRollingZoom] = useState(1);
  const [velocityZoom, setVelocityZoom] = useState(1);

  // --- NEW: Metric Visibility State ---
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({
    'gaze-error': true,
    'mouse-error': true,
    'synchronization': true,
    'hit-moment': true,
  });

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

  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatmapContainerRef = useRef<HTMLDivElement | null>(null);

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

  const recentSamples = useMemo(() => {
    if (!sessionData) return [];
    const sliced = sessionData.rawData.slice(-8).reverse();
    return sliced.map(sample => {
      const gazeErr = sample.targetX !== null && sample.targetY !== null && sample.gazeX !== null && sample.gazeY !== null
        ? Math.hypot(sample.gazeX - sample.targetX, sample.gazeY - sample.targetY)
        : null;
      const mouseErr = sample.targetX !== null && sample.targetY !== null && sample.mouseX !== null && sample.mouseY !== null
        ? Math.hypot(sample.mouseX - sample.targetX, sample.mouseY - sample.targetY)
        : null;
      return { ...sample, gazeErr, mouseErr };
    });
  }, [sessionData]);

  const performanceSeries = useMemo<SeriesConfig[]>(() => {
    if (!sessionData) return [];
    const timeSeries = generateErrorTimeSeries(sessionData.rawData, sessionData.duration);
    return [
      { key: 'gaze-error', label: 'Gaze Error', color: '#4ecdc4', gradientId: 'grad-gaze', points: timeSeries.map(p => ({ time: p.time, value: p.gazeError })) },
      { key: 'mouse-error', label: 'Mouse Error', color: '#ffb86c', gradientId: 'grad-mouse', points: timeSeries.map(p => ({ time: p.time, value: p.mouseError })) },
      { key: 'synchronization', label: 'Synchronization', color: '#7a5ff5', gradientId: 'grad-sync', points: timeSeries.map(p => ({ time: p.time, value: p.synchronization })) },
    ];
  }, [sessionData]);

  // --- NEW: Filter Series Logic ---
  const filteredSeries = useMemo(() => {
    return performanceSeries.filter(s => visibleMetrics[s.key]);
  }, [performanceSeries, visibleMetrics]);

  const hitTimes = useMemo(() => {
    if (!sessionData?.rawData.length) return [];
    const sorted = [...sessionData.rawData].sort((a, b) => a.timestamp - b.timestamp);
    const startTime = sorted[0].timestamp;
    return sorted.filter(d => d.targetHit).map(d => (d.timestamp - startTime) / 1000);
  }, [sessionData]);

  const rollingPerformance = useMemo(() => {
    if (!sessionData?.rawData.length) {
      return { accuracySeries: [], hpsSeries: [], hitTimes: [] as number[] };
    }

    const sorted = [...sessionData.rawData].sort((a, b) => a.timestamp - b.timestamp);
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

  const drawHeatmap = useCallback(() => {
    const canvas = heatmapCanvasRef.current;
    const container = heatmapContainerRef.current;
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

  const handleBack = () => navigate('/results');

  if (!sessionData || !analytics || !coverage) {
    return (
      <div className="detailed-results-page">
        <div className="detail-empty">
          <p>최근 세션 정보를 찾을 수 없어요.</p>
          <button type="button" className="detail-button" onClick={handleBack}>결과 페이지로 돌아가기</button>
        </div>
      </div>
    );
  }

  // 정확도 계산 (안전하게 0으로 나누기 방지)
  const accuracyPct = analytics.totalTargets > 0 
    ? (analytics.targetsHit / analytics.totalTargets) * 100 
    : 0;

  return (
    <div className="detailed-results-page">
      <header className="detailed-header">
        <div>
          <p className="breadcrumb">Results / Detailed</p>
          <h1>Performance Breakdown</h1>
          <p className="subhead">Session ID #{sessionData.id} · {new Date(sessionData.date).toLocaleString()}</p>
        </div>
        <div className="header-actions">
          {calibration && calibration.validationError !== null && (
            <div className="pill">Calibration error: {calibration.validationError.toFixed(1)} px</div>
          )}
          <button type="button" className="detail-button ghost" onClick={handleBack}>Back to results</button>
        </div>
      </header>

      <section className="detail-section">
        <div className="section-header">
          <h2>Detailed Visualizations</h2>
          <p className="muted">세션 중 발생한 오차 추세와 시선 분포를 확인하세요.</p>
        </div>
        
        <div className="viz-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          
          {/* Performance Chart with Filter Controls (UPDATED: Added conditional class for 'trends' focus) */}
          <div className={`viz-card detail-card bordered ${focusMetric === 'trends' ? 'focused' : ''}`} style={{ padding: '20px' }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
              <h3>Performance Trends</h3>
              
              {/* NEW: Filter Toggles */}
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

              <ZoomControls 
                scale={chartZoom}
                onZoomIn={() => setChartZoom(prev => Math.min(prev + 0.5, 4))}
                onZoomOut={() => setChartZoom(prev => Math.max(prev - 0.5, 1))}
                onReset={() => setChartZoom(1)}
              />
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <PerformanceLineChart
                series={filteredSeries}
                duration={sessionData.duration}
                hitTimes={hitTimes}
                zoomLevel={chartZoom}
                showHitMarkers={visibleMetrics['hit-moment']}
              />
            </div>
          </div>

          <div className="viz-card detail-card bordered" style={{ padding: '20px' }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
              <h3>Rolling Performance</h3>
              <div className="visibility-controls" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[{ key: 'rolling-accuracy', label: 'Rolling Accuracy', color: '#7c9bff' }, { key: 'rolling-hps', label: 'HPS', color: '#f1c40f' }, { key: 'rolling-hits', label: 'Hit markers', color: '#871212' }].map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => toggleRollingMetric(key)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.8rem',
                      borderRadius: '16px',
                      border: `1px solid ${color}`,
                      backgroundColor: rollingVisibility[key] ? color : 'transparent',
                      color: rollingVisibility[key] ? '#0b1021' : color,
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
              <ZoomControls
                scale={rollingZoom}
                onZoomIn={() => setRollingZoom(prev => Math.min(prev + 0.5, 4))}
                onZoomOut={() => setRollingZoom(prev => Math.max(prev - 0.5, 1))}
                onReset={() => setRollingZoom(1)}
              />
            </div>
            <div style={{ marginTop: '16px' }}>
              <PerformanceLineChart
                series={filteredRollingSeries}
                duration={sessionData.duration}
                hitTimes={rollingVisibility['rolling-hits'] ? rollingPerformance.hitTimes : []}
                zoomLevel={rollingZoom}
                showHitMarkers={rollingVisibility['rolling-hits']}
                yAxisLabel={`Last ${rollingWindowSeconds}s window`}
              />
            </div>
          </div>

          <div className="viz-card detail-card bordered" style={{ padding: '20px' }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
              <h3>Velocity & Reaction</h3>
              <div className="visibility-controls" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[{ key: 'mouse-velocity', label: 'Mouse Velocity', color: '#4ecdc4' }, { key: 'reaction-time', label: 'Reaction Time', color: '#ff6b6b' }, { key: 'velocity-hits', label: 'Hit markers', color: '#871212' }].map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => toggleVelocityMetric(key)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.8rem',
                      borderRadius: '16px',
                      border: `1px solid ${color}`,
                      backgroundColor: velocityVisibility[key] ? color : 'transparent',
                      color: velocityVisibility[key] ? '#0b1021' : color,
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
              <ZoomControls
                scale={velocityZoom}
                onZoomIn={() => setVelocityZoom(prev => Math.min(prev + 0.5, 4))}
                onZoomOut={() => setVelocityZoom(prev => Math.max(prev - 0.5, 1))}
                onReset={() => setVelocityZoom(1)}
              />
            </div>
            <div style={{ marginTop: '16px' }}>
              <PerformanceLineChart
                series={filteredVelocitySeries}
                duration={sessionData.duration}
                hitTimes={velocityVisibility['velocity-hits'] ? velocityReaction.hitTimes : []}
                zoomLevel={velocityZoom}
                showHitMarkers={velocityVisibility['velocity-hits']}
                yAxisLabel="Speed (px/s) · Reaction (ms)"
              />
            </div>
          </div>

          {/* Heatmap (UPDATED: Added conditional class for 'heatmap' focus) */}
          <div className={`viz-card detail-card bordered ${focusMetric === 'heatmap' ? 'focused' : ''}`} style={{ padding: '20px' }}>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h3>Gaze Heatmap</h3>
              <ZoomControls 
                scale={heatmapZoom}
                onZoomIn={() => setHeatmapZoom(prev => Math.min(prev + 0.25, 2.5))}
                onZoomOut={() => setHeatmapZoom(prev => Math.max(prev - 0.25, 1))}
                onReset={() => setHeatmapZoom(1)}
              />
            </div>
            <div className="heatmap-wrapper" style={{ marginTop: '16px', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ width: '100%', overflow: 'auto', maxHeight: '400px', backgroundColor: '#1a1d24' }}>
                <div 
                  className="heatmap-container"
                  ref={heatmapContainerRef}
                  style={{ 
                    position: 'relative', 
                    width: `${heatmapZoom * 100}%`,
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
            <p className="card-label">Hit Rate (Accuracy)</p>
            <p className="card-value">{accuracyPct.toFixed(1)}%</p>
            <p className="card-meta">{analytics.targetsHit} / {analytics.totalTargets} targets hit</p>
          </div>

          {/* 2. Avg Reaction Time */}
          <div className={`detail-card ${focusMetric === 'reaction' ? 'focused' : ''}`}>
            <p className="card-label">Avg Reaction Time</p>
            <p className="card-value">{analytics.avgReactionTime.toFixed(0)} ms</p>
            <p className="card-meta">Mouse click latency</p>
          </div>

          {/* 3. Gaze Reaction */}
          <div className={`detail-card ${focusMetric === 'gaze' ? 'focused' : ''}`}>
            <p className="card-label">Gaze Reaction</p>
            <p className="card-value">{analytics.avgGazeReactionTime.toFixed(0)} ms</p>
            <p className="card-meta">Time to first look at target</p>
          </div>

          {/* 4. Gaze-Aim Latency */}
          <div className="detail-card">
            <p className="card-label">Gaze-Aim Latency</p>
            <p className="card-value">{analytics.gazeAimLatency.toFixed(0)} ms</p>
            <p className="card-meta">Eye vs Hand delay</p>
          </div>

           {/* 5. Synchronization */}
           <div className="detail-card">
            <p className="card-label">Synchronization</p>
            <p className="card-value">{analytics.synchronization.toFixed(0)} px</p>
            <p className="card-meta">Avg distance: Gaze ↔ Mouse</p>
          </div>

          {/* 6. Gaze Coverage */}
          <div className={`detail-card ${focusMetric === 'gaze' ? 'focused' : ''}`}>
            <p className="card-label">Gaze Samples</p>
            <p className="card-value">{coverage.gaze.toFixed(1)}%</p>
            <p className="card-meta">Tracking coverage</p>
          </div>

          {/* 7. Mouse Coverage */}
          <div className={`detail-card ${focusMetric === 'mouse' ? 'focused' : ''}`}>
            <p className="card-label">Mouse Samples</p>
            <p className="card-value">{coverage.mouse.toFixed(1)}%</p>
            <p className="card-meta">Input coverage</p>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="section-header">
          <h2>Error Breakdown</h2>
          <p className="muted">오차는 타겟 중심으로부터의 평균 픽셀 거리입니다.</p>
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
          <p className="muted">세션 동안 수집된 입력과 타겟 정보를 확인하세요.</p>
        </div>
        <div className="detail-grid three-col">
          <div className="detail-card bordered">
            <p className="card-label">Frames with Target Data</p>
            <p className="card-value">{dataQuality ? dataQuality.withTargetsPct.toFixed(1) : '0.0'}%</p>
            <p className="card-meta">타겟 좌표가 함께 기록된 프레임</p>
          </div>
          <div className="detail-card bordered">
            <p className="card-label">Gaze Coverage</p>
            <p className="card-value">{dataQuality ? dataQuality.gazeCoverage.toFixed(1) : '0.0'}%</p>
            <p className="card-meta">가용한 전체 프레임 기준</p>
          </div>
          <div className="detail-card bordered">
            <p className="card-label">Mouse Coverage</p>
            <p className="card-value">{dataQuality ? dataQuality.mouseCoverage.toFixed(1) : '0.0'}%</p>
            <p className="card-meta">가용한 전체 프레임 기준</p>
          </div>
          <div className="detail-card bordered">
            <p className="card-label">Hit Rate</p>
            <p className="card-value">{dataQuality ? dataQuality.hitRate.toFixed(1) : '0.0'}%</p>
            <p className="card-meta">타겟당 명중률</p>
          </div>
          <div className="detail-card bordered">
            <p className="card-label">Hit Interval (avg)</p>
            <p className="card-value">{hitIntervals ? hitIntervals.avg.toFixed(0) : '0'} ms</p>
            <p className="card-meta">
              {hitIntervals && hitIntervals.samples > 0
                ? `min ${hitIntervals.min.toFixed(0)} / max ${hitIntervals.max.toFixed(0)}`
                : '충분한 데이터가 없습니다'}
            </p>
          </div>
          <div className="detail-card bordered">
            <p className="card-label">Raw Points</p>
            <p className="card-value">{sessionData.rawData.length}</p>
            <p className="card-meta">세션에 저장된 총 샘플</p>
          </div>
        </div>
      </section>

      {/* Recent Samples 섹션 */}
      <section className="detail-section">
        <div className="section-header">
          <h2>Recent Samples</h2>
          <p className="muted">최근 8개의 수집 포인트를 기준으로 오차를 보여줍니다.</p>
        </div>
        <div className="samples-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Target</th>
                <th scope="col">Gaze error</th>
                <th scope="col">Mouse error</th>
                <th scope="col">Hit</th>
              </tr>
            </thead>
            <tbody>
              {recentSamples.map((sample, idx) => (
                <tr key={`${sample.timestamp}-${idx}`}>
                  <td className="align-left">{sample.targetId ?? '—'}</td>
                  <td>{sample.gazeErr !== null ? `${sample.gazeErr.toFixed(1)} px` : 'N/A'}</td>
                  <td>{sample.mouseErr !== null ? `${sample.mouseErr.toFixed(1)} px` : 'N/A'}</td>
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
      </section>
    </div>
  );
};

export default DetailedResultsPage;
