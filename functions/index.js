// functions/index.js
import * as functions from "firebase-functions/v1";
import { onRequest } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import express from "express";
import cors from "cors";

// 중요: 경로에 '/src'가 포함되어야 하며, .js 확장자를 명시해야 합니다.
import { submitSurveyRoute } from "./src/routes/submitSurvey.js";
import { uploadCsvRoute } from "./src/routes/uploadCsv.js";
import { generateReportRoute } from "./src/routes/generateReport.js";

// dotenv는 functions 설정에서는 보통 process.env로 자동 주입되거나
// firebase functions:config:set을 사용하므로 여기서는 생략 가능하나, 
// 로컬 테스트를 위해 남겨둘 경우:
import dotenv from 'dotenv';
dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const MODEL_ENDPOINT = process.env.PERFORMANCE_MODEL_ENDPOINT || null;
// If using PCA-based unsupervised scoring, set USE_PCA_SCORING=true to enable local scoring.
const USE_PCA_SCORING = process.env.USE_PCA_SCORING === 'true';

const app = express();

// CORS 설정
app.use(cors({ origin: true }));

// 라우트 설정
// 기존 backend/src/server.js의 설정을 그대로 가져옵니다.
app.use('/api/upload-csv', express.text({ type: '*/*', limit: '1mb' }), uploadCsvRoute);
app.use('/api/submit-survey', express.json({ limit: '1mb' }), submitSurveyRoute);
app.use('/api/generate-report', express.json({ limit: '1mb' }), generateReportRoute); // ADD THIS LINE

app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

app.use((err, req, res, next) => { // eslint-disable-line @typescript-eslint/no-unused-vars
  console.error('Unexpected server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Firebase Cloud Function으로 내보내기
export const api = onRequest(app);

const DEFAULT_ALIAS_PREFIX = 'user';

const buildLeaderboardLabel = (uid, preferredLabel) => {
  if (!preferredLabel) {
    return `${DEFAULT_ALIAS_PREFIX}-${uid.slice(0, 6)}`;
  }

  const cleaned = preferredLabel.replace(/[^\p{L}\p{N}_-]/gu, '').trim();
  if (!cleaned) {
    return `${DEFAULT_ALIAS_PREFIX}-${uid.slice(0, 6)}`;
  }

  return cleaned.slice(0, 48);
};

const buildLeaderboardEntry = (uid, session, analytics = null, label = null) => {
  const resolvedAnalytics = analytics || {};
  const predictedScore = session?.predictedScore ?? resolvedAnalytics.predictedScore ?? null;
  return {
    sessionId: session.id,
    uid,
    label: buildLeaderboardLabel(uid, label),
    score: session.score ?? predictedScore ?? 0,
    predictedScore: predictedScore,
    accuracy: resolvedAnalytics.accuracy ?? session.accuracy ?? 0,
    avgReactionTime: resolvedAnalytics.avgReactionTime ?? session.avgReactionTime ?? 0,
    gazeAimLatency: resolvedAnalytics.gazeAimLatency ?? session.gazeAimLatency ?? 0,
    gazeAccuracy: resolvedAnalytics.gazeAccuracy ?? session.gazeAccuracy ?? 0,
    mouseAccuracy: resolvedAnalytics.mouseAccuracy ?? session.mouseAccuracy ?? 0,
    totalTargets: resolvedAnalytics.totalTargets ?? session.totalTargets ?? 0,
    targetsHit: resolvedAnalytics.targetsHit ?? session.targetsHit ?? 0,
    duration: session.duration ?? 0,
    sessionDate: session.date ?? new Date().toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

/**
 * Firestore 트리거: 세션 데이터가 저장되면 리더보드용 엔트리를 동기화합니다.
 * 프런트엔드가 leaderboardEntries를 직접 쓰지 못하더라도,
 * users/{uid}/sessions/{sessionId}의 요약 정보로 리더보드를 채울 수 있습니다.
 */
export const syncSessionToLeaderboard = functions.firestore
  .document('users/{uid}/sessions/{sessionId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) {
      return null;
    }

    const data = change.after.data();
    const session = data?.session;

    if (!session?.id) {
      console.warn('Skipping leaderboard sync: missing session summary', context.params);
      return null;
    }

    if (data?.leaderboardOptIn === false) {
      return null;
    }

    const analytics = data?.analytics ?? null;
    const label = data?.leaderboardLabel ?? data?.session?.label ?? null;
    const entry = buildLeaderboardEntry(context.params.uid, session, analytics, label);

    const docId = `${context.params.uid}-${session.id}`;
    await firestore.collection('leaderboardEntries').doc(docId).set(entry, { merge: true });

    return null;
  });

/**
 * Extract features from a session document for the ML model.
 * Keeps the schema aligned with analysis/session_features_local.csv.
 */
const buildFeatureVector = (data) => {
  const session = data?.session || {};
  const analytics = data?.analytics || {};
  const pickNum = (path, fallback = null) => {
    const val = path;
    if (val === undefined || val === null || Number.isNaN(Number(val))) return fallback;
    return Number(val);
  };

  return {
    accuracy: pickNum(analytics.accuracy ?? session.accuracy, 0),
    mouseAccuracy: pickNum(analytics.mouseAccuracy ?? session.mouseAccuracy, 0),
    gazeAccuracy: pickNum(analytics.gazeAccuracy ?? session.gazeAccuracy, 0),
    avgReactionTime_ms: pickNum(analytics.avgReactionTime ?? session.avgReactionTime, 0),
    gazeAimLatency_ms: pickNum(analytics.gazeAimLatency ?? session.gazeAimLatency, 0),
    duration_s: pickNum(session.duration, 0),
    targetsHit: pickNum(analytics.targetsHit ?? session.targetsHit, 0),
    totalTargets: pickNum(analytics.totalTargets ?? session.totalTargets, 0),
    timePerTarget_s: pickNum(session.timePerTarget_s, null),
    validationError_px: pickNum(session.validationError_px ?? data?.validationError_px, null),
    validationStdDev_px: pickNum(session.validationStdDev_px ?? data?.validationStdDev_px, null),
    screenWidth: pickNum(session.screenWidth ?? data?.screenWidth, null),
    screenHeight: pickNum(session.screenHeight ?? data?.screenHeight, null),
    selfAssessment: pickNum(data?.selfAssessment, null),
    inGameRank: data?.inGameRank ?? null,
    playTime: data?.playTime ?? null,
    mainGame: data?.mainGame ?? null,
    aimTrainerUsage: data?.aimTrainerUsage ?? null,
    calibrationStatus: data?.calibrationStatus ?? null,
    // Derived
    targetsPerSec: pickNum(session.targetsHit && session.duration ? session.targetsHit / session.duration : null, null),
  };
};

const fallbackScorePrediction = (features) => {
  const accuracy = Number(features.accuracy) || 0;
  const mouseAccuracy = Number(features.mouseAccuracy) || 0;
  const targetsHit = Number(features.targetsHit) || 0;
  const totalTargets = Number(features.totalTargets) || 0;
  // Simple heuristic: weighted mix of targets and accuracies
  const base = targetsHit * 1.0;
  const accBoost = (accuracy + mouseAccuracy) * (totalTargets ? totalTargets / 200 : 0.25);
  return Math.max(0, Math.round(base + accBoost));
};

// Precomputed PCA stats from analysis/session_features_local.csv (PC1)
const PCA_STATS = {
  features: [
    'accuracy',
    'mouseAccuracy',
    'gazeAccuracy',
    'avgReactionTime_ms',
    'gazeAimLatency_ms',
    'targetsHit',
    'totalTargets',
    'timePerTarget_s',
  ],
  imputer_median: [84.44, 49.51, 2.44, 1015.45, null, 44.0, 54.0, 1.1111111111111112],
  scaler_mean: [81.91744186046512, 49.97488372093022, 5.649302325581396, 993.4102325581397, 45.58139534883721, 54.2093023255814, 1.1560125060648254],
  scaler_scale: [16.55625338094527, 7.019733438288002, 9.381659097421263, 184.31740009835127, 15.899733152857358, 11.105326900175521, 0.24372260588449912],
  pca_loadings: [-0.37955949671397415, 0.012333309266957665, 0.20643296176826806, 0.4309705821837465, -0.4592495807418883, -0.4538405050676167, 0.45885824180558626],
  pc1_mean: 0.0,
  pc1_std: 2.121696912734458,
};

const pcaScorePrediction = (features) => {
  const f = PCA_STATS.features;
  const med = PCA_STATS.imputer_median;
  const mean = PCA_STATS.scaler_mean;
  const scale = PCA_STATS.scaler_scale;
  const load = PCA_STATS.pca_loadings;

  const values = [];
  for (let i = 0; i < f.length; i++) {
    const key = f[i];
    const raw = Number(features[key]);
    const filled = Number.isFinite(raw) ? raw : med[i];
    const centered = (filled - mean[i]) / (scale[i] || 1);
    values.push(centered);
  }

  let pc1 = 0;
  for (let i = 0; i < load.length; i++) {
    pc1 += load[i] * values[i];
  }

  const z = (pc1 - (PCA_STATS.pc1_mean || 0)) / (PCA_STATS.pc1_std || 1);
  const score = Math.max(0, Math.min(100, 50 + z * 10));
  return score;
};

/**
 * Firestore 트리거: 세션 저장 시 ML 예측을 수행해 predictedScore를 세션/리더보드에 병합.
 * - PERFORMANCE_MODEL_ENDPOINT 환경변수가 설정된 경우: 해당 HTTP 엔드포인트로 POST하여 예측값 사용
 * - USE_PCA_SCORING=true 인 경우: 로컬 PCA 기반 점수
 * - 둘 다 없거나 실패 시: 간단한 휴리스틱으로 추정
 */
export const predictSessionPerformance = functions.firestore
  .document('users/{uid}/sessions/{sessionId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;
    const data = change.after.data();
    if (!data?.session) return null;

    // 이미 예측값이 있다면 스킵
    if (data.session.predictedScore !== undefined || data.predictedScore !== undefined) {
      return null;
    }

    const features = buildFeatureVector(data);
    let predictedScore = null;

    if (MODEL_ENDPOINT) {
      try {
        const resp = await fetch(MODEL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ features }),
        });
        if (!resp.ok) {
          throw new Error(`Model endpoint error: ${resp.status}`);
        }
        const payload = await resp.json();
        if (typeof payload.predictedScore === 'number') {
          predictedScore = payload.predictedScore;
        }
      } catch (err) {
        console.error('Model endpoint failed, using fallback:', err);
      }
    }

    if (predictedScore === null && USE_PCA_SCORING) {
      predictedScore = pcaScorePrediction(features);
    }

    if (predictedScore === null) {
      predictedScore = fallbackScorePrediction(features);
    }

    // 세션 문서 업데이트
    await change.after.ref.set(
      {
        predictedScore,
        session: {
          ...data.session,
          predictedScore,
        },
      },
      { merge: true },
    );

    // 리더보드도 함께 업데이트
    const docId = `${context.params.uid}-${data.session.id}`;
    await firestore
      .collection('leaderboardEntries')
      .doc(docId)
      .set({ predictedScore }, { merge: true });

    return null;
  });
