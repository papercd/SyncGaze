import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import './LeaderboardPage.css';
import { db } from '../lib/firebase';
import { useTranslation } from '../state/languageContext';
import type { LeaderboardEntry } from '../utils/remoteSessions';
import { predictScore } from '../services/predictionService';
import type { TrainingSessionSummary } from '../state/trackingSessionContext';

interface RankedEntry extends LeaderboardEntry {
  rank: number;
}

type SortKey =
  | 'rank'
  | 'label'
  | 'score'
  | 'sgRankScore'
  | 'accuracy'
  | 'avgReactionTime'
  | 'gazeAimLatency'
  | 'targetsHit'
  | 'sessionDate';

type SortDirection = 'asc' | 'desc';

const SORT_LABEL_KEYS: Record<SortKey, string> = {
  rank: 'leaderboard.column.rank',
  label: 'leaderboard.column.player',
  score: 'leaderboard.column.score',
  sgRankScore: 'SG Rank',
  accuracy: 'leaderboard.column.accuracy',
  avgReactionTime: 'leaderboard.column.avgReactionTime',
  gazeAimLatency: 'leaderboard.column.gazeAimLatency',
  targetsHit: 'leaderboard.column.targetsHit',
  sessionDate: 'leaderboard.column.sessionDate',
};

const LIMIT_OPTIONS = [10, 50];

type LeaderboardMetric = 'accuracy' | 'avgReactionTime' | 'gazeAimLatency' | 'score';

type MetricConfig = { key: SortKey; direction: SortDirection; labelKey: string; fallback: string };

const METRIC_CONFIG: Record<LeaderboardMetric | 'sgRankScore', MetricConfig> = {
  score: { key: 'score', direction: 'desc', labelKey: 'leaderboard.metric.score', fallback: 'Score' },
  sgRankScore: { key: 'score', direction: 'desc', labelKey: 'leaderboard.metric.sgRankScore', fallback: 'SG Rank' },
  accuracy: { key: 'accuracy', direction: 'desc', labelKey: 'leaderboard.metric.accuracy', fallback: 'Accuracy' },
  avgReactionTime: {
    key: 'avgReactionTime',
    direction: 'asc',
    labelKey: 'leaderboard.metric.reaction',
    fallback: 'Reaction time',
  },
  gazeAimLatency: {
    key: 'gazeAimLatency',
    direction: 'asc',
    labelKey: 'leaderboard.metric.gazeAim',
    fallback: 'Gaze aim latency',
  },
};

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(LIMIT_OPTIONS[0]);
  const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric | 'sgRankScore'>('accuracy');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>(
    METRIC_CONFIG.accuracy,
  );
  const [predictedScores, setPredictedScores] = useState<Record<string, number | null>>({});
  const [isPredicting, setIsPredicting] = useState(false);

  const formatDate = useCallback(
    (value: string) => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return '-';

      return parsed.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });
    },
    [language],
  );

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { key, direction } = METRIC_CONFIG[leaderboardMetric];
        const ref = collection(db, 'leaderboardEntries');
        const leaderboardQuery = query(ref, orderBy(key, direction), limit(visibleCount));
        const snapshot = await getDocs(leaderboardQuery);
        const data = snapshot.docs.map(docSnap => docSnap.data() as LeaderboardEntry);

        setEntries(data);
      } catch (err) {
        console.error('Failed to load leaderboard', err);
        setError(t('leaderboard.error', 'Failed to load leaderboard data.'));
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    fetchLeaderboard();
  }, [leaderboardMetric, visibleCount, t]);

  useEffect(() => {
    const runPredictions = async () => {
      if (!entries.length) {
        setPredictedScores({});
        return;
      }
      setIsPredicting(true);
      try {
        const results = await Promise.all(
          entries.map(async entry => {
            // LeaderboardEntry는 rawData가 없으므로 최소 정보로 세션 객체를 구성
            const sessionStub: TrainingSessionSummary = {
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
              const res = await predictScore(sessionStub);
              return { key: `${entry.uid}-${entry.sessionId}`, score: res.predictedScore ?? null };
            } catch (err) {
              console.warn('Prediction failed for leaderboard entry', entry.sessionId, err);
              return { key: `${entry.uid}-${entry.sessionId}`, score: null };
            }
          }),
        );
        const map = results.reduce<Record<string, number | null>>((acc, curr) => {
          acc[curr.key] = curr.score;
          return acc;
        }, {});
        setPredictedScores(map);
      } finally {
        setIsPredicting(false);
      }
    };

    runPredictions();
  }, [entries]);

  useEffect(() => {
    setSortConfig(METRIC_CONFIG[leaderboardMetric]);
  }, [leaderboardMetric]);

  const activeMetric = METRIC_CONFIG[leaderboardMetric];
  const activeMetricLabel = t(activeMetric.labelKey, activeMetric.fallback);

  const formatMetricValue = (entry: LeaderboardEntry) => {
    switch (leaderboardMetric) {
      case 'score':
        return t('leaderboard.card.score', `${entry.score.toLocaleString()} pts`).replace(
          '{value}',
          entry.score.toLocaleString(),
        );
      case 'sgRankScore': {
        const val = predictedScores[`${entry.uid}-${entry.sessionId}`];
        return val != null ? val.toFixed(1) : isPredicting ? '...' : '--';
      }
      case 'accuracy':
        return t('leaderboard.card.accuracy', `${entry.accuracy.toFixed(1)}%`).replace(
          '{value}',
          entry.accuracy.toFixed(1),
        );
      case 'avgReactionTime':
        return `${entry.avgReactionTime.toFixed(0)}ms`;
      case 'gazeAimLatency':
        return `${entry.gazeAimLatency.toFixed(0)}ms`;
      default:
        return '';
    }
  };

  const getMetricValue = useCallback(
    (entry: LeaderboardEntry) => {
      switch (leaderboardMetric) {
        case 'score':
          return entry.score;
        case 'sgRankScore': {
          const val = predictedScores[`${entry.uid}-${entry.sessionId}`];
          return typeof val === 'number' ? val : -Infinity;
        }
        case 'accuracy':
          return entry.accuracy;
        case 'avgReactionTime':
          return entry.avgReactionTime;
        case 'gazeAimLatency':
          return entry.gazeAimLatency;
        default:
          return 0;
      }
    },
    [leaderboardMetric, predictedScores],
  );

  const rankedEntries = useMemo<RankedEntry[]>(() => {
    const { key, direction } = METRIC_CONFIG[leaderboardMetric];
    const directionMultiplier = direction === 'asc' ? 1 : -1;

    return [...entries]
      .sort((a, b) => {
        const valueA = getMetricValue(a);
        const valueB = getMetricValue(b);
        return (valueA - valueB) * directionMultiplier;
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }, [entries, getMetricValue]);

  const sortedEntries = useMemo<RankedEntry[]>(() => {
    const compareValues = (a: RankedEntry, b: RankedEntry) => {
      const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

      switch (sortConfig.key) {
        case 'rank':
          return (a.rank - b.rank) * directionMultiplier;
        case 'label': {
          const fallback = t('leaderboard.player.anonymous', 'Anonymous').toLowerCase();
          const labelA = (a.label || fallback).toLowerCase();
          const labelB = (b.label || fallback).toLowerCase();
          return labelA.localeCompare(labelB) * directionMultiplier;
        }
        case 'score':
          return (a.score - b.score) * directionMultiplier;
        case 'sgRankScore': {
          const aVal = predictedScores[`${a.uid}-${a.sessionId}`];
          const bVal = predictedScores[`${b.uid}-${b.sessionId}`];
          const safeA = typeof aVal === 'number' ? aVal : -Infinity;
          const safeB = typeof bVal === 'number' ? bVal : -Infinity;
          return (safeA - safeB) * directionMultiplier;
        }
        case 'accuracy':
          return (a.accuracy - b.accuracy) * directionMultiplier;
        case 'avgReactionTime':
          return (a.avgReactionTime - b.avgReactionTime) * directionMultiplier;
        case 'gazeAimLatency':
          return (a.gazeAimLatency - b.gazeAimLatency) * directionMultiplier;
        case 'targetsHit':
          return (a.targetsHit - b.targetsHit) * directionMultiplier;
        case 'sessionDate': {
          const dateA = new Date(a.sessionDate).getTime();
          const dateB = new Date(b.sessionDate).getTime();
          return (dateA - dateB) * directionMultiplier;
        }
        default:
          return 0;
      }
    };

    return [...rankedEntries].sort(compareValues);
  }, [rankedEntries, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }

      return { key, direction: key === 'rank' ? 'asc' : 'desc' };
    });
  };

  const getSortLabel = (key: SortKey, label: string) => {
    const isActive = sortConfig.key === key;
    const arrow = !isActive ? '↕' : sortConfig.direction === 'asc' ? '▲' : '▼';

    return (
      <button className={`sortable-button ${isActive ? 'active' : ''}`} onClick={() => toggleSort(key)}>
        <span>{label}</span>
        <span className="sort-indicator">{arrow}</span>
      </button>
    );
  };

  const getSortLabelText = (key: SortKey) => t(SORT_LABEL_KEYS[key], SORT_LABEL_KEYS[key]);
  const sortLabel = getSortLabelText(sortConfig.key);
  const sortDirectionLabel =
    sortConfig.direction === 'asc'
      ? t('leaderboard.sort.asc', 'ascending')
      : t('leaderboard.sort.desc', 'descending');
  const sortDescription = t('leaderboard.sort.description', `${sortLabel} ${sortDirectionLabel}`)
    .replace('{label}', sortLabel)
    .replace('{direction}', sortDirectionLabel);

  const scoreRankMap = useMemo<Record<string, number>>(() => {
    const sortedByScore = [...entries].sort((a, b) => b.score - a.score);
    return sortedByScore.reduce<Record<string, number>>((acc, entry, idx) => {
      acc[`${entry.uid}-${entry.sessionId}`] = idx + 1;
      return acc;
    }, {});
  }, [entries]);

  return (
    <div className="leaderboard-page">
      <header className="leaderboard-header">
        <div>
          <h1>{t('leaderboard.title.main')}</h1>
          <p className="subtext">
            {t('leaderboard.subtitle.count', 'Top {count} sessions fetched from the Firebase leaderboard API.').replace(
              '{count}',
              visibleCount.toString(),
            )}
          </p>
         
        </div>
      
      </header>

      <div className="filter-stack">
        <div className="leaderboard-card filter-bar">
          <span className="filter-label">{t('leaderboard.filter.metric', 'Leaderboard metric:')}</span>
          <div className="filter-buttons">
            {Object.entries(METRIC_CONFIG).map(([key, config]) => (
              <button
                key={key}
                className={`chip-button ${leaderboardMetric === key ? 'active' : ''}`}
                onClick={() => setLeaderboardMetric(key as LeaderboardMetric | 'sgRankScore')}
              >
                {t(config.labelKey, config.fallback)}
              </button>
            ))}
          </div>
        </div>

        <div className="leaderboard-card filter-bar">
          <span className="filter-label">{t('leaderboard.filter.limit', 'Show:')}</span>
          <div className="filter-buttons">
            {LIMIT_OPTIONS.map(option => (
              <button
                key={option}
                className={`chip-button ${visibleCount === option ? 'active' : ''}`}
                onClick={() => setVisibleCount(option)}
              >
                {t('leaderboard.filter.limitOption', `Top {count}`).replace('{count}', option.toString())}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="leaderboard-card loading-state">{t('leaderboard.loading')}</div>
      ) : error ? (
        <div className="leaderboard-card error-state">{error}</div>
      ) : (
        <>
          <section className="top-grid">
            {rankedEntries.length === 0 ? (
              <div className="leaderboard-card empty-state">{t('leaderboard.empty', 'No scores have been submitted yet.')}</div>
            ) : (
              rankedEntries.slice(0, 3).map(entry => {
                const label = entry.label || t('leaderboard.player.anonymous', 'Anonymous');
                return (
                  <article
                    key={`${entry.uid}-${entry.sessionId}`}
                    className={`leaderboard-card highlight rank-${entry.rank}`}
                  >
                    <div className="rank-badge">#{entry.rank}</div>
                    <div className="highlight-meta">
                      <h3>{label}</h3>
                      <p>{formatDate(entry.sessionDate)}</p>
                    </div>
                    <div className="metric-highlight">
                      <p className="metric-label">{activeMetricLabel}</p>
                      <p className="metric-value">{formatMetricValue(entry)}</p>
                      <p className="metric-subtext">
                        {t('leaderboard.card.accuracy', 'Accuracy {value}%').replace(
                          '{value}',
                          entry.accuracy.toFixed(1),
                        )}
                      </p>
                    </div>
                    <p className="score-subtext">
                      {t('leaderboard.card.score', '{value} pts').replace(
                        '{value}',
                        entry.score.toLocaleString(),
                      )}
                    </p>
                  </article>
                );
              })
            )}
          </section>

          {rankedEntries.length > 0 && (
            <section className="leaderboard-table">
              <div className="table-head">
                <div>
                  <p className="eyebrow">{t('leaderboard.table.eyebrow', 'Overall rankings')}</p>
                  <h2>
                    {t('leaderboard.table.title', 'Top {count} players').replace(
                      '{count}',
                      Math.min(rankedEntries.length, visibleCount).toString(),
                    )}
                  </h2>
                </div>
                {/** 
                 * 
                 * <div className="table-meta">
                  <p className="meta-text sort-hint">{t('leaderboard.table.hint', 'Click a column header to sort the leaderboard.')}</p>
                  <span className="meta-text">
                    {t('leaderboard.table.meta', '{metric} leaderboard • {sort}')
                      .replace('{metric}', activeMetricLabel)
                      .replace('{sort}', sortDescription)}
                  </span>
                </div>
                */}
                
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{getSortLabel('rank', getSortLabelText('rank'))}</th>
                      <th scope="col">{getSortLabel('label', getSortLabelText('label'))}</th>
                      <th scope="col">{getSortLabel('score', getSortLabelText('score'))}</th>
                      <th scope="col">{getSortLabel('sgRankScore', getSortLabelText('sgRankScore'))}</th>
                      <th scope="col">{getSortLabel('accuracy', getSortLabelText('accuracy'))}</th>
                      <th scope="col">{getSortLabel('avgReactionTime', getSortLabelText('avgReactionTime'))}</th>
                      <th scope="col">{getSortLabel('gazeAimLatency', getSortLabelText('gazeAimLatency'))}</th>
                      <th scope="col">{getSortLabel('targetsHit', getSortLabelText('targetsHit'))}</th>
                      <th scope="col">{getSortLabel('sessionDate', getSortLabelText('sessionDate'))}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map(entry => {
                      const label = entry.label || t('leaderboard.player.anonymous', 'Anonymous');
                      return (
                        <tr key={`${entry.uid}-${entry.sessionId}`}>
                          <td>#{entry.rank}</td>
                          <td>
                            <div className="player-cell">
                              <span className="avatar-circle">{label.charAt(0).toUpperCase()}</span>
                              <div>
                                <div className="player-name">{label}</div>
                                <div className="player-meta">
                                  {t('leaderboard.player.session', `Session ${entry.sessionId.slice(0, 6)}`)
                                    .replace('{id}', entry.sessionId.slice(0, 6))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>{entry.score.toLocaleString()}</td>
                          <td>
                            {predictedScores[`${entry.uid}-${entry.sessionId}`] != null
                              ? predictedScores[`${entry.uid}-${entry.sessionId}`]?.toFixed(1)
                              : isPredicting
                                ? '...'
                                : '--'}
                          </td>
                          <td>{entry.accuracy.toFixed(1)}%</td>
                          <td>{entry.avgReactionTime.toFixed(0)}ms</td>
                          <td>{entry.gazeAimLatency.toFixed(0)}ms</td>
                          <td>
                            {entry.targetsHit}/{entry.totalTargets}
                          </td>
                          <td>{formatDate(entry.sessionDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default LeaderboardPage;
