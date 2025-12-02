import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  CalibrationResult,
  SurveyResponses,
  TrainingSessionSummary,
} from '../state/trackingSessionContext';
import type { CsvUploadResult } from './sessionExport';
import type { PerformanceAnalytics } from './analytics';

export interface LeaderboardEntry {
  sessionId: string;
  uid: string;
  label: string;
  score: number;
  accuracy: number;
  avgReactionTime: number;
  gazeAimLatency: number;
  gazeAccuracy: number;
  mouseAccuracy: number;
  totalTargets: number;
  targetsHit: number;
  duration: number;
  sessionDate: string;
  createdAt: unknown;
  updatedAt: unknown;
}

const DEFAULT_ALIAS_PREFIX = 'user';

const buildLeaderboardLabel = (uid: string, preferredLabel?: string | null) => {
  if (!preferredLabel) {
    return `${DEFAULT_ALIAS_PREFIX}-${uid.slice(0, 6)}`;
  }

  const cleaned = preferredLabel.replace(/[^\p{L}\p{N}_-]/gu, '').trim();
  if (!cleaned) {
    return `${DEFAULT_ALIAS_PREFIX}-${uid.slice(0, 6)}`;
  }

  return cleaned.slice(0, 48);
};

const buildLeaderboardEntry = (
  uid: string,
  session: TrainingSessionSummary,
  analytics?: PerformanceAnalytics | null,
  label?: string | null,
): LeaderboardEntry => {
  const metrics = analytics ?? {
    totalTargets: session.totalTargets,
    targetsHit: session.targetsHit,
    accuracy: session.accuracy,
    avgReactionTime: session.avgReactionTime,
    avgGazeReactionTime: 0,
    gazeErrorAtHit: 0,
    mouseErrorAtHit: 0,
    gazeAccuracy: session.gazeAccuracy,
    mouseAccuracy: session.mouseAccuracy,
    synchronization: 0,
    gazeAimLatency: 0,
  };

  return {
    sessionId: session.id,
    uid,
    label: buildLeaderboardLabel(uid, label),
    score: session.score,
    accuracy: metrics.accuracy,
    avgReactionTime: metrics.avgReactionTime,
    gazeAimLatency: metrics.gazeAimLatency,
    gazeAccuracy: metrics.gazeAccuracy,
    mouseAccuracy: metrics.mouseAccuracy,
    totalTargets: metrics.totalTargets,
    targetsHit: metrics.targetsHit,
    duration: session.duration,
    sessionDate: session.date,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
};

interface FirestoreSessionPayload {
  session: TrainingSessionSummary;
  calibrationResult?: CalibrationResult | null;
  surveyResponses?: SurveyResponses | null;
  consentAccepted?: boolean;
  exportPath?: string | null;
  exportDownloadUrl?: string | null;
  storedAt?: unknown;
  uid?: string;
  analytics?: PerformanceAnalytics | null;
  leaderboardOptIn?: boolean;
  leaderboardLabel?: string | null;
}

const stripUndefined = <T extends Record<string, unknown>>(obj: T): T => {
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
};

export interface StoredSessionRecord {
  session: TrainingSessionSummary;
  calibrationResult?: CalibrationResult | null;
  surveyResponses?: SurveyResponses | null;
  consentAccepted?: boolean;
  exportPath?: string | null;
  exportDownloadUrl?: string | null;
  analytics?: PerformanceAnalytics | null;
  leaderboardOptIn?: boolean;
  leaderboardLabel?: string | null;
}

interface SaveSessionOptions {
  calibrationResult?: CalibrationResult | null;
  surveyResponses?: SurveyResponses | null;
  consentAccepted?: boolean;
  uploadResult?: CsvUploadResult | null;
  analytics?: PerformanceAnalytics | null;
  leaderboardOptIn?: boolean;
  leaderboardLabel?: string | null;
}

export const saveLeaderboardEntry = async (
  uid: string,
  session: TrainingSessionSummary,
  { analytics, label }: { analytics?: PerformanceAnalytics | null; label?: string | null } = {},
) => {
  const entry = buildLeaderboardEntry(uid, session, analytics, label);
  const leaderboardDoc = doc(db, 'leaderboardEntries', `${uid}-${session.id}`);

  await setDoc(leaderboardDoc, entry, { merge: true });
};

export const fetchSessionsForUser = async (uid: string): Promise<StoredSessionRecord[]> => {
  const sessionsRef = collection(db, 'users', uid, 'sessions');
  let snapshot;

  try {
    snapshot = await getDocs(query(sessionsRef, orderBy('session.date', 'desc')));
  } catch (error) {
    snapshot = await getDocs(sessionsRef);
  }

  return snapshot.docs
    .map(docSnap => docSnap.data() as FirestoreSessionPayload)
    .filter(record => Boolean(record.session))
    .map(record => ({
      session: {
        ...record.session,
        rawData: record.session.rawData ?? [],
        csvData: record.session.csvData ?? '',
      },
      calibrationResult: record.calibrationResult ?? null,
      surveyResponses: record.surveyResponses ?? null,
      consentAccepted: record.consentAccepted ?? false,
      exportPath: record.exportPath ?? null,
      exportDownloadUrl: record.exportDownloadUrl ?? null,
      analytics: record.analytics ?? null,
      leaderboardOptIn: record.leaderboardOptIn ?? false,
      leaderboardLabel: record.leaderboardLabel ?? null,
    }));

};

export const saveSessionForUser = async (
  uid: string,
  session: TrainingSessionSummary,
  {
    calibrationResult,
    surveyResponses,
    consentAccepted,
    uploadResult,
    analytics,
    leaderboardOptIn,
    leaderboardLabel,
  }: SaveSessionOptions = {},
) => {
  const payload: FirestoreSessionPayload = stripUndefined({
    session,
    calibrationResult: calibrationResult ?? null,
    surveyResponses: surveyResponses ?? null,
    consentAccepted: consentAccepted ?? false,
    exportPath: uploadResult?.storagePath ?? null,
    exportDownloadUrl: (uploadResult?.downloadUrl as string | undefined) ?? null,
    storedAt: serverTimestamp(),
    uid,
    analytics: analytics ?? null,
    leaderboardOptIn: Boolean(leaderboardOptIn),
    leaderboardLabel: leaderboardLabel ?? null,
  });

  const userSessionRef = doc(db, 'users', uid, 'sessions', session.id);

  await setDoc(userSessionRef, payload, { merge: true });

  if (leaderboardOptIn) {
    await saveLeaderboardEntry(uid, session, { analytics, label: leaderboardLabel });
  }
};
