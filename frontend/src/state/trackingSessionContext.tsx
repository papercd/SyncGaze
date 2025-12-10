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
  trainingGoal: string;
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
  predictedScore?: number | null;
  accuracy: number;
  targetsHit: number;
  totalTargets: number;
  avgReactionTime: number;
  gazeAccuracy: number;
  mouseAccuracy: number;
  controlSensitivity?: number;
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
  surveyHydrated: boolean;
}

export interface TrackingSessionContextValue extends TrackingSessionState {
  setSurveyResponses: (responses: SurveyResponses | null) => void;
  setConsentAccepted: (accepted: boolean) => void;
  saveCalibrationResult: (result: CalibrationResult | null) => void;
  addSession: (session: TrainingSessionSummary) => void;
  hydrateSessions: (sessions: TrainingSessionSummary[]) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  removeSession: (sessionId: string) => void;
  clearRecentSessions: () => void;
  activeSession: TrainingSessionSummary | null;
  setAnonymousSession: (isAnonymous: boolean) => void;
  setSurveyHydrated: (hydrated: boolean) => void;
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
    surveyHydrated: false,
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

const applySurveyDefaults = (value: SurveyResponses | null | undefined) => {
  if (!value) return null;
  return {
    ...value,
    trainingGoal: value.trainingGoal ?? '',
    mainGameOther: value.mainGameOther ?? '',
  };
};

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
          surveyResponses: applySurveyDefaults(parsed.surveyResponses),
          isAnonymousSession: parsed.isAnonymousSession ?? false,
          surveyHydrated: parsed.surveyHydrated ?? false,
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
      surveyResponses: applySurveyDefaults(responses),
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

  const removeSession = (sessionId: string) => {
    setState(prev => {
      const filteredSessions = prev.recentSessions.filter(session => session.id !== sessionId);
      const hasActive = filteredSessions.some(session => session.id === prev.activeSessionId);
      const nextActiveId = hasActive
        ? prev.activeSessionId
        : filteredSessions[0]?.id ?? null;

      return {
        ...prev,
        recentSessions: filteredSessions,
        lastSession: filteredSessions[0] ?? null,
        activeSessionId: nextActiveId,
      };
    });
  };

  const setAnonymousSession = (isAnonymous: boolean) => {
    setState(prev => ({
      ...prev,
      isAnonymousSession: isAnonymous,
    }));
  };

  const setSurveyHydrated = (hydrated: boolean) => {
    setState(prev => ({
      ...prev,
      surveyHydrated: hydrated,
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
    removeSession,
    clearRecentSessions,
    activeSession,
    setAnonymousSession,
    setSurveyHydrated,
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
