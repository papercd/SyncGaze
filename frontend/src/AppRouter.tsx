import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CalibrationPage from './pages/CalibrationPage';
import TrainingPage from './pages/TrainingPage';
import ResultsPage from './pages/ResultsPage';
import DetailedResultsPage from './pages/DetailedResultsPage';
import AboutPage from './pages/AboutPage.tsx';
import ReportPage from './pages/ReportPage';
import TrackerFlowPage from './pages/TrackerFlowPage';
import SurveyPage from './pages/onboarding/SurveyPage';
import ResearchConsentPage from './pages/onboarding/ResearchConsentPage';
import LeaderboardPage from './pages/LeaderboardPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage.tsx';
import SettingsPage from './pages/SettingsPage';
import SessionsHistoryPage from './pages/SessionsHistoryPage.tsx';
import AccountPage from './pages/AccountPage';
import { ReactElement, useEffect } from 'react';
import { useAuth } from './state/authContext';
import SessionRemoteHydrator from './components/SessionRemoteHydrator';
import { useTranslation } from './state/languageContext';
import Layout from './components/Layout';
import { useTrackingSession } from './state/trackingSessionContext';

//연구 감사인사용 페이지
import ThankYouPage from './pages/onboarding/ThankYouPage';

const RouteLoader = () => {
  const { t } = useTranslation();
  return (
    <div className="route-loader" role="status" aria-live="polite">
      <div className="route-loader__spinner" aria-hidden="true" />
      <span>{t('app.loading')}</span>
    </div>
  );
};

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
  const { surveyResponses, surveyHydrated, isAnonymousSession } = useTrackingSession();

  if (loading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (!isAnonymousSession && !surveyResponses && !surveyHydrated) {
    return <RouteLoader />;
  }

  if (
    !isAnonymousSession &&
    surveyHydrated &&
    !surveyResponses &&
    !location.pathname.startsWith('/onboarding/survey') &&
    !location.pathname.startsWith('/settings')
  ) {
    return <Navigate to="/onboarding/survey" replace state={{ from: location.pathname }} />;
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
        {/* Pages WITHOUT Layout (LandingPage and TrainingPage) */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/training"
          element={(
            <ProtectedRoute>
              <TrainingPage />
            </ProtectedRoute>
          )}
        />

        {/* Pages WITH Layout */}
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
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/calibration"
          element={(
            <ProtectedRoute>
              <Layout>
                <CalibrationPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/results"
          element={(
            <ProtectedRoute>
              <Layout>
                <ResultsPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route path="/sessions" element={
          <ProtectedRoute>
            <Layout>
              <SessionsHistoryPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route
          path="/results/detailed"
          element={(
            <ProtectedRoute>
              <Layout>
                <DetailedResultsPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/report"
          element={(
            <ProtectedRoute>
              <Layout>
                <ReportPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/onboarding/survey"
          element={(
            <ProtectedRoute>
              <Layout>
                <SurveyPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/onboarding/consent"
          element={(
            <ProtectedRoute>
              <Layout>
                <ResearchConsentPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/settings"
          element={(
            <ProtectedRoute>
              <Layout>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route 
          path="/privacy" 
          element={(
            <Layout>
              <PrivacyPolicyPage />
            </Layout>
          )} 
        />
        <Route 
          path="/terms" 
          element={(
            <Layout>
              <TermsOfServicePage />
            </Layout>
          )} 
        />
        <Route
          path="/thank-you"
          element={(
            <ProtectedRoute>
              <Layout>
                <ThankYouPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/account"
          element={(
            <ProtectedRoute>
              <Layout>
                <AccountPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/tracker-flow"
          element={(
            <ProtectedRoute>
              <Layout>
                <TrackerFlowPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/leaderboard"
          element={(
            <ProtectedRoute>
              <Layout>
                <LeaderboardPage />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/about"
          element={(
            
              <AboutPage />
            
          )}
        />
        

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
