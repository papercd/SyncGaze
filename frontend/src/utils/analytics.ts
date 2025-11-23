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
  
  const GAZE_HIT_THRESHOLD = 100; 
  const MOUSE_HIT_THRESHOLD = 100; // Assumed threshold for mouse tracking accuracy

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
    const gaze = firstGazeOnTarget.get(tid);
    if (start !== undefined && gaze !== undefined && gaze >= start) {
      gazeReactionTimes.push(gaze - start);
    }
  });

  const latencies: number[] = [];
  hits.forEach(hit => {
    if (!hit.targetId) return;
    const gazeArrival = firstGazeOnTarget.get(hit.targetId);
    if (gazeArrival !== undefined && hit.timestamp >= gazeArrival) {
      latencies.push(hit.timestamp - gazeArrival);
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

  return {
    totalTargets,
    targetsHit,
    accuracy: totalTargets > 0 ? (targetsHit / totalTargets) * 100 : 0,
    avgReactionTime: reactionTimes.length ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length : 0,
    avgGazeReactionTime: gazeReactionTimes.length ? gazeReactionTimes.reduce((a, b) => a + b, 0) / gazeReactionTimes.length : 0,
    gazeErrorAtHit: gazeErrorCount ? totalGazeError / gazeErrorCount : 0,
    mouseErrorAtHit: mouseErrorCount ? totalMouseError / mouseErrorCount : 0,
    gazeAccuracy: totalFramesWithTarget > 0 ? (gazeOnTargetFrames / totalFramesWithTarget) * 100 : 0,
    mouseAccuracy: totalFramesWithTarget > 0 ? (mouseOnTargetFrames / totalFramesWithTarget) * 100 : 0,
    synchronization: validSyncFrames ? totalSyncDist / validSyncFrames : 0,
    gazeAimLatency: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
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