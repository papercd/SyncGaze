// frontend/src/utils/analytics.ts
import { TrainingDataPoint } from '../state/trackingSessionContext';

export interface PerformanceAnalytics {
  totalTargets: number;
  targetsHit: number;
  accuracy: number;            // ✅ Added: (Targets Hit / Total Targets) * 100
  avgReactionTime: number;     
  avgGazeReactionTime: number; 
  gazeErrorAtHit: number;      
  mouseErrorAtHit: number;     
  gazeAccuracy: number;        // ✅ Added: % of frames gaze was on target
  mouseAccuracy: number;       // ✅ Added: % of frames mouse was on target
  synchronization: number;     
  gazeAimLatency: number;      
}

const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
  return Math.hypot(x1 - x2, y1 - y2);
};

export const calculatePerformanceAnalytics = (data: TrainingDataPoint[]): PerformanceAnalytics => {
  if (data.length === 0) {
    return {
      totalTargets: 0,
      targetsHit: 0,
      accuracy: 0,
      avgReactionTime: 0,
      avgGazeReactionTime: 0,
      gazeErrorAtHit: 0,
      mouseErrorAtHit: 0,
      gazeAccuracy: 0,
      mouseAccuracy: 0,
      synchronization: 0,
      gazeAimLatency: 0,
    };
  }

  const hits = data.filter(d => d.targetHit);
  const targetIds = new Set<string>();
  const firstSeenByTarget = new Map<string, number>();
  const firstGazeOnTarget = new Map<string, number>();
  const firstAnyGazeAfterSeen = new Map<string, number>(); // fallback when gaze never enters threshold

  const GAZE_HIT_THRESHOLD = 100; 
  const MOUSE_HIT_THRESHOLD = 100; // Assumed threshold for mouse tracking accuracy
  const MIN_GAZE_REACTION_MS = 200; // treat smaller as noise
  const MIN_LATENCY_MS = 60; // avoid zero/negative jitter
  const MAX_GAZE_REACTION_MS = 4000; // very delayed readings treated as outliers
  
  let totalSyncDist = 0;
  let validSyncFrames = 0;
  
  // Tracking Accuracy Counters
  let totalFramesWithTarget = 0;
  let gazeOnTargetFrames = 0;
  let mouseOnTargetFrames = 0;

  // 1. Loop through data to collect metrics
  data.forEach(point => {
    // Synchronization metric
    if (point.gazeX !== null && point.gazeY !== null && point.mouseX !== null && point.mouseY !== null) {
      totalSyncDist += getDistance(point.gazeX, point.gazeY, point.mouseX, point.mouseY);
      validSyncFrames++;
    }

    if (!point.targetId) return;
    
    // Count targets
    targetIds.add(point.targetId);
    
    // Count frames where a target is active
    if (point.targetX !== null && point.targetY !== null) {
      totalFramesWithTarget++;
      
      // Gaze Tracking Accuracy
      if (point.gazeX !== null && point.gazeY !== null) {
        const gazeDist = getDistance(point.gazeX, point.gazeY, point.targetX, point.targetY);
        if (gazeDist <= GAZE_HIT_THRESHOLD) {
          gazeOnTargetFrames++;
          
          // Record first gaze on target for reaction time
          const existingGaze = firstGazeOnTarget.get(point.targetId);
          if (existingGaze === undefined || point.timestamp < existingGaze) {
            firstGazeOnTarget.set(point.targetId, point.timestamp);
          }
        }
        const existingAnyGaze = firstAnyGazeAfterSeen.get(point.targetId);
        if (existingAnyGaze === undefined || point.timestamp < existingAnyGaze) {
          firstAnyGazeAfterSeen.set(point.targetId, point.timestamp);
        }
      }

      // Mouse Tracking Accuracy
      if (point.mouseX !== null && point.mouseY !== null) {
        const mouseDist = getDistance(point.mouseX, point.mouseY, point.targetX, point.targetY);
        if (mouseDist <= MOUSE_HIT_THRESHOLD) {
          mouseOnTargetFrames++;
        }
      }
    }

    // Record first time target was seen
    const existingFirstSeen = firstSeenByTarget.get(point.targetId);
    if (existingFirstSeen === undefined || point.timestamp < existingFirstSeen) {
      firstSeenByTarget.set(point.targetId, point.timestamp);
    }
  });

  // --- Metrics Calculation ---

  const totalTargets = targetIds.size || hits.length;
  const targetsHit = hits.length;

  // 2. Reaction Times
  const reactionTimes = hits
    .map(hit => {
      if (!hit.targetId) return null;
      const firstSeen = firstSeenByTarget.get(hit.targetId);
      if (firstSeen === undefined) return null;
      return hit.timestamp - firstSeen;
    })
    .filter((v): v is number => v !== null && v >= 0);

  const gazeReactionTimes: number[] = [];
  targetIds.forEach(tid => {
    const start = firstSeenByTarget.get(tid);
    const gazePrimary = firstGazeOnTarget.get(tid);
    const gazeFallback = firstAnyGazeAfterSeen.get(tid);
    let arrival = gazePrimary ?? gazeFallback;
    if (start !== undefined && arrival !== undefined) {
      if (arrival <= start + MIN_LATENCY_MS) {
        arrival = start + MIN_LATENCY_MS;
      }
      const diff = arrival - start;
      if (diff >= MIN_GAZE_REACTION_MS && diff <= MAX_GAZE_REACTION_MS) {
        gazeReactionTimes.push(diff);
      }
    }
  });

  const latencies: number[] = [];
  hits.forEach(hit => {
    if (!hit.targetId) return;
    const start = firstSeenByTarget.get(hit.targetId);
    const gazeArrival = firstGazeOnTarget.get(hit.targetId) ?? firstAnyGazeAfterSeen.get(hit.targetId);
    if (start !== undefined && gazeArrival !== undefined) {
      const safeArrival = gazeArrival <= start + MIN_LATENCY_MS ? start + MIN_LATENCY_MS : gazeArrival;
      if (hit.timestamp > safeArrival + MIN_LATENCY_MS) {
        latencies.push(hit.timestamp - safeArrival);
      }
    }
  });

  // 3. Errors at Hit Moment
  let totalGazeError = 0;
  let gazeErrorCount = 0;
  let totalMouseError = 0;
  let mouseErrorCount = 0;

  for (let i = 0; i < data.length; i++) {
    if (data[i].targetHit) {
      const hitPoint = data[i];
      
      let targetX = hitPoint.targetX;
      let targetY = hitPoint.targetY;

      // Lookback for target coordinates if missing in current frame
      if (targetX === null || targetY === null) {
        for (let k = i - 1; k >= 0; k--) {
           if (data[k].targetId === hitPoint.targetId && data[k].targetX !== null && data[k].targetY !== null) {
             targetX = data[k].targetX;
             targetY = data[k].targetY;
             break;
           }
           if (hitPoint.timestamp - data[k].timestamp > 1000) break;
        }
      }

      if (targetX === null || targetY === null) continue;

      // Gaze Error at Hit
      for (let j = i - 1; j >= 0; j--) {
        if (data[j].gazeX !== null && data[j].gazeY !== null) {
          totalGazeError += getDistance(data[j].gazeX!, data[j].gazeY!, targetX, targetY);
          gazeErrorCount++;
          break;
        }
        if (hitPoint.timestamp - data[j].timestamp > 500) break;
      }

      // Mouse Error at Hit
      for (let j = i - 1; j >= 0; j--) {
        if (data[j].mouseX !== null && data[j].mouseY !== null) {
          totalMouseError += getDistance(data[j].mouseX!, data[j].mouseY!, targetX, targetY);
          mouseErrorCount++;
          break;
        }
        if (hitPoint.timestamp - data[j].timestamp > 500) break;
      }
    }
  }

  const avgReactionTime = reactionTimes.length
    ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
    : 0;

  let avgGazeReactionTime = gazeReactionTimes.length
    ? gazeReactionTimes.reduce((a, b) => a + b, 0) / gazeReactionTimes.length
    : 0;
  if (avgGazeReactionTime === 0 && gazeReactionTimes.length === 0) {
    avgGazeReactionTime = MIN_GAZE_REACTION_MS; // 최소 보정값으로 강제
  } else if (avgGazeReactionTime > 0 && avgGazeReactionTime < MIN_GAZE_REACTION_MS) {
    avgGazeReactionTime = MIN_GAZE_REACTION_MS;
  }

  let gazeAimLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  if (gazeAimLatency > 0 && gazeAimLatency < MIN_LATENCY_MS) {
    gazeAimLatency = MIN_LATENCY_MS;
  }

  return {
    totalTargets,
    targetsHit,
    accuracy: totalTargets > 0 ? (targetsHit / totalTargets) * 100 : 0,
    avgReactionTime,
    avgGazeReactionTime,
    gazeErrorAtHit: gazeErrorCount ? totalGazeError / gazeErrorCount : 0,
    mouseErrorAtHit: mouseErrorCount ? totalMouseError / mouseErrorCount : 0,
    gazeAccuracy: totalFramesWithTarget > 0 ? (gazeOnTargetFrames / totalFramesWithTarget) * 100 : 0,
    mouseAccuracy: totalFramesWithTarget > 0 ? (mouseOnTargetFrames / totalFramesWithTarget) * 100 : 0,
    synchronization: validSyncFrames ? totalSyncDist / validSyncFrames : 0,
    gazeAimLatency,
  };
};

export interface TimeSeriesPoint {
  time: number;
  gazeError: number | null;
  mouseError: number | null;
  synchronization: number | null;
}

export const generateErrorTimeSeries = (data: TrainingDataPoint[], duration: number): TimeSeriesPoint[] => {
  if (!data.length) return [];

  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const startTime = sorted[0].timestamp;
  const series: TimeSeriesPoint[] = [];

  const buckets = new Map<number, TrainingDataPoint[]>();
  for (let i = 0; i <= duration; i++) {
    buckets.set(i, []);
  }

  sorted.forEach(point => {
    const elapsed = Math.floor((point.timestamp - startTime) / 1000);
    if (elapsed >= 0 && elapsed <= duration) {
      buckets.get(elapsed)?.push(point);
    }
  });

  for (let i = 0; i <= duration; i++) {
    const points = buckets.get(i) || [];
    
    let gazeErrSum = 0, gazeErrCount = 0;
    let mouseErrSum = 0, mouseErrCount = 0;
    let syncSum = 0, syncCount = 0;

    points.forEach(p => {
      if (p.targetX !== null && p.targetY !== null && p.gazeX !== null && p.gazeY !== null) {
        gazeErrSum += Math.hypot(p.gazeX - p.targetX, p.gazeY - p.targetY);
        gazeErrCount++;
      }
      if (p.targetX !== null && p.targetY !== null && p.mouseX !== null && p.mouseY !== null) {
        mouseErrSum += Math.hypot(p.mouseX - p.targetX, p.mouseY - p.targetY);
        mouseErrCount++;
      }
      if (p.gazeX !== null && p.gazeY !== null && p.mouseX !== null && p.mouseY !== null) {
        syncSum += Math.hypot(p.gazeX - p.mouseX, p.gazeY - p.mouseY);
        syncCount++;
      }
    });

    series.push({
      time: i,
      gazeError: gazeErrCount ? gazeErrSum / gazeErrCount : null,
      mouseError: mouseErrCount ? mouseErrSum / mouseErrCount : null,
      synchronization: syncCount ? syncSum / syncCount : null,
    });
  }

  return series;
};
