import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResearchConsentPage from '../onboarding/ResearchConsentPage';

const navigateMock = vi.hoisted(() => vi.fn());
const mockUser = vi.hoisted(() => ({ current: { uid: 'user-123' } as { uid: string } | null }));
const saveSurveyAndConsent = vi.hoisted(() => vi.fn());
const setConsentAccepted = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../state/authContext', () => ({
  useAuth: () => ({
    user: mockUser.current,
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock('../../state/languageContext', () => ({
  useTranslation: () => ({
    t: (_: string, fallback?: string) => fallback ?? _,
    language: 'ko' as const,
    setLanguage: vi.fn(),
    toggleLanguage: vi.fn(),
  }),
}));

vi.mock('../../state/trackingSessionContext', () => ({
  useTrackingSession: () => ({
    consentAccepted: false,
    setConsentAccepted,
  }),
  saveSurveyAndConsent,
}));

const checkAllAgreements = async (user: ReturnType<typeof userEvent.setup>) => {
  for (const checkbox of screen.getAllByRole('checkbox')) {
    const input = checkbox as HTMLInputElement;
    if (!input.checked) {
      await user.click(input);
    }
  }
};

describe('ResearchConsentPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    saveSurveyAndConsent.mockReset();
    setConsentAccepted.mockReset();
    mockUser.current = { uid: 'user-123' };
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires every consent checkbox before proceeding', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/onboarding/consent']}>
        <ResearchConsentPage />
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole('button', { name: /연구에 동의하고/ })[0]);

    expect(screen.getByRole('alert')).toHaveTextContent(/모든 항목에 명시적으로 동의/);
    expect(saveSurveyAndConsent).not.toHaveBeenCalled();
  });

  it('surfaces a session error when no authenticated user exists', async () => {
    mockUser.current = null;
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/onboarding/consent']}>
        <ResearchConsentPage />
      </MemoryRouter>,
    );

    await checkAllAgreements(user);
    for (const button of screen.getAllByRole('button', { name: /연구에 동의하고/ })) {
      await user.click(button);
    }

    const alerts = screen.getAllByRole('alert');
    expect(alerts.some(alert => /로그인 정보를 확인할 수 없습니다/.test(alert.textContent ?? ''))).toBe(true);
    expect(saveSurveyAndConsent).not.toHaveBeenCalled();
  });

  it('saves consent, updates context and navigates to calibration', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/onboarding/consent']}>
        <ResearchConsentPage />
      </MemoryRouter>,
    );

    await checkAllAgreements(user);
    await waitFor(() => {
      expect(screen.getAllByRole('checkbox').every(cb => (cb as HTMLInputElement).checked)).toBe(true);
    });
    for (const button of screen.getAllByRole('button', { name: /연구에 동의하고/ })) {
      await user.click(button);
    }

    await waitFor(() => expect(saveSurveyAndConsent).toHaveBeenCalled(), { timeout: 2000 });

    const payload = saveSurveyAndConsent.mock.calls[0]?.[0];
    expect(payload?.uid).toBe('user-123');
    expect(typeof payload?.consentTimestamp).toBe('string');
    expect(setConsentAccepted).toHaveBeenCalledWith(true);
    expect(navigateMock).toHaveBeenCalledWith('/calibration');
    expect(window.sessionStorage.getItem('consentTimestamp')).toBeTruthy();
  });
});
