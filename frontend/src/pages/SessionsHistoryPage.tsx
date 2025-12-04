// src/pages/SessionsHistoryPage.tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrackingSession } from '../state/trackingSessionContext';
import { useTranslation } from '../state/languageContext';
import { Line } from 'react-chartjs-2';
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
  const { t } = useTranslation();
  const { recentSessions, setActiveSessionId } = useTrackingSession();

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('7days');

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
          text: 'Accuracy (%)',
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
          text: 'Reaction Time (ms)',
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

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString(undefined, {
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

  return (
    <div className="sessions-history-page">
      {/* Header */}
      <header className="sessions-header">
        <div className="header-content">
          <h1>{t('sessions.title', 'Training Sessions')}</h1>
          <p className="header-subtitle">
            {t('sessions.subtitle', 'View your training history and performance trends')}
          </p>
        </div>
      </header>

      {/* Quick Stats */}
      <section className="sessions-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>{stats.totalSessions}</h3>
            <p>{t('sessions.stats.total', 'Total Sessions')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <h3>{stats.avgAccuracy}%</h3>
            <p>{t('sessions.stats.avgAccuracy', 'Average Accuracy')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-info">
            <h3>{stats.avgReactionTime}ms</h3>
            <p>{t('sessions.stats.avgReaction', 'Avg Reaction Time')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <h3>{stats.bestScore}</h3>
            <p>{t('sessions.stats.bestScore', 'Best Score')}</p>
          </div>
        </div>
      </section>

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
          <h2>{t('sessions.table.title', 'Recent Sessions')}</h2>
          <div className="table-meta">
            <span className="meta-text">
              {t('sessions.table.showing', 'Showing {count} sessions').replace(
                '{count}',
                displaySessions.length.toString()
              )}
            </span>
          </div>
        </div>

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
                  <th>{t('sessions.table.action', 'Action')}</th>
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
                    <td>
                      <button
                        className="view-button"
                        onClick={() => handleViewSession(session.id)}
                      >
                        {t('sessions.table.view', 'View')}
                      </button>
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