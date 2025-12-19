// src/pages/SessionsHistoryPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrackingSession } from '../state/trackingSessionContext';
import { useAuth } from '../state/authContext';
import { useTranslation } from '../state/languageContext';
import { getUserReports } from '../services/reportService';
import { calculatePerformanceAnalytics } from '../utils/analytics';
import { Line } from 'react-chartjs-2';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import { deleteSessionForUser } from '../utils/remoteSessions';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import './SessionsHistoryPage.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type SortField = 'date' | 'score' | 'accuracy' | 'avgReactionTime';
type SortOrder = 'asc' | 'desc';
type TrendPeriod = '7days' | '30days';

const SessionsHistoryPage = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { recentSessions, setActiveSessionId, removeSession } = useTrackingSession();
  const { user } = useAuth();

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('7days');
  const [sessionReportMap, setSessionReportMap] = useState<Record<string, string>>({});
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load reports on mount
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

  // Filter sessions to last 20
  const displaySessions = useMemo(() => {
    const sessions = [...recentSessions]
      .filter(session => !session.id.startsWith('mock-'))
      .slice(0, 20);

    // Sort based on selected field
    return sessions.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'date':
          comparison = new Date(b.date).getTime() - new Date(a.date).getTime();
          break;
        case 'score':
          comparison = b.score - a.score;
          break;
        case 'accuracy':
          comparison = b.accuracy - a.accuracy;
          break;
        case 'avgReactionTime':
          comparison = a.avgReactionTime - b.avgReactionTime; // Lower is better
          break;
      }

      return sortOrder === 'asc' ? -comparison : comparison;
    });
  }, [recentSessions, sortField, sortOrder]);

  // Calculate trend data based on selected period
  const trendData = useMemo(() => {
    const now = new Date();
    const daysAgo = trendPeriod === '7days' ? 7 : 30;
    const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const filteredSessions = recentSessions
      .filter(session => !session.id.startsWith('mock-'))
      .filter(session => new Date(session.date) >= cutoffDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const labels = filteredSessions.map(session => {
      const date = new Date(session.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    return {
      labels,
      datasets: [
        {
          label: t('sessions.trend.accuracy', 'Accuracy (%)'),
          data: filteredSessions.map(s => s.accuracy),
          borderColor: 'rgba(102, 126, 234, 1)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: t('sessions.trend.reactionTime', 'Avg Reaction Time (ms)'),
          data: filteredSessions.map(s => s.avgReactionTime),
          borderColor: 'rgba(118, 75, 162, 1)',
          backgroundColor: 'rgba(118, 75, 162, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y1',
        },
        {
          label: t('sessions.trend.sgScore', 'SG Score'),
          data: filteredSessions.map(s => s.score),
          borderColor: 'rgba(78, 205, 196, 1)',
          backgroundColor: 'rgba(78, 205, 196, 0.1)',
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [recentSessions, trendPeriod, t]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#d9d9e7',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 12, 41, 0.95)',
        titleColor: '#fff',
        bodyColor: '#d9d9e7',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#b8b8d1',
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#b8b8d1',
        },
        title: {
          display: true,
          text: t('sessions.trend.yAxis.accuracy', 'Accuracy (%)'),
          color: '#d9d9e7',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: '#b8b8d1',
        },
        title: {
          display: true,
          text: t('sessions.trend.yAxis.reaction', 'Reaction Time (ms)'),
          color: '#d9d9e7',
        },
      },
    },
  };

  // Overall stats
  const stats = useMemo(() => {
    if (displaySessions.length === 0) {
      return {
        totalSessions: 0,
        avgAccuracy: 0,
        avgReactionTime: 0,
        bestScore: 0,
      };
    }

    const total = displaySessions.length;
    const avgAcc = displaySessions.reduce((sum, s) => sum + s.accuracy, 0) / total;
    const avgRT = displaySessions.reduce((sum, s) => sum + s.avgReactionTime, 0) / total;
    const bestScore = Math.max(...displaySessions.map(s => s.score));

    return {
      totalSessions: total,
      avgAccuracy: Number(avgAcc.toFixed(1)),
      avgReactionTime: Number(avgRT.toFixed(0)),
      bestScore,
    };
  }, [displaySessions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleViewSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    navigate('/results', { state: { sessionId } });
  };

  const handleReportAction = (sessionId: string) => {
    setActiveSessionId(sessionId);
    navigate('/report', { state: { sessionId } });
  };

  const handleDeleteSession = async (sessionId: string) => {
    const confirmed = window.confirm(
      t(
        'sessions.delete.confirm',
        'Delete this session from your history? This action cannot be undone.',
      ),
    );
    if (!confirmed) return;

    setDeletingId(sessionId);
    setDeleteStatus(null);

    try {
      if (user?.uid) {
        await deleteSessionForUser(user.uid, sessionId);
      }
      removeSession(sessionId);
      setDeleteStatus({
        type: 'success',
        message: t('sessions.delete.success', 'Session removed from your history.'),
      });
    } catch (error) {
      console.error('Failed to delete session', error);
      setDeleteStatus({
        type: 'error',
        message: t('sessions.delete.error', 'Failed to delete the session. Please try again.'),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    const locale = language === 'ko' ? 'ko-KR' : 'en-US';
    return dateObj.toLocaleString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPerformanceClass = (accuracy: number) => {
    if (accuracy >= 80) return 'excellent';
    if (accuracy >= 60) return 'good';
    if (accuracy >= 40) return 'average';
    return 'poor';
  };

  const coachingTips = useMemo(() => {
    const validSessions = recentSessions.filter(session => !session.id.startsWith('mock-'));
    if (!validSessions.length) return [];
    const sorted = [...validSessions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const latest = sorted.slice(0, 3);
    const analytics = latest
      .map(session => calculatePerformanceAnalytics(session.rawData))
      .filter(Boolean);

    const averageMetric = (getter: (a: ReturnType<typeof calculatePerformanceAnalytics>) => number) => {
      const values = analytics
        .map(getter)
        .filter(v => Number.isFinite(v) && v > 0);
      if (!values.length) return null;
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    };

    const avgReaction = averageMetric(a => a.avgReactionTime);
    const avgGazeReaction = averageMetric(a => a.avgGazeReactionTime);
    const avgGazeAim = averageMetric(a => a.gazeAimLatency);
    const avgAccuracy = averageMetric(a =>
      a.totalTargets > 0 ? (a.targetsHit / a.totalTargets) * 100 : 0,
    );

    const weaknessScore = (value: number, target: number, lowerIsBetter: boolean) => {
      if (!Number.isFinite(value)) return 0;
      if (lowerIsBetter) {
        return Math.max(0, (value - target) / Math.max(target, 1));
      }
      return Math.max(0, (target - value) / Math.max(target, 1));
    };

    const candidates: {
      key: string;
      label: string;
      detail: string;
      action: string;
      score: number;
    }[] = [];

    if (avgReaction !== null) {
      const diff = avgReaction - 420;
      candidates.push({
        key: 'reaction',
        label: t('sessions.coaching.metric.reaction', '반응 속도'),
        detail: `+${Math.max(0, diff).toFixed(0)}ms · ${t('sessions.coaching.detail.recentAvg', '최근 3세션 평균 {value}ms').replace('{value}', avgReaction.toFixed(0))}`,
        action: t('sessions.coaching.action.reaction', '짧은 플릭/스냅 드릴로 첫 발 시간을 줄여보세요.'),
        score: weaknessScore(avgReaction, 420, true),
      });
    }

    if (avgGazeReaction !== null) {
      const diff = avgGazeReaction - 300;
      candidates.push({
        key: 'gaze',
        label: t('sessions.coaching.metric.gaze', '시선 반응'),
        detail: `+${Math.max(0, diff).toFixed(0)}ms · ${t('sessions.coaching.detail.gazeAvg', '시선 포착 평균 {value}ms').replace('{value}', avgGazeReaction.toFixed(0))}`,
        action: t('sessions.coaching.action.gaze', '마커를 눈으로 먼저 찍고 마우스를 따라가게 연습하세요.'),
        score: weaknessScore(avgGazeReaction, 300, true),
      });
    }

    if (avgGazeAim !== null) {
      const diff = avgGazeAim - 450;
      candidates.push({
        key: 'gazeAim',
        label: t('sessions.coaching.metric.gazeAim', '눈-손 딜레이'),
        detail: `+${Math.max(0, diff).toFixed(0)}ms · ${t('sessions.coaching.detail.gazeAimAvg', '딜레이 평균 {value}ms').replace('{value}', avgGazeAim.toFixed(0))}`,
        action: t('sessions.coaching.action.gazeAim', '캘리브레이션 후 천천히-빠르게 번갈아 조준해 동기화 감각을 맞춰보세요.'),
        score: weaknessScore(avgGazeAim, 450, true),
      });
    }

    if (avgAccuracy !== null) {
      const diff = 85 - avgAccuracy;
      candidates.push({
        key: 'accuracy',
        label: t('sessions.coaching.metric.accuracy', '명중률'),
        detail: `-${Math.max(0, diff).toFixed(1)}%p · ${t('sessions.coaching.detail.accuracyAvg', '평균 {value}%').replace('{value}', avgAccuracy.toFixed(1))}`,
        action: t('sessions.coaching.action.accuracy', '트래킹 중에도 클릭 타이밍을 늦춰 정확도를 챙기세요.'),
        score: weaknessScore(avgAccuracy, 85, false),
      });
    }

    const weaknesses = candidates
      .filter(c => c.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    if (weaknesses.length === 0) {
      return [
        {
          key: 'stable',
          label: t('sessions.coaching.metric.stable', '지표 안정'),
          detail: t('sessions.coaching.detail.stable', '최근 3세션 주요 지표가 목표 범위 안입니다.'),
          action: t('sessions.coaching.action.stable', '지금 리듬을 유지하면서 세션 간격만 일정하게 가져가세요.'),
        },
      ];
    }

    return weaknesses;
  }, [recentSessions, t]);

  return (
    <div className="sessions-history-page">
      {/* Header */}
      <header className="sessions-header">
        <div className="header-content">
          <h1>{t('sessions.title', 'Training Sessions')}</h1>
          
        </div>
      </header>

      {coachingTips.length > 0 && (
        <section className="coaching-section">
          <div className="coaching-header">
            <div className="coaching-title">
              <Lightbulb size={22} strokeWidth={2.5} />
              <span>{t('sessions.coaching.title', '개인화 코칭')}</span>
            </div>
            <p className="coaching-subtitle">
              {t('sessions.coaching.subtitle', '최근 3세션 기준 약한 지표를 빠르게 보완하세요.')}
            </p>
          </div>
          <div className="coaching-grid">
            {coachingTips.map(tip => (
              <div key={tip.key} className="coaching-card">
                <div className="coaching-card__label">
                  <AlertTriangle size={16} />
                  <span>{tip.label}</span>
                </div>
                <div className="coaching-card__detail">{tip.detail}</div>
                <div className="coaching-card__action">{tip.action}</div>
              </div>
            ))}
          </div>
        </section>
      )}

 

      {/* Trend Chart */}
      <section className="trend-section">
        <div className="section-header">
          <h2>{t('sessions.trend.title', 'Performance Trends')}</h2>
          <div className="trend-controls">
            <button
              className={`trend-button ${trendPeriod === '7days' ? 'active' : ''}`}
              onClick={() => setTrendPeriod('7days')}
            >
              {t('sessions.trend.7days', '7 Days')}
            </button>
            <button
              className={`trend-button ${trendPeriod === '30days' ? 'active' : ''}`}
              onClick={() => setTrendPeriod('30days')}
            >
              {t('sessions.trend.30days', '30 Days')}
            </button>
          </div>
        </div>
        <div className="chart-container">
          {trendData.labels.length > 0 ? (
            <Line data={trendData} options={chartOptions} />
          ) : (
            <div className="chart-empty">
              {t('sessions.trend.noData', 'No data available for the selected period')}
            </div>
          )}
        </div>
      </section>
        {/* Sessions Table */}
        <section className="sessions-table-section">
        <div className="section-header">
          <h2>{t('sessions.table.title', 'Session History')}</h2>
          <div className="table-meta">
            <span className="meta-text">
              {t('sessions.table.showing', 'Showing {count} sessions').replace(
                '{count}',
                displaySessions.length.toString()
              )}
            </span>
          </div>
        </div>
        {deleteStatus && (
          <div className={`delete-status ${deleteStatus.type}`}>
            {deleteStatus.message}
          </div>
        )}

        {displaySessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>{t('sessions.empty.title', 'No sessions yet')}</h3>
            <p>{t('sessions.empty.desc', 'Start training to see your session history here')}</p>
            <button
              className="primary-button"
              onClick={() => navigate('/calibration')}
            >
              {t('sessions.empty.cta', 'Start Training')}
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      className={`sortable-button ${sortField === 'date' ? 'active' : ''}`}
                      onClick={() => handleSort('date')}
                    >
                      {t('sessions.table.date', 'Date')}
                      <span className="sort-indicator">
                        {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </span>
                    </button>
                  </th>
                  <th>
                    <button
                      className={`sortable-button ${sortField === 'score' ? 'active' : ''}`}
                      onClick={() => handleSort('score')}
                    >
                      {t('sessions.table.score', 'Score')}
                      <span className="sort-indicator">
                        {sortField === 'score' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </span>
                    </button>
                  </th>
                  <th>
                    <button
                      className={`sortable-button ${sortField === 'accuracy' ? 'active' : ''}`}
                      onClick={() => handleSort('accuracy')}
                    >
                      {t('sessions.table.accuracy', 'Accuracy')}
                      <span className="sort-indicator">
                        {sortField === 'accuracy' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </span>
                    </button>
                  </th>
                  <th>{t('sessions.table.targets', 'Targets Hit')}</th>
                  <th>
                    <button
                      className={`sortable-button ${sortField === 'avgReactionTime' ? 'active' : ''}`}
                      onClick={() => handleSort('avgReactionTime')}
                    >
                      {t('sessions.table.reaction', 'Avg Reaction')}
                      <span className="sort-indicator">
                        {sortField === 'avgReactionTime' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </span>
                    </button>
                  </th>
                  <th>{t('sessions.table.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {displaySessions.map((session) => (
                  <tr
                    key={session.id}
                    className="session-row"
                  >
                    <td className="date-cell">{formatDate(session.date)}</td>
                    <td className="score-cell">
                      <strong>{session.score}</strong>
                    </td>
                    <td>
                      <span className={`performance-badge ${getPerformanceClass(session.accuracy)}`}>
                        {session.accuracy.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      {session.targetsHit} / {session.totalTargets}
                    </td>
                    <td>{session.avgReactionTime.toFixed(0)}ms</td>
                    <td className="table-actions">
                      <div className="table-actions-group">
                        <button
                          className="view-button"
                          onClick={() => handleViewSession(session.id)}
                        >
                          {t('sessions.table.view', 'View')}
                        </button>
                        <button
                          className="report-button"
                          onClick={() => handleReportAction(session.id)}
                          disabled={isLoadingReports}
                        >
                          {sessionReportMap[session.id]
                            ? t('sessions.table.report.viewExisting', 'View Report')
                            : t('sessions.table.report.create', 'Create Report')}
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteSession(session.id)}
                          disabled={deletingId === session.id}
                        >
                          {deletingId === session.id
                            ? t('sessions.table.deleting', 'Deleting...')
                            : t('sessions.table.delete', 'Delete')}
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
     
    </div>
  );
};

export default SessionsHistoryPage;
