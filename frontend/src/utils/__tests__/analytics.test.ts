import { describe, expect, it } from 'vitest';
import { calculatePerformanceAnalytics } from '../analytics';
import type { TrainingDataPoint } from '../../state/trackingSessionContext';

describe('calculatePerformanceAnalytics', () => {
  it('computes accuracy and reaction metrics from tracking data', () => {
    const data: TrainingDataPoint[] = [
      {
        timestamp: 0,
        gazeX: null,
        gazeY: null,
        mouseX: null,
        mouseY: null,
        targetHit: false,
        targetId: 't1',
        targetX: 100,
        targetY: 100,
      },
      {
        timestamp: 200,
        gazeX: 102,
        gazeY: 98,
        mouseX: 110,
        mouseY: 105,
        targetHit: false,
        targetId: 't1',
        targetX: 100,
        targetY: 100,
      },
      {
        timestamp: 500,
        gazeX: 101,
        gazeY: 99,
        mouseX: 103,
        mouseY: 101,
        targetHit: true,
        targetId: 't1',
        targetX: 100,
        targetY: 100,
      },
      {
        timestamp: 0,
        gazeX: null,
        gazeY: null,
        mouseX: null,
        mouseY: null,
        targetHit: false,
        targetId: 't2',
        targetX: 300,
        targetY: 300,
      },
    ];

    const result = calculatePerformanceAnalytics(data);

    expect(result.targetsHit).toBe(1);
    expect(result.totalTargets).toBe(2);
    expect(result.accuracy).toBeCloseTo(50, 1);
    expect(result.avgReactionTime).toBeGreaterThanOrEqual(500);
    expect(result.avgGazeReactionTime).toBeGreaterThanOrEqual(200);
    expect(result.gazeAccuracy).toBeGreaterThan(0);
    expect(result.mouseAccuracy).toBeGreaterThanOrEqual(0);
  });
});
