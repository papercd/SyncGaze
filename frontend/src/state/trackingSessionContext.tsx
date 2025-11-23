import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './authContext';

export interface SurveyResponses {
  ageCheck: boolean;
  webcamCheck: boolean;
  gamesPlayed: string[];
  mainGame: string;
  mainGameOther: string;
  aimTrainerUsage: 'yes' | 'no' | '';
  inGameRank: string;
  playTime: string;
  selfAssessment: number;
}

export type CalibrationStatus = 'not-started' | 'in-progress' | 'validated' | 'skipped';

export interface CalibrationResult {
  status: CalibrationStatus;
  validationError: number | null;
  validationStdDev?: number | null;
  completedAt?: string;
}

export interface TrainingDataPoint {
  timestamp: number;
  gazeX: number | null;
  gazeY: number | null;
  mouseX: number | null;
  mouseY: number | null;
  targetHit: boolean;
  targetId: string | null;
  targetX: number | null;
  targetY: number | null;
}

export interface TrainingSessionSummary {
  id: string;
  date: string;
  duration: number;
  score: number;
  accuracy: number;
  targetsHit: number;
  totalTargets: number;
  avgReactionTime: number;
  gazeAccuracy: number;
  mouseAccuracy: number;
  screenSize?: { width: number; height: number } | null;
  csvData: string;
  rawData: TrainingDataPoint[];
  exportPath?: string | null;
  exportDownloadUrl?: string | null;
  exportUploadedAt?: string | null;
}

interface TrackingSessionState {
  surveyResponses: SurveyResponses | null;
  consentAccepted: boolean;
  calibrationResult: CalibrationResult | null;
  recentSessions: TrainingSessionSummary[];
  lastSession: TrainingSessionSummary | null;
  activeSessionId: string | null;
  isAnonymousSession: boolean;
}

export interface TrackingSessionContextValue extends TrackingSessionState {
  setSurveyResponses: (responses: SurveyResponses | null) => void;
  setConsentAccepted: (accepted: boolean) => void;
  saveCalibrationResult: (result: CalibrationResult | null) => void;
  addSession: (session: TrainingSessionSummary) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  clearRecentSessions: () => void;
  activeSession: TrainingSessionSummary | null;
  setAnonymousSession: (isAnonymous: boolean) => void;
  resetState: () => void;
}

export interface SaveSurveyAndConsentPayload {
  uid: string;
  surveyResponses?: SurveyResponses;
  consentTimestamp?: string;
}

const STORAGE_KEY = 'trackingSessionState';

// ✅ FIXED: Empty array instead of mock data
const defaultSessions: TrainingSessionSummary[] = [];

const resolveTimestampToIsoString = (value: string | Timestamp | null | undefined): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return null;
};

const parseNumberOrNull = (value: string | number | null | undefined): number | null => {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseBooleanFromString = (value: string | boolean | null | undefined): boolean => {
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

const parseRawDataFromCsv = (csv: string): TrainingDataPoint[] => {
  const lines = csv.split(/\r?\n/);
  const headerIndex = lines.findIndex(line => line.trim().toLowerCase().startsWith('timestamp,'));
  if (headerIndex === -1) return [];

  return lines
    .slice(headerIndex + 1)
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [timestamp, taskId, targetX, targetY, gazeX, gazeY, mouseX, mouseY, targetHit] = line
        .split(',')
        .map(part => part.trim());

      const parsedTimestamp = Number(timestamp);

      return {
        timestamp: Number.isNaN(parsedTimestamp) ? Date.now() : parsedTimestamp,
        targetId: taskId || null,
        targetX: parseNumberOrNull(targetX),
        targetY: parseNumberOrNull(targetY),
        gazeX: parseNumberOrNull(gazeX),
        gazeY: parseNumberOrNull(gazeY),
        mouseX: parseNumberOrNull(mouseX),
        mouseY: parseNumberOrNull(mouseY),
        targetHit: parseBooleanFromString(targetHit),
      } as TrainingDataPoint;
    });
};

const createDefaultState = (): TrackingSessionState => {
  const sessions = defaultSessions.map(session => ({
    ...session,
    rawData: [...session.rawData],
  }));

  return {
    surveyResponses: null,
    consentAccepted: false,
    calibrationResult: null,
    recentSessions: sessions,
    lastSession: sessions[0] ?? null,
    activeSessionId: sessions[0]?.id ?? null,
    isAnonymousSession: false,
  };
};

const buildSurveyFromDoc = (data: Record<string, unknown> | undefined): SurveyResponses | null => {
  if (!data) return null;

  const gamesPlayed = Array.isArray(data.gamesPlayed)
    ? (data.gamesPlayed as unknown[]).map(String)
    : [];

  return {
    ageCheck: Boolean(data.ageCheck),
    webcamCheck: Boolean(data.webcamCheck),
    gamesPlayed,
    mainGame: typeof data.mainGame === 'string' ? data.mainGame : '',
    mainGameOther: typeof data.mainGameOther === 'string' ? data.mainGameOther : '',
    aimTrainerUsage: (data.aimTrainerUsage as SurveyResponses['aimTrainerUsage']) ?? '',
    inGameRank: typeof data.inGameRank === 'string' ? data.inGameRank : '',
    playTime: typeof data.playTime === 'string' ? data.playTime : '',
    selfAssessment: typeof data.selfAssessment === 'number' ? data.selfAssessment : Number(data.selfAssessment) || 0,
  };
};

const fetchLatestSurveyForUser = async (uid: string): Promise<SurveyResponses | null> => {
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'surveys'));
    if (snapshot.empty) return null;

    const sortedDocs = snapshot.docs
      .map(docSnap => ({ data: docSnap.data(), docId: docSnap.id }))
      .sort((a, b) => {
        const aTime = resolveTimestampToIsoString((a.data.createdAt as Timestamp | undefined) ?? (a.data.receivedAt as Timestamp | undefined));
        const bTime = resolveTimestampToIsoString((b.data.createdAt as Timestamp | undefined) ?? (b.data.receivedAt as Timestamp | undefined));
        return (bTime ? Date.parse(bTime) : 0) - (aTime ? Date.parse(aTime) : 0);
      });

    return buildSurveyFromDoc(sortedDocs[0]?.data);
  } catch (error) {
    console.warn('Failed to fetch survey from Firestore', error);
    return null;
  }
};

const fetchConsentTimestampForUser = async (uid: string): Promise<string | null> => {
  try {
    const consentDoc = await getDoc(doc(db, 'users', uid, 'consent', 'latest'));
    if (!consentDoc.exists()) return null;

    const data = consentDoc.data();
    const consentTimestamp = resolveTimestampToIsoString(data?.consentTimestamp as Timestamp | string | undefined);
    return consentTimestamp ?? null;
  } catch (error) {
    console.warn('Failed to fetch consent timestamp', error);
    return null;
  }
};

const hydrateSessionFromDoc = (
  id: string,
  data: Record<string, unknown>,
): TrainingSessionSummary => {
  const dateValue = (data.date as Timestamp | string | Date | undefined) ?? data.createdAt;
  const date = resolveTimestampToIsoString(dateValue as Timestamp | string | Date | null | undefined) ??
    new Date().toISOString();

  const rawData = Array.isArray(data.rawData)
    ? (data.rawData as TrainingDataPoint[])
    : [];

  const csvData = typeof data.csvData === 'string' ? data.csvData : '';

  return {
    id,
    date,
    duration: typeof data.duration === 'number' ? data.duration : Number(data.duration) || 0,
    score: typeof data.score === 'number' ? data.score : Number(data.score) || 0,
    accuracy: typeof data.accuracy === 'number' ? data.accuracy : Number(data.accuracy) || 0,
    targetsHit: typeof data.targetsHit === 'number' ? data.targetsHit : Number(data.targetsHit) || 0,
    totalTargets: typeof data.totalTargets === 'number' ? data.totalTargets : Number(data.totalTargets) || 0,
    avgReactionTime:
      typeof data.avgReactionTime === 'number' ? data.avgReactionTime : Number(data.avgReactionTime) || 0,
    gazeAccuracy: typeof data.gazeAccuracy === 'number' ? data.gazeAccuracy : Number(data.gazeAccuracy) || 0,
    mouseAccuracy: typeof data.mouseAccuracy === 'number' ? data.mouseAccuracy : Number(data.mouseAccuracy) || 0,
    screenSize: (data as { screenSize?: { width: number; height: number } }).screenSize ?? null,
    csvData,
    rawData,
    exportPath: typeof data.exportPath === 'string' ? data.exportPath : null,
    exportDownloadUrl:
      typeof data.exportDownloadUrl === 'string'
        ? data.exportDownloadUrl
        : typeof data.exportUrl === 'string'
          ? data.exportUrl
          : null,
    exportUploadedAt: resolveTimestampToIsoString(
      data.exportUploadedAt as Timestamp | string | Date | null | undefined,
    ),
  };
};

const fetchSessionsForUser = async (uid: string): Promise<TrainingSessionSummary[]> => {
  try {
    const sessionsRef = collection(db, 'users', uid, 'sessions');
    const snapshot = await getDocs(query(sessionsRef, orderBy('createdAt', 'desc'), limit(10)));

    const sessions = snapshot.docs.map(docSnap => hydrateSessionFromDoc(docSnap.id, docSnap.data()));

    return Promise.all(
      sessions.map(async session => {
        if (session.csvData || !session.exportDownloadUrl) {
          return session;
        }

        try {
          const response = await fetch(session.exportDownloadUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch CSV for session ${session.id}`);
          }
          const csvText = await response.text();
          const rawData = parseRawDataFromCsv(csvText);
          return {
            ...session,
            csvData: csvText,
            rawData: rawData.length ? rawData : session.rawData,
          };
        } catch (error) {
          console.warn('Unable to hydrate CSV from storage', error);
          return session;
        }
      }),
    );
  } catch (error) {
    console.warn('Failed to fetch sessions from Firestore', error);
    return [];
  }
};

export const persistSessionToFirestore = async (
  uid: string,
  session: TrainingSessionSummary,
): Promise<void> => {
  try {
    const { csvData, ...sessionWithoutCsv } = session;
    void csvData;
    const sessionRef = doc(db, 'users', uid, 'sessions', session.id);
    const createdAtValue = sessionWithoutCsv.date ? new Date(sessionWithoutCsv.date) : serverTimestamp();
    await setDoc(
      sessionRef,
      {
        ...sessionWithoutCsv,
        createdAt: createdAtValue,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Failed to persist session to Firestore', error);
  }
};

export const persistSessionExportMetadata = async (
  uid: string,
  sessionId: string,
  metadata: { exportPath?: string | null; exportDownloadUrl?: string | null; exportUploadedAt?: string | null },
) => {
  try {
    const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
    const exportUploadedAtValue = metadata.exportUploadedAt
      ? new Date(metadata.exportUploadedAt)
      : serverTimestamp();
    await setDoc(
      sessionRef,
      {
        ...metadata,
        updatedAt: serverTimestamp(),
        exportUploadedAt: exportUploadedAtValue,
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Failed to persist export metadata', error);
  }
};

export const saveSurveyAndConsent = async ({
  uid,
  surveyResponses,
  consentTimestamp,
}: SaveSurveyAndConsentPayload) => {
  const writes: Promise<unknown>[] = [];

  if (surveyResponses) {
    const surveysCollection = collection(db, 'users', uid, 'surveys');
    writes.push(
      addDoc(surveysCollection, {
        ...surveyResponses,
        createdAt: serverTimestamp(),
      }),
    );
  }

  if (consentTimestamp) {
    const consentDoc = doc(db, 'users', uid, 'consent', 'latest');
    writes.push(
      setDoc(
        consentDoc,
        {
          consentTimestamp,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
  }

  if (writes.length === 0) {
    return;
  }

  await Promise.all(writes);
};

export const TrackingSessionContext = createContext<TrackingSessionContextValue | undefined>(undefined);

export const TrackingSessionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<TrackingSessionState>(() => {
    if (typeof window === 'undefined') {
      return createDefaultState();
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TrackingSessionState;
        return {
          ...createDefaultState(),
          ...parsed,
          isAnonymousSession: parsed.isAnonymousSession ?? false,
        };
      }
      return createDefaultState();
    } catch (error) {
      console.warn('Failed to parse tracking session state:', error);
      return createDefaultState();
    }
  });

  const { user } = useAuth();

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setState(createDefaultState());
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    let cancelled = false;

    const hydrateFromCloud = async () => {
      try {
        const [cloudSurvey, consentTimestamp, cloudSessions] = await Promise.all([
          fetchLatestSurveyForUser(uid),
          fetchConsentTimestampForUser(uid),
          fetchSessionsForUser(uid),
        ]);

        if (cancelled) return;

        setState(prev => {
          const sessions = cloudSessions.length ? cloudSessions : prev.recentSessions;
          const lastSession = sessions[0] ?? prev.lastSession;
          const activeSessionId = prev.activeSessionId ?? lastSession?.id ?? null;

          return {
            ...prev,
            surveyResponses: cloudSurvey ?? prev.surveyResponses,
            consentAccepted: Boolean(consentTimestamp ?? prev.consentAccepted),
            recentSessions: sessions,
            lastSession,
            activeSessionId,
            isAnonymousSession: false,
          };
        });
      } catch (error) {
        console.warn('Failed to hydrate tracking data from Firestore/Storage', error);
      }
    };

    hydrateFromCloud();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setSurveyResponses = (responses: SurveyResponses | null) => {
    setState(prev => ({
      ...prev,
      surveyResponses: responses,
    }));
  };

  const setConsentAccepted = (accepted: boolean) => {
    setState(prev => ({
      ...prev,
      consentAccepted: accepted,
    }));
  };

  const saveCalibrationResult = (result: CalibrationResult | null) => {
    setState(prev => ({
      ...prev,
      calibrationResult: result,
    }));
  };

  const addSession = (session: TrainingSessionSummary) => {
    setState(prev => {
      const nextSessions = [session, ...prev.recentSessions].slice(0, 10);
      return {
        ...prev,
        recentSessions: nextSessions,
        lastSession: session,
        activeSessionId: session.id,
      };
    });
  };

  const setActiveSessionId = (sessionId: string | null) => {
    setState(prev => ({
      ...prev,
      activeSessionId: sessionId,
    }));
  };

  const clearRecentSessions = () => {
    setState(prev => ({
      ...prev,
      recentSessions: [],
      lastSession: null,
      activeSessionId: null,
    }));
  };

  const setAnonymousSession = (isAnonymous: boolean) => {
    setState(prev => ({
      ...prev,
      isAnonymousSession: isAnonymous,
    }));
  };

  const resetState = () => {
    setState(createDefaultState());
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const activeSession = useMemo(() => {
    if (!state.activeSessionId) {
      return state.lastSession;
    }
    return state.recentSessions.find(session => session.id === state.activeSessionId) ?? state.lastSession;
  }, [state.activeSessionId, state.lastSession, state.recentSessions]);

  const value = useMemo<TrackingSessionContextValue>(() => ({
    ...state,
    setSurveyResponses,
    setConsentAccepted,
    saveCalibrationResult,
    addSession,
    setActiveSessionId,
    clearRecentSessions,
    activeSession,
    setAnonymousSession,
    resetState,
  }), [state, activeSession]);

  return (
    <TrackingSessionContext.Provider value={value}>
      {children}
    </TrackingSessionContext.Provider>
  );
};

export const useTrackingSession = () => {
  const context = useContext(TrackingSessionContext);
  if (!context) {
    throw new Error('useTrackingSession must be used within a TrackingSessionProvider');
  }
  return context;
};