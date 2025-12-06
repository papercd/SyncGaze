// frontend/src/services/predictionService.ts
import type { TrainingSessionSummary } from '../state/trackingSessionContext';

export interface PredictionResult {
  predictedScore: number | null;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const buildFeaturePayload = (session: TrainingSessionSummary) => {
  const timePerTarget =
    session.duration && session.totalTargets
      ? session.duration / session.totalTargets
      : null;

  return {
    features: {
      accuracy: Number(session.accuracy) || 0,
      mouseAccuracy: Number(session.mouseAccuracy) || 0,
      gazeAccuracy: Number(session.gazeAccuracy) || 0,
      avgReactionTime_ms: Number(session.avgReactionTime) || 0,
      targetsHit: Number(session.targetsHit) || 0,
      totalTargets: Number(session.totalTargets) || 0,
      timePerTarget_s: timePerTarget,
    },
  };
};

// Keep a local heuristic so the UI still works even if the ML endpoint is unavailable.
const normalize = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return 0;
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
};

// Deterministic heuristic mapped to 0~100.
// - Accuracy / mouseAccuracy: 0~100% 그대로 정규화
// - Reaction time: 150ms → 1.0, 450ms → 0.0 (그 외는 클램프)
// - 적중률: targetsHit / totalTargets
// 가중합이므로 100을 넘지 않으며, 모든 입력이 0이면 0점.
const fallbackScorePrediction = (session: TrainingSessionSummary): number => {
  const accuracy = normalize(Number(session.accuracy) || 0, 0, 100);
  const mouseAccuracy = normalize(Number(session.mouseAccuracy) || 0, 0, 100);
  const reactionTime = Number(session.avgReactionTime) || 0;
  const reactionScore = 1 - normalize(reactionTime, 150, 450); // 빠를수록 높음

  const targetsHit = Number(session.targetsHit) || 0;
  const totalTargets = Number(session.totalTargets) || 0;
  const hitRate = totalTargets > 0 ? clamp(targetsHit / totalTargets, 0, 1) : 0;

  // 가중치 합이 1이 되도록 설정
  const weighted =
    0.35 * accuracy +
    0.20 * mouseAccuracy +
    0.25 * reactionScore +
    0.20 * hitRate;

  return Math.round(clamp(weighted * 100, 0, 100));
};

/**
 * Predict a performance score for a given session.
 * - If `VITE_PREDICTION_ENDPOINT` is configured, call it with the minimal feature payload.
 * - Otherwise, or on failure, fall back to a deterministic heuristic.
 */
export const predictScore = async (session: TrainingSessionSummary): Promise<PredictionResult> => {
  const endpoint =
    import.meta.env.VITE_PREDICTION_ENDPOINT ||
    import.meta.env.VITE_PERFORMANCE_MODEL_ENDPOINT ||
    null;

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFeaturePayload(session)),
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof data?.predictedScore === 'number') {
          return { predictedScore: data.predictedScore };
        }
        console.warn('Prediction endpoint returned unexpected payload, using fallback:', data);
      } else {
        console.warn('Prediction endpoint responded with error status, using fallback:', response.status);
      }
    } catch (error) {
      console.warn('Prediction endpoint request failed, using fallback heuristic:', error);
    }
  }

  return { predictedScore: fallbackScorePrediction(session) };
};
