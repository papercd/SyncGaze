import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppRouter from '../AppRouter';

const authState = vi.hoisted(() => ({ current: { user: null, loading: false } }));
const trackingState = vi.hoisted(() => ({
  current: { surveyResponses: null, surveyHydrated: false, isAnonymousSession: false },
}));

vi.mock('../state/authContext', () => ({
  useAuth: () => authState.current,
}));

vi.mock('../state/trackingSessionContext', () => ({
  useTrackingSession: () => trackingState.current,
}));

vi.mock('../state/languageContext', () => ({
  useTranslation: () => ({
    t: (_: string, fallback?: string) => fallback ?? _,
    language: 'ko' as const,
    setLanguage: vi.fn(),
    toggleLanguage: vi.fn(),
  }),
}));

vi.mock('../components/SessionRemoteHydrator', () => ({
  default: () => null,
}));

vi.mock('../components/Layout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>Layout {children}</div>,
}));

vi.mock('../pages/LandingPage', () => ({ default: () => <div>Landing Page</div> }));
vi.mock('../pages/AuthPage', () => ({ default: () => <div>Auth Page</div> }));
vi.mock('../pages/DashboardPage', () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock('../pages/CalibrationPage', () => ({ default: () => <div>Calibration Page</div> }));
vi.mock('../pages/TrainingPage', () => ({ default: () => <div>Training Page</div> }));
vi.mock('../pages/ResultsPage', () => ({ default: () => <div>Results Page</div> }));
vi.mock('../pages/DetailedResultsPage', () => ({ default: () => <div>Detailed Results Page</div> }));
vi.mock('../pages/AboutPage.tsx', () => ({ default: () => <div>About Page</div> }));
vi.mock('../pages/ReportPage', () => ({ default: () => <div>Report Page</div> }));
vi.mock('../pages/TrackerFlowPage', () => ({ default: () => <div>Tracker Flow Page</div> }));
vi.mock('../pages/onboarding/SurveyPage', () => ({ default: () => <div>Survey Page</div> }));
vi.mock('../pages/onboarding/ResearchConsentPage', () => ({ default: () => <div>Consent Page</div> }));
vi.mock('../pages/LeaderboardPage', () => ({ default: () => <div>Leaderboard Page</div> }));
vi.mock('../pages/PrivacyPolicyPage', () => ({ default: () => <div>Privacy Page</div> }));
vi.mock('../pages/TermsOfServicePage.tsx', () => ({ default: () => <div>Terms Page</div> }));
vi.mock('../pages/SettingsPage', () => ({ default: () => <div>Settings Page</div> }));
vi.mock('../pages/SessionsHistoryPage.tsx', () => ({ default: () => <div>Sessions History Page</div> }));
vi.mock('../pages/AccountPage', () => ({ default: () => <div>Account Page</div> }));
vi.mock('../pages/HowToPage', () => ({ default: () => <div>HowTo Page</div> }));
vi.mock('../pages/onboarding/ThankYouPage', () => ({ default: () => <div>Thank You Page</div> }));

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<AppRouter />);
};

describe('AppRouter protected routing', () => {
  beforeEach(() => {
    authState.current = { user: null, loading: false };
    trackingState.current = { surveyResponses: null, surveyHydrated: false, isAnonymousSession: false };
  });

  it('redirects unauthenticated users to the auth page', () => {
    renderAt('/dashboard');

    expect(screen.getByText('Auth Page')).toBeInTheDocument();
  });

  it('shows the route loader while survey hydration is pending', () => {
    authState.current = { user: { uid: 'u1' }, loading: false };
    trackingState.current = { surveyResponses: null, surveyHydrated: false, isAnonymousSession: false };

    renderAt('/dashboard');

    expect(screen.getByText('app.loading')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
  });

  it('redirects to survey when onboarding is incomplete', async () => {
    authState.current = { user: { uid: 'u1' }, loading: false };
    trackingState.current = { surveyResponses: null, surveyHydrated: true, isAnonymousSession: false };

    renderAt('/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Survey Page')).toBeInTheDocument();
    });
  });

  it('renders the requested page once authenticated and hydrated', () => {
    authState.current = { user: { uid: 'u1' }, loading: false };
    trackingState.current = {
      surveyResponses: { ageCheck: true, webcamCheck: true },
      surveyHydrated: true,
      isAnonymousSession: false,
    };

    renderAt('/dashboard');

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});
