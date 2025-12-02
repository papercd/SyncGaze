import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CalibrationPage from './pages/CalibrationPage';
import TrainingPage from './pages/TrainingPage';
import ResultsPage from './pages/ResultsPage';
import DetailedResultsPage from './pages/DetailedResultsPage';
import ReportPage from './pages/ReportPage';

import TrackerFlowPage from './pages/TrackerFlowPage';
import SurveyPage from './pages/onboarding/SurveyPage';
import ResearchConsentPage from './pages/onboarding/ResearchConsentPage';
import LeaderboardPage from './pages/LeaderboardPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage.tsx';
import SettingsPage from './pages/SettingsPage';
import { ReactElement, useEffect } from 'react';
import { useAuth } from './state/authContext';
import SessionRemoteHydrator from './components/SessionRemoteHydrator';

//연구 감사인사용 페이지
import ThankYouPage from './pages/onboarding/ThankYouPage';

const RouteLoader = () => (
  <div className="route-loader" role="status" aria-live="polite">
    <div className="route-loader__spinner" aria-hidden="true" />
    <span>Loading...</span>
  </div>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
};

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return children;
};

const PublicOnlyRoute = ({ children }: { children: ReactElement }) => {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteLoader />;
  }

  if (user) {
    const redirectTarget = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard';
    return <Navigate to={redirectTarget} replace />;
  }

  return children;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
     <SessionRemoteHydrator />
     <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/auth"
          element={(
            <PublicOnlyRoute>
              <AuthPage />
            </PublicOnlyRoute>
          )}
        />
        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/calibration"
          element={(
            <ProtectedRoute>
              <CalibrationPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/training"
          element={(
            <ProtectedRoute>
              <TrainingPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/results"
          element={(
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/results/detailed"
          element={(
            <ProtectedRoute>
              <DetailedResultsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/report"
          element={(
            <ProtectedRoute>
              <ReportPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/onboarding/survey"
          element={(
            <ProtectedRoute>
              <SurveyPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/onboarding/consent"
          element={(
            <ProtectedRoute>
              <ResearchConsentPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/settings"
          element={(
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          )}
        />

        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />

        <Route
          path="/thank-you"
          element={(
            <ProtectedRoute>
              <ThankYouPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/tracker-flow"
          element={(
            <ProtectedRoute>
              <TrackerFlowPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/leaderboard"
          element={(
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;