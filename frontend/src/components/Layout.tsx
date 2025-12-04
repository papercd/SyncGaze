import { ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/authContext';
import { useTrackingSession } from '../state/trackingSessionContext';
import { useTranslation } from '../state/languageContext';
import SideNavigation from './SideNavigation';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { calibrationResult, resetState } = useTrackingSession();
  const { t } = useTranslation();

  const handleLogout = async () => {
    try {
      await signOut();
      resetState();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const calibrationMessage = useMemo(() => {
    if (!calibrationResult) {
      return t('dashboard.calibration.required');
    }
    if (calibrationResult.status === 'validated') {
      return t('dashboard.calibration.validated').replace(
        '{error}',
        `${calibrationResult.validationError ? Math.round(calibrationResult.validationError) : 0}`,
      );
    }
    if (calibrationResult.status === 'in-progress') {
      return t('dashboard.calibration.inProgress');
    }
    if (calibrationResult.status === 'skipped') {
      return t('dashboard.calibration.skipped');
    }
    return t('dashboard.calibration.pending');
  }, [calibrationResult, t]);

  return (
    <div className="app-layout">
      {/* Top bar spanning full width */}
      <header className="app-header">
        <button 
          onClick={() => navigate('/')}
          className="app-logo"
        >
          SyncGaze
        </button>
        <div className="header-actions">
          {user && (
            <>
              <div className="calibration-status">{calibrationMessage}</div>
              <span className="user-email">{user.displayName || user.email || t('dashboard.header.account')}</span>
              <button className="logout-button" onClick={handleLogout}>
                {t('dashboard.button.logout')}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Sidebar below the header */}
      <SideNavigation />
      
      {/* Main content */}
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;