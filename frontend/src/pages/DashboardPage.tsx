// src/pages/DashboardPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardPage.css';
import { useTrackingSession, TrainingSessionSummary } from '../state/trackingSessionContext';
import { useAuth } from '../state/authContext';
import { useTranslation } from '../state/languageContext';
import { getUserReports } from '../services/reportService';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { LeaderboardEntry } from '../utils/remoteSessions';
import { calculatePerformanceAnalytics } from '../utils/analytics';
import { Crosshair, Trophy, Settings, Hourglass, MousePointerClick, RotateCcw, Flag, Award, Timer, ScanEye } from 'lucide-react';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { recentSessions, setActiveSessionId, calibrationResult, resetState, isAnonymousSession } = useTrackingSession();
  const { user, signOut: signOutUser } = useAuth();
  const { t } = useTranslation();
  const [sessionReportMap, setSessionReportMap] = useState<Record<string, string>>({});
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const hasRealSession = recentSessions.some(session => !session.id.startsWith('mock-'));
  const isNewUser = isAnonymousSession || !hasRealSession;
  const [reactionRank, setReactionRank] = useState<number | null>(null);
  const [reactionRankSince, setReactionRankSince] = useState<string | null>(null);

  useEffect(() => {
    const loadReports = async () => {
      if (!user?.uid) {
        setSessionReportMap({});
        return;
      }

      setIsLoadingReports(true);
      try {
        const reports = await getUserReports(user.uid);
        const reportMap = reports.reduce<Record<string, string>>((acc, report) => {
          acc[report.sessionId] = report.id;
          return acc;
        }, {});
        setSessionReportMap(reportMap);
      } catch (error) {
        console.error('Failed to load reports', error);
      } finally {
        setIsLoadingReports(false);
      }
    };

    loadReports();
  }, [user?.uid]);

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

  const handleReportAction = (sessionId: string) => {
    setActiveSessionId(sessionId);
    navigate('/report', { state: { sessionId } });
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

  const latestSession = recentSessions[0];

  const bestReactionSession = useMemo(() => {
    if (!recentSessions.length) return null;
    return [...recentSessions].reduce((best, session) => {
      if (!best) return session;
      return session.avgReactionTime < best.avgReactionTime ? session : best;
    }, null as TrainingSessionSummary | null);
  }, [recentSessions]);

  const bestGazeReaction = useMemo(() => {
    if (!recentSessions.length) return null as { session: TrainingSessionSummary; gaze: number } | null;
    let best: { session: TrainingSessionSummary; gaze: number } | null = null;
    recentSessions.forEach(session => {
      const analytics = calculatePerformanceAnalytics(session.rawData);
      const gaze = analytics.avgGazeReactionTime;
      if (!best || (gaze > 0 && gaze < best.gaze)) {
        best = { session, gaze };
      }
    });
    return best;
  }, [recentSessions]);

  const bestGazeAimLatency = useMemo(() => {
    if (!recentSessions.length) return null as { session: TrainingSessionSummary; latency: number } | null;
    let best: { session: TrainingSessionSummary; latency: number } | null = null;
    recentSessions.forEach(session => {
      const analytics = calculatePerformanceAnalytics(session.rawData);
      const latency = analytics.gazeAimLatency;
      if (!best || (latency > 0 && latency < best.latency)) {
        best = { session, latency };
      }
    });
    return best;
  }, [recentSessions]);

  const reactionPercentile = useMemo(() => {
    if (!bestReactionSession) return null;
    const rt = bestReactionSession.avgReactionTime;
    // Same buckets as ResultsPage
    let value = 50;
    if (rt <= 200) value = 10;
    else if (rt <= 250) value = 25;
    else if (rt <= 300) value = 50;
    else if (rt <= 350) value = 70;
    else value = 90;
    const clamp = Math.min(99, Math.max(1, Math.round(value)));
    const label = `상위 ${clamp}%`;
    const color = clamp <= 25 ? '#66d9ff' : clamp <= 60 ? '#f1c40f' : '#ff6b6b';
    return { value: clamp, label, color };
  }, [bestReactionSession]);

  const gazePercentile = useMemo(() => {
    if (!bestGazeReaction) return null;
    const v = bestGazeReaction.gaze;
    let value = 45;
    if (v <= 200) value = 12;
    else if (v <= 250) value = 25;
    else if (v <= 350) value = 45;
    else if (v <= 450) value = 65;
    else value = 88;
    const clamp = Math.min(99, Math.max(1, Math.round(value)));
    const label = `상위 ${clamp}%`;
    const color = clamp <= 25 ? '#66d9ff' : clamp <= 60 ? '#f1c40f' : '#ff6b6b';
    return { value: clamp, label, color };
  }, [bestGazeReaction]);

  const gazeAimPercentile = useMemo(() => {
    if (!bestGazeAimLatency) return null;
    const v = bestGazeAimLatency.latency;
    let value = 60;
    if (v <= 250) value = 15;
    else if (v <= 400) value = 35;
    else if (v <= 600) value = 60;
    else value = 85;
    const clamp = Math.min(99, Math.max(1, Math.round(value)));
    const label = `상위 ${clamp}%`;
    const color = clamp <= 25 ? '#66d9ff' : clamp <= 60 ? '#f1c40f' : '#ff6b6b';
    return { value: clamp, label, color };
  }, [bestGazeAimLatency]);

  const reactionRankSinceText = useMemo(() => {
    if (!reactionRankSince) return '';
    const formatted = new Date(reactionRankSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return t('dashboard.reaction.since', '(since {date})').replace('{date}', formatted);
  }, [reactionRankSince, t]);

  useEffect(() => {
    const fetchReactionRank = async () => {
      if (!user?.uid) {
        setReactionRank(null);
        return;
      }
      try {
        const ref = collection(db, 'leaderboardEntries');
        const q = query(ref, orderBy('avgReactionTime', 'asc'), limit(200));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => doc.data() as LeaderboardEntry);
        const foundIndex = data.findIndex(entry => entry.uid === user.uid);
        if (foundIndex >= 0) {
          const entry = data[foundIndex];
          setReactionRank(foundIndex + 1);
          setReactionRankSince(entry.sessionDate ?? null);
        } else {
          setReactionRank(null);
          setReactionRankSince(null);
        }
      } catch (error) {
        console.error('Failed to fetch reaction leaderboard', error);
      }
    };

    fetchReactionRank();
  }, [user?.uid]);

  return (
    <div className="dashboard-page">
      {/* Header */}
    

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Welcome Section - ✅ NOW CONDITIONAL */}
        <section className="welcome-section">
          <div className="welcome-row">
            <div className="welcome-copy">
              <h2>{isFirstTime ? t('dashboard.welcome.first') : t('dashboard.welcome.return')}</h2>
              <p>{isFirstTime ? t('dashboard.welcome.first.desc') : t('dashboard.welcome.return.desc')}</p>
            </div>
            {reactionRank && reactionRank <= 3 && (
              <div className="stat-congrats welcome-congrats" data-rank={reactionRank}>
                <p className="stat-congrats__title">
                  {t('dashboard.reaction.congratsTitle', '축하합니다! 전체서버 {rank}등 랭커 입니다!').replace(
                    '{rank}',
                    `${reactionRank}`,
                  )}
                </p>
                <p className="stat-congrats__meta">
                  {t('dashboard.reaction.congratsMeta', '현재 #{rank}위를 유지중 {since}')
                    .replace('{rank}', `${reactionRank}`)
                    .replace('{since}', reactionRankSinceText)}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Reaction Time (Best) - standalone row */}
        <section className="stats-grid stats-grid--compact">
          <div className="stat-card reaction-stat">
            <div className ="stat-icon">
              <Hourglass size={32} strokeWidth={2.5}/>   
            </div>
            <div className="stat-inner">
              <div className="stat-info">
                <div className="stat-top-row">
                  <h3>{bestReactionSession ? `${bestReactionSession.avgReactionTime.toFixed(0)}ms` : '--'}</h3>
                  {reactionPercentile && (
                    <span className="stat-pill" style={{ color: reactionPercentile.color, borderColor: reactionPercentile.color }}>
                      {reactionPercentile.label}
                    </span>
                  )}
                  {reactionRank && reactionRank <= 3 && (
                    <span className="stat-medal" data-rank={reactionRank}>
                      <Award size={18} color={reactionRank === 1 ? '#d4af37' : reactionRank === 2 ? '#c0c0c0' : '#cd7f32'} />
                      <span className="medal-rank">#{reactionRank}</span>
                    </span>
                  )}
              </div>
                <p>{t('dashboard.reaction.label', 'Reaction Time (best)')}</p>
            </div>

            </div>
          </div>

          <div className="stat-card reaction-stat">
            <div className ="stat-icon">
              <ScanEye size={32} strokeWidth={2.5}/>   
            </div>
            <div className="stat-info">
              <div className="stat-top-row">
                <h3>{bestGazeReaction ? `${bestGazeReaction.gaze.toFixed(0)}ms` : '--'}</h3>
                {gazePercentile && (
                  <span className="stat-pill" style={{ color: gazePercentile.color, borderColor: gazePercentile.color }}>
                    {gazePercentile.label}
                  </span>
                )}
              </div>
              <p>{t('dashboard.reaction.gazeLabel', 'Avg Gaze Reaction (best)')}</p>
            </div>
          </div>

          <div className="stat-card reaction-stat">
            <div className ="stat-icon">
              <MousePointerClick size={32} strokeWidth={2.5}/>   
            </div>
            <div className="stat-info">
              <div className="stat-top-row">
                <h3>{bestGazeAimLatency ? `${bestGazeAimLatency.latency.toFixed(0)}ms` : '--'}</h3>
                {gazeAimPercentile && (
                  <span className="stat-pill" style={{ color: gazeAimPercentile.color, borderColor: gazeAimPercentile.color }}>
                    {gazeAimPercentile.label}
                  </span>
                )}
              </div>
              <p>{t('dashboard.reaction.gazeAimLabel', 'Gaze-Aim Latency (best)')}</p>
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className ="stat-icon">
              <RotateCcw size={32} strokeWidth={2.5}/>   
            </div>
            

            <div className="stat-info">
              <h3>{stats.totalSessions}</h3>
              <p>{t('dashboard.stats.total')}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className ="stat-icon">
              <MousePointerClick size={32} strokeWidth={2.5}/>   
            </div>
            <div className="stat-info">
              <h3>{stats.avgAccuracy}%</h3>
              <p>{t('dashboard.stats.avgAccuracy')}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className ="stat-icon">
              <Timer size={32} strokeWidth={2.5}/>   
            </div>
            <div className="stat-info">
              <h3>{stats.avgReactionTime.toFixed(2)}ms</h3>
              <p>{t('dashboard.stats.avgReaction')}</p>
            </div>
          </div>

          <div className="stat-card">
              <div className ="stat-icon">
                <Flag size={32} strokeWidth={2.5}/>   
              </div>
            <div className="stat-info">
              <h3>{stats.bestAccuracy}%</h3>
              <p>{t('dashboard.stats.bestAccuracy')}</p>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="action-section">
          <button className="start-training-button" onClick={handleStartTraining}>
              <div className ="button-icon">
                <Crosshair size={24} strokeWidth={2.5}/>   
              </div>
            {t('dashboard.action.train')}
          </button>
       
          <button className="start-training-button" onClick={() => navigate('/leaderboard')}>
            <div className ="button-icon">
              <Trophy size={24} strokeWidth={2.5}/>   
            </div>
            {t('dashboard.action.leaderboard')}
          </button>
          <button className="start-training-button" onClick={() => navigate('/settings')}>
              <div className ="button-icon">
                <Settings size={24} strokeWidth={2.5}/>   
              </div>
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
                        <div className="table-actions-group">
                          <button className="view-button" onClick={() => handleViewResults(session.id)}>
                            {t('dashboard.table.view')}
                          </button>
                          <button
                            className="report-button"
                            onClick={() => handleReportAction(session.id)}
                            disabled={isLoadingReports}
                          >
                            {sessionReportMap[session.id]
                              ? t('dashboard.table.report.viewExisting')
                              : t('dashboard.table.report.create')}
                          </button>
                        </div>
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
