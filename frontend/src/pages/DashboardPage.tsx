// src/pages/DashboardPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardPage.css';
import { useTrackingSession, TrainingSessionSummary } from '../state/trackingSessionContext';
import { useAuth } from '../state/authContext';
import { useTranslation } from '../state/languageContext';
import { getUserReports } from '../services/reportService';
import { predictScore } from '../services/predictionService';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { LeaderboardEntry } from '../utils/remoteSessions';
import { calculatePerformanceAnalytics } from '../utils/analytics';
import {
  Crosshair,
  Trophy,
  Settings,
  Hourglass,
  MousePointerClick,
  RotateCcw,
  Flag,
  Award,
  Timer,
  ScanEye,
  BookOpen,
} from 'lucide-react';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { recentSessions, setActiveSessionId, calibrationResult, resetState, isAnonymousSession } = useTrackingSession();
  const { user, signOut: signOutUser } = useAuth();
  const { t } = useTranslation();
  const [sessionReportMap, setSessionReportMap] = useState<Record<string, string>>({});
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const hasRealSession = recentSessions.some(session => !session.id.startsWith('mock-'));
  const isNewUser = isAnonymousSession || !hasRealSession;
  const [sgRank, setSgRank] = useState<number | null>(null);
  const [sgRankSince, setSgRankSince] = useState<string | null>(null);
  const [predictedScores, setPredictedScores] = useState<Record<string, number | null>>({});
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const SG_RANK_FETCH_LIMIT = 200;

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

  const percentileColor = (percentile: number) => (percentile <= 25 ? '#66d9ff' : percentile <= 60 ? '#f1c40f' : '#ff6b6b');

  const mapToPercentile = (value: number, buckets: { max: number; percentile: number }[], fallback: number) => {
    const found = buckets.find(bucket => value <= bucket.max);
    const pct = found ? found.percentile : fallback;
    const clamp = Math.min(99, Math.max(1, Math.round(pct)));
    return { value: clamp, label: `상위 ${clamp}%`, color: percentileColor(clamp) };
  };

  // 하드코딩 버킷 (리더보드 Top 200 분포 기준으로 수동 추정)
  const reactionPercentile = useMemo(() => {
    if (!bestReactionSession) return null;
    const buckets = [
      { max: 300, percentile: 8 },
      { max: 400, percentile: 14 },
      { max: 500, percentile: 18 },
      { max: 600, percentile: 24 },
      { max: 700, percentile: 28 },
      { max: 800, percentile: 32 },
      { max: 900, percentile: 40 },
      { max: 1100, percentile: 55 },
      { max: 1400, percentile: 70 },
    ];
    return mapToPercentile(bestReactionSession.avgReactionTime, buckets, 90);
  }, [bestReactionSession]);

  const gazePercentile = useMemo(() => {
    if (!bestGazeReaction) return null;
    const buckets = [
      { max: 180, percentile: 10 },
      { max: 220, percentile: 22 },
      { max: 270, percentile: 40 },
      { max: 330, percentile: 58 },
      { max: 400, percentile: 72 },
    ];
    return mapToPercentile(bestGazeReaction.gaze, buckets, 90);
  }, [bestGazeReaction]);

  const gazeAimPercentile = useMemo(() => {
    if (!bestGazeAimLatency) return null;
    const buckets = [
      { max: 220, percentile: 10 },
      { max: 300, percentile: 20 },
      { max: 380, percentile: 38 },
      { max: 480, percentile: 55 },
      { max: 600, percentile: 72 },
      { max: 720, percentile: 88 },
    ];
    return mapToPercentile(bestGazeAimLatency.latency, buckets, 96);
  }, [bestGazeAimLatency]);

  const sgRankSinceText = useMemo(() => {
    if (!sgRankSince) return '';
    const formatted = new Date(sgRankSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return t('dashboard.reaction.since', '(since {date})').replace('{date}', formatted);
  }, [sgRankSince, t]);

  useEffect(() => {
    const fetchSgRank = async () => {
      if (!user?.uid) {
        setSgRank(null);
        setSgRankSince(null);
        return;
      }
      try {
        const ref = collection(db, 'leaderboardEntries');
        const q = query(ref, orderBy('score', 'desc'), limit(SG_RANK_FETCH_LIMIT));
        const snapshot = await getDocs(q);
        const entries = snapshot.docs.map(doc => doc.data() as LeaderboardEntry);

        const withPredictedScores = await Promise.all(
          entries.map(async entry => {
            const stub: TrainingSessionSummary = {
              id: entry.sessionId,
              date: entry.sessionDate,
              duration: entry.duration ?? 0,
              score: entry.score,
              predictedScore: null,
              accuracy: entry.accuracy,
              targetsHit: entry.targetsHit,
              totalTargets: entry.totalTargets,
              avgReactionTime: entry.avgReactionTime,
              gazeAccuracy: entry.gazeAccuracy,
              mouseAccuracy: entry.mouseAccuracy,
              controlSensitivity: undefined,
              screenSize: null,
              csvData: '',
              rawData: [],
            };

            try {
              const res = await predictScore(stub);
              return { entry, predictedScore: res.predictedScore ?? entry.score };
            } catch (err) {
              console.warn('Failed to predict SG score for leaderboard entry', entry.sessionId, err);
              return { entry, predictedScore: entry.score };
            }
          }),
        );

        const sortedBySgScore = withPredictedScores
          .map(item => ({ ...item.entry, sgScore: item.predictedScore }))
          .sort((a, b) => (b.sgScore ?? -Infinity) - (a.sgScore ?? -Infinity));

        const foundIndex = sortedBySgScore.findIndex(entry => entry.uid === user.uid);
        const isInTop50 = foundIndex >= 0 && foundIndex < 50;

        setSgRank(isInTop50 ? foundIndex + 1 : null);
        setSgRankSince(isInTop50 ? sortedBySgScore[foundIndex].sessionDate ?? null : null);
      } catch (error) {
        console.error('Failed to fetch SG leaderboard', error);
        setSgRank(null);
        setSgRankSince(null);
      }
    };

    fetchSgRank();
  }, [user?.uid]);

  useEffect(() => {
    const fetchPredictions = async () => {
      if (!recentSessions.length) {
        setPredictedScores({});
        return;
      }
      setIsLoadingPredictions(true);
      try {
        const results = await Promise.all(
          recentSessions.map(async session => {
            try {
              const res = await predictScore(session);
              return { id: session.id, score: res.predictedScore ?? null };
            } catch (error) {
              console.warn('Failed to predict score for session', session.id, error);
              return { id: session.id, score: null };
            }
          }),
        );
        const map = results.reduce<Record<string, number | null>>((acc, curr) => {
          acc[curr.id] = curr.score;
          return acc;
        }, {});
        setPredictedScores(map);
      } finally {
        setIsLoadingPredictions(false);
      }
    };

    fetchPredictions();
  }, [recentSessions]);

  const bestPredictedSession = useMemo(() => {
    if (!recentSessions.length) return null as { session: TrainingSessionSummary; score: number } | null;
    let best: { session: TrainingSessionSummary; score: number } | null = null;
    recentSessions.forEach(session => {
      const score = predictedScores[session.id];
      if (typeof score === 'number') {
        if (!best || score > best.score) {
          best = { session, score };
        }
      }
    });
    return best;
  }, [recentSessions, predictedScores]);

  const bestSgScore = useMemo(() => {
    if (!recentSessions.length) return null;
    return recentSessions.reduce((max, session) => {
      const predicted = predictedScores[session.id];
      const score = typeof predicted === 'number' ? predicted : Number(session.score) || 0;
      return Math.max(max, score);
    }, 0);
  }, [recentSessions, predictedScores]);

  const hasTopSgRank = typeof sgRank === 'number' && sgRank <= 50;
  const rankerBoxTitle = hasTopSgRank
    ? t('dashboard.reaction.congratsTitle', '축하합니다! SG Rank 서버 {rank}등!').replace('{rank}', `${sgRank}`)
    : bestSgScore != null
      ? t('dashboard.reaction.bestScoreTitle', '내 최고 SG Score {score}점').replace(
          '{score}',
          bestSgScore.toFixed(1),
        )
      : t('dashboard.reaction.rankerPendingTitle', 'SG 랭킹 대기중');
  const rankerBoxMeta = hasTopSgRank
    ? t('dashboard.reaction.congratsMetaSg', '현재 SG Rank #{rank}위를 유지중 {since}')
        .replace('{rank}', `${sgRank}`)
        .replace('{since}', sgRankSinceText)
    : bestSgScore != null
      ? t('dashboard.reaction.bestScoreMeta', 'Top 50 진입까지 조금만 더!').replace('{score}', bestSgScore.toFixed(1))
      : t('dashboard.reaction.rankerPendingMeta', '첫 세션을 완료하면 순위가 집계됩니다.');

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
            <div
              className={`stat-congrats welcome-congrats ranker-box ${!hasTopSgRank ? 'ranker-box--pending' : ''}`}
              data-rank={sgRank ?? undefined}
            >
              <p className="stat-congrats__title">{rankerBoxTitle}</p>
              <p className="stat-congrats__meta">{rankerBoxMeta}</p>
            </div>
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
                  {sgRank && sgRank <= 3 && (
                    <span className="stat-medal" data-rank={sgRank}>
                      <Award size={18} color={sgRank === 1 ? '#d4af37' : sgRank === 2 ? '#c0c0c0' : '#cd7f32'} />
                      <span className="medal-rank">#{sgRank}</span>
                    </span>
                  )}
              </div>
                <p>{t('dashboard.reaction.label', 'Reaction Time (best)')}</p>
            </div>

            </div>
          </div>

          <div className="stat-card reaction-stat">
            <div className="stat-icon">
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
          <button className="start-training-button" onClick={() => navigate('/how-to')}>
              <div className ="button-icon">
                <BookOpen size={24} strokeWidth={2.5}/>   
              </div>
            {t('dashboard.action.howTo', 'How-to 가이드')}
          </button>
          <button className="start-training-button" onClick={() => navigate('/settings')}>
              <div className ="button-icon">
                <Settings size={24} strokeWidth={2.5}/>   
              </div>
            {t('dashboard.action.settings', '세팅')}
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
                    <th scope="col">SG Rank</th>
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
                      <td className="table-sg-rank">
                        {typeof predictedScores[session.id] === 'number'
                          ? Math.round(predictedScores[session.id] ?? 0)
                          : isLoadingPredictions
                            ? '...'
                            : '--'}
                      </td>
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
