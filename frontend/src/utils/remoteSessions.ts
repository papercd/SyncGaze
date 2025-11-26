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

interface FirestoreSessionPayload {
  session: TrainingSessionSummary;
  calibrationResult?: CalibrationResult | null;
  surveyResponses?: SurveyResponses | null;
  consentAccepted?: boolean;
  exportPath?: string | null;
  exportDownloadUrl?: string | null;
  storedAt?: unknown;
  uid?: string;
}

const stripUndefined = <T extends Record<string, unknown>>(obj: T): T => {
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
};

export const saveSessionForUser = async (
  uid: string,
  session: TrainingSessionSummary,
  {
    calibrationResult,
    surveyResponses,
    consentAccepted,
    uploadResult,
  }: {
    calibrationResult?: CalibrationResult | null;
    surveyResponses?: SurveyResponses | null;
    consentAccepted?: boolean;
    uploadResult?: CsvUploadResult | null;
  } = {},
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
  });

  const userSessionRef = doc(db, 'users', uid, 'sessions', session.id);

  await setDoc(userSessionRef, payload, { merge: true });
};

export interface StoredSessionRecord {
  session: TrainingSessionSummary;
  calibrationResult?: CalibrationResult | null;
  surveyResponses?: SurveyResponses | null;
  consentAccepted?: boolean;
  exportPath?: string | null;
  exportDownloadUrl?: string | null;
}

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
    }));
};