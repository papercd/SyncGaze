import { describe, expect, it } from 'vitest';
import { predictScore } from '../predictionService';
import type { TrainingSessionSummary } from '../../state/trackingSessionContext';

describe('predictScore fallback heuristic', () => {
  it('returns a deterministic score when endpoint is absent', async () => {
    const session: TrainingSessionSummary = {
      id: 'test-session',
      date: new Date().toISOString(),
      duration: 60,
      score: 0,
      accuracy: 88,
      targetsHit: 45,
      totalTargets: 50,
      avgReactionTime: 240,
      gazeAccuracy: 82,
      mouseAccuracy: 92,
      csvData: '',
      rawData: [],
    };

    const { predictedScore } = await predictScore(session);

    expect(predictedScore).toBe(85);
  });
});
