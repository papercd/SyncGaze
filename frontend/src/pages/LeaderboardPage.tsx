import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import './LeaderboardPage.css';
import { db } from '../lib/firebase';
import type { LeaderboardEntry } from '../utils/remoteSessions';

interface RankedEntry extends LeaderboardEntry {
  rank: number;
}

const LIMIT_OPTIONS = [10, 50];

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(LIMIT_OPTIONS[0]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const ref = collection(db, 'leaderboardEntries');
        const leaderboardQuery = query(ref, orderBy('score', 'desc'), limit(visibleCount));
        const snapshot = await getDocs(leaderboardQuery);
        const data = snapshot.docs.map(docSnap => docSnap.data() as LeaderboardEntry);

        setEntries(data);
      } catch (err) {
        console.error('Failed to load leaderboard', err);
        setError('리더보드 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    fetchLeaderboard();
  }, [visibleCount]);

  const rankedEntries = useMemo<RankedEntry[]>(() => {
    return [...entries]
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }, [entries]);

  return (
    <div className="leaderboard-page">
      <header className="leaderboard-header">
        <div>
          <p className="eyebrow">Leaderboard</p>
          <h1>최신 트레이닝 순위</h1>
          <p className="subtext">파이어베이스 리더보드 API에서 불러온 상위 {visibleCount}개 세션입니다.</p>
        </div>
        <div className="leaderboard-actions">
          <button className="leaderboard-button ghost" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <button className="leaderboard-button" onClick={() => navigate('/tracker-flow')}>
            View tracker flow
          </button>
        </div>
      </header>

      <div className="leaderboard-card filter-bar">
        <span className="filter-label">보기: </span>
        <div className="filter-buttons">
          {LIMIT_OPTIONS.map(option => (
            <button
              key={option}
              className={`chip-button ${visibleCount === option ? 'active' : ''}`}
              onClick={() => setVisibleCount(option)}
            >
              Top {option}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="leaderboard-card loading-state">불러오는 중...</div>
      ) : error ? (
        <div className="leaderboard-card error-state">{error}</div>
      ) : (
        <>
          <section className="top-grid">
            {rankedEntries.length === 0 ? (
              <div className="leaderboard-card empty-state">아직 등록된 점수가 없습니다.</div>
            ) : (
              rankedEntries.slice(0, 3).map(entry => {
                const label = entry.label || 'Anonymous';
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
                    <p className="score-text">{entry.score.toLocaleString()} pts</p>
                    <div className="metric-row">
                      <span>Accuracy {entry.accuracy.toFixed(1)}%</span>
                      <span>Avg RT {entry.avgReactionTime.toFixed(0)}ms</span>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          {rankedEntries.length > 0 && (
            <section className="leaderboard-table">
              <div className="table-head">
                <div>
                  <p className="eyebrow">전체 순위</p>
                  <h2>상위 {Math.min(rankedEntries.length, visibleCount)}명</h2>
                </div>
                <span className="meta-text">score 기준 내림차순</span>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Player</th>
                      <th scope="col">Score</th>
                      <th scope="col">Accuracy</th>
                      <th scope="col">Avg RT</th>
                      <th scope="col">Targets</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedEntries.map(entry => {
                      const label = entry.label || 'Anonymous';
                      return (
                        <tr key={`${entry.uid}-${entry.sessionId}`}>
                          <td>#{entry.rank}</td>
                          <td>
                            <div className="player-cell">
                              <span className="avatar-circle">{label.charAt(0).toUpperCase()}</span>
                              <div>
                                <div className="player-name">{label}</div>
                                <div className="player-meta">Session {entry.sessionId.slice(0, 6)}</div>
                              </div>
                            </div>
                          </td>
                          <td>{entry.score.toLocaleString()}</td>
                          <td>{entry.accuracy.toFixed(1)}%</td>
                          <td>{entry.avgReactionTime.toFixed(0)}ms</td>
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
