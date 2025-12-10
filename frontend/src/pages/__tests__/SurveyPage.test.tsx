import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SurveyPage from '../onboarding/SurveyPage';

const submitSurveyResponses = vi.hoisted(() => vi.fn());
const saveSurveyAndConsent = vi.hoisted(() => vi.fn());
const setSurveyResponses = vi.hoisted(() => vi.fn());

vi.mock('../../state/authContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', email: 'tester@example.com' },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock('../../state/languageContext', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    language: 'ko' as const,
    setLanguage: vi.fn(),
    toggleLanguage: vi.fn(),
  }),
}));

vi.mock('../../state/trackingSessionContext', () => ({
  useTrackingSession: () => ({
    surveyResponses: null,
    setSurveyResponses,
    activeSession: { id: 'session-77' },
  }),
  saveSurveyAndConsent,
}));

vi.mock('../../features/onboarding/survey', async () => {
  const actual = await vi.importActual<typeof import('../../features/onboarding/survey')>(
    '../../features/onboarding/survey',
  );
  return {
    ...actual,
    submitSurveyResponses,
  };
});

describe('SurveyPage', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  const renderSurvey = (initialEntry: string | { pathname: string; state?: unknown } = '/onboarding/survey') =>
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/onboarding/survey" element={<SurveyPage />} />
          <Route path="/dashboard" element={<div>Dashboard Destination</div>} />
          <Route path="/tracker-flow" element={<div>Tracker Flow Destination</div>} />
        </Routes>
      </MemoryRouter>,
    );

  const fillValidSurvey = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getAllByLabelText(/기본 PC/)[0]);
    await user.click(screen.getAllByLabelText(/시선 추적/)[0]);

    await user.click(screen.getAllByRole('button', { name: /발로란트/ })[0]);
    await user.selectOptions(screen.getAllByLabelText(/드롭다운/)[0], '발로란트 (Valorant)');

    await user.click(screen.getAllByLabelText('예')[0]);
    await user.type(screen.getAllByPlaceholderText(/예: 실버/)[0], 'Immortal 2');
    await user.selectOptions(screen.getAllByLabelText(/주당 얼마나/)[0], '주 7-14시간');
    fireEvent.change(screen.getAllByLabelText(/자기 평가는/)[0], { target: { value: '7' } });
    await user.type(screen.getAllByLabelText(/달성하고 싶은 목표/)[0], '랭크 올리기');
  };

  beforeEach(() => {
    submitSurveyResponses.mockResolvedValue({ ok: true });
    saveSurveyAndConsent.mockResolvedValue(undefined);
    setSurveyResponses.mockClear();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    alertSpy.mockRestore();
  });

  it('blocks submission when required fields are missing', async () => {
    const user = userEvent.setup();
    renderSurvey();

    await user.click(screen.getAllByRole('button', { name: /저장하고 계속하기/ })[0]);

    expect(screen.getByRole('alert')).toHaveTextContent(/웹캠|시선 추적/);
    expect(submitSurveyResponses).not.toHaveBeenCalled();
    expect(saveSurveyAndConsent).not.toHaveBeenCalled();
  });

  it('persists and submits the survey, falling back to demo mode if API fails', async () => {
    submitSurveyResponses.mockRejectedValueOnce(new Error('network down'));

    const user = userEvent.setup();
    renderSurvey({ pathname: '/onboarding/survey', state: { from: '/tracker-flow' } });

    await fillValidSurvey(user);

    await waitFor(() => {
      expect(window.sessionStorage.getItem('tracker.onboarding.surveyDraft')).toContain('valorant');
    });

    await user.click(screen.getAllByRole('button', { name: /저장하고 계속하기/ })[0]);

    await waitFor(() => {
      expect(setSurveyResponses).toHaveBeenCalled();
      expect(saveSurveyAndConsent).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'user-123',
          surveyResponses: expect.objectContaining({ mainGame: 'valorant' }),
        }),
      );
    });

    expect(submitSurveyResponses).toHaveBeenCalledWith(
      expect.objectContaining({ mainGame: 'valorant' }),
      expect.objectContaining({ sessionId: 'session-77', uid: 'user-123' }),
    );
    expect(alertSpy).toHaveBeenCalled();
    expect(window.sessionStorage.getItem('tracker.onboarding.surveyDraft')).toBeNull();

    await waitFor(() => {
      const destination =
        screen.queryByText('Tracker Flow Destination') ?? screen.getByText('Dashboard Destination');
      expect(destination).toBeInTheDocument();
    });
  });
});
