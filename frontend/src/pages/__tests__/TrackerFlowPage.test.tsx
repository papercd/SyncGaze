import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TrackerFlowPage from '../TrackerFlowPage';
import {
  buildCalibrationResult,
  buildSurveyResponses,
  buildTrainingSession,
} from '../../tests/mocks/trackingSession';

const navigateMock = vi.hoisted(() => vi.fn());
const useTrackingSessionMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../state/languageContext', () => ({
  useTranslation: () => ({
    t: (_: string, fallback?: string) => fallback ?? _,
    language: 'ko' as const,
    setLanguage: vi.fn(),
    toggleLanguage: vi.fn(),
  }),
}));

vi.mock('../../state/trackingSessionContext', () => ({
  useTrackingSession: () => useTrackingSessionMock(),
}));

describe('TrackerFlowPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useTrackingSessionMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('marks each step complete and surfaces recent session data', () => {
    const session = buildTrainingSession({
      accuracy: 88.5,
      targetsHit: 45,
      totalTargets: 50,
      avgReactionTime: 230,
    });

    useTrackingSessionMock.mockReturnValue({
      surveyResponses: buildSurveyResponses(),
      consentAccepted: true,
      calibrationResult: buildCalibrationResult({ validationError: 3.6 }),
      activeSession: session,
      recentSessions: [session],
    });

    render(
      <MemoryRouter>
        <TrackerFlowPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('완료')).toHaveLength(5);
    expect(screen.getByText(/4px error/)).toBeInTheDocument();
    expect(screen.getByText(/45\/50/)).toBeInTheDocument();
    expect(screen.getByText(/88\.5%/)).toBeInTheDocument();

    navigateMock.mockClear();
    screen.getAllByRole('button', { name: '결과 보기' })[0].click();
    expect(navigateMock).toHaveBeenCalledWith('/results');
  });

  it('shows pending states and empty sessions when progress is missing', () => {
    useTrackingSessionMock.mockReturnValue({
      surveyResponses: null,
      consentAccepted: false,
      calibrationResult: null,
      activeSession: null,
      recentSessions: [],
    });

    render(
      <MemoryRouter>
        <TrackerFlowPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('대기')).toHaveLength(5);
    expect(screen.getByText('아직 저장된 세션이 없습니다.')).toBeInTheDocument();

    screen.getAllByRole('button', { name: '트레이닝 실행' })[0].click();
    expect(navigateMock).toHaveBeenCalledWith('/training');
  });
});
