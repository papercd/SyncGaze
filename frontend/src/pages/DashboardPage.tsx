// src/pages/DashboardPage.tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardPage.css';
import { useTrackingSession, TrainingSessionSummary } from '../state/trackingSessionContext';
import { useAuth } from '../state/authContext';
import { useTranslation } from '../state/languageContext';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { recentSessions, setActiveSessionId, calibrationResult, resetState, isAnonymousSession } = useTrackingSession();
  const { user, signOut: signOutUser } = useAuth();
  const { t } = useTranslation();
  const hasRealSession = recentSessions.some(session => !session.id.startsWith('mock-'));
  const isNewUser = isAnonymousSession || !hasRealSession;

  const handleLogout = async () => {
    try {
      await signOutUser();
      resetState();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleStartTraining = () => {
    navigate('/calibration');
  };

  const handleViewResults = (sessionId: string) => {
    setActiveSessionId(sessionId);
    navigate('/results', { state: { sessionId } });
  };

  const stats = useMemo(() => {
    if (recentSessions.length === 0) {
      return {
        totalSessions: 0,
        avgAccuracy: 0,
        bestAccuracy: 0,
        avgReactionTime: 0,
      };
    }

    const totalSessions = recentSessions.length;
    const avgAccuracy = recentSessions.reduce((sum, session) => sum + session.accuracy, 0) / totalSessions;
    const bestAccuracy = Math.max(...recentSessions.map(session => session.accuracy));
    const avgReactionTime = recentSessions.reduce((sum, session) => sum + session.avgReactionTime, 0) / totalSessions;

    return {
      totalSessions,
      avgAccuracy: Number(avgAccuracy.toFixed(1)),
      bestAccuracy: Number(bestAccuracy.toFixed(1)),
      avgReactionTime: Number(avgReactionTime.toFixed(2)),
    };
  }, [recentSessions]);

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
  }, [calibrationResult]);

  // ✅ NEW: Conditional welcome message based on session history
  const isFirstTime = recentSessions.length === 0;

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <button
            type="button"
            className="dashboard-logo"
            onClick={() => navigate('/')}
          >
            SyncGaze
          </button>
          <div className="header-actions">
            <div className="calibration-status">{calibrationMessage}</div>
            <span className="user-email">{user?.displayName || user?.email || t('dashboard.header.account')}</span>
            <button className="logout-button" onClick={handleLogout}>
              {t('dashboard.button.logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Welcome Section - ✅ NOW CONDITIONAL */}
        <section className="welcome-section">
          <h2>{isFirstTime ? t('dashboard.welcome.first') : t('dashboard.welcome.return')}</h2>
          <p>{isFirstTime ? t('dashboard.welcome.first.desc') : t('dashboard.welcome.return.desc')}</p>
        </section>

        {/* Quick Stats */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <h3>{stats.totalSessions}</h3>
              <p>{t('dashboard.stats.total')}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-info">
              <h3>{stats.avgAccuracy}%</h3>
              <p>{t('dashboard.stats.avgAccuracy')}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-info">
              <h3>{stats.avgReactionTime}ms</h3>
              <p>{t('dashboard.stats.avgReaction')}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-info">
              <h3>{stats.bestAccuracy}%</h3>
              <p>{t('dashboard.stats.bestAccuracy')}</p>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="action-section">
          <button className="start-training-button" onClick={handleStartTraining}>
            <span className="button-icon">🎮</span>
            {t('dashboard.action.train')}
          </button>
       
          <button className="start-training-button" onClick={() => navigate('/leaderboard')}>
            <span className="button-icon">🏆</span>
            {t('dashboard.action.leaderboard')}
          </button>
          <button className="start-training-button" onClick={() => navigate('/settings')}>
            <span className="button-icon">⚙️</span>
            Settings
          </button>
        </section>

        {/* Recent Sessions */}
        <section className="recent-sessions">
          <h2>{t('dashboard.recent.title')}</h2>

          {recentSessions.length === 0 ? (
            <div className="no-sessions">
              <p>{t('dashboard.recent.empty')}</p>
            </div>
          ) : (
            <div className="sessions-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('dashboard.table.date')}</th>
                    <th scope="col">{t('dashboard.table.duration')}</th>
                    <th scope="col">{t('dashboard.table.accuracy')}</th>
                    <th scope="col">{t('dashboard.table.targets')}</th>
                    <th scope="col">{t('dashboard.table.reaction')}</th>
                    <th scope="col">{t('dashboard.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map((session: TrainingSessionSummary) => (
                    <tr key={session.id}>
                      <td>
                        {new Date(session.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td>{session.duration}s</td>
                      <td>
                        <span className="accuracy-badge">{session.accuracy.toFixed(1)}%</span>
                      </td>
                      <td>
                        {session.targetsHit}/{session.totalTargets}
                      </td>
                      <td>{session.avgReactionTime.toFixed(2)}ms</td>
                      <td className="table-actions">
                        <button className="view-button" onClick={() => handleViewResults(session.id)}>
                          {t('dashboard.table.view')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;