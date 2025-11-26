import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  hydrateSessions: (sessions: TrainingSessionSummary[]) => void;
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

  const hydrateSessions = (sessions: TrainingSessionSummary[]) => {
    setState(prev => ({
      ...prev,
      recentSessions: sessions,
      lastSession: sessions[0] ?? null,
      activeSessionId: sessions[0]?.id ?? null,
    }));
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
    hydrateSessions,
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