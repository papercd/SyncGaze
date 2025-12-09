import { vi } from 'vitest';
import {
  CalibrationResult,
  SurveyResponses,
  TrackingSessionContextValue,
  TrainingSessionSummary,
} from '../../state/trackingSessionContext';

interface CreateTrackingSessionValueOptions extends Partial<TrackingSessionContextValue> {}

export const createTrackingSessionValue = (
  overrides: CreateTrackingSessionValueOptions = {},
): TrackingSessionContextValue => ({
  surveyResponses: null,
  consentAccepted: false,
  calibrationResult: null,
  recentSessions: [],
  lastSession: null,
  activeSessionId: null,
  isAnonymousSession: false,
  surveyHydrated: true,
  setSurveyResponses: vi.fn(),
  setConsentAccepted: vi.fn(),
  saveCalibrationResult: vi.fn(),
  addSession: vi.fn(),
  hydrateSessions: vi.fn(),
  setActiveSessionId: vi.fn(),
  clearRecentSessions: vi.fn(),
  activeSession: null,
  setAnonymousSession: vi.fn(),
  setSurveyHydrated: vi.fn(),
  resetState: vi.fn(),
  ...overrides,
});

export const buildSurveyResponses = (overrides: Partial<SurveyResponses> = {}): SurveyResponses => ({
  ageCheck: true,
  webcamCheck: true,
  gamesPlayed: ['valorant'],
  mainGame: 'valorant',
  mainGameOther: '',
  aimTrainerUsage: 'yes',
  inGameRank: 'Immortal',
  playTime: '< 100시간',
  selfAssessment: 5,
  trainingGoal: '랭크 올리기',
  ...overrides,
});

export const buildCalibrationResult = (
  overrides: Partial<CalibrationResult> = {},
): CalibrationResult => ({
  status: 'validated',
  validationError: 2,
  validationStdDev: 1.5,
  completedAt: new Date().toISOString(),
  ...overrides,
});

export const buildTrainingSession = (
  overrides: Partial<TrainingSessionSummary> = {},
): TrainingSessionSummary => ({
  id: 'test-session',
  date: new Date().toISOString(),
  duration: 60,
  score: 40,
  accuracy: 82,
  targetsHit: 40,
  totalTargets: 50,
  avgReactionTime: 250,
  gazeAccuracy: 75,
  mouseAccuracy: 90,
  controlSensitivity: 0.002,
  screenSize: { width: 1920, height: 1080 },
  csvData: 'timestamp,gazeX',
  rawData: [],
  ...overrides,
});
