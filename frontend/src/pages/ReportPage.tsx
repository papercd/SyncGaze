// frontend/src/pages/ReportPage.tsx - UPDATED with session IDs removed
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Sparkles } from 'lucide-react';
import { useAuth } from '../state/authContext';
import { useTrackingSession, type TrainingSessionSummary } from '../state/trackingSessionContext';
import { generatePerformanceReport, saveReport, getUserReports, PerformanceReport } from '../services/reportService';
import { predictScore } from '../services/predictionService';
import './ReportPage.css';
import { useTranslation } from '../state/languageContext';

const ReportPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const { activeSession, calibrationResult, recentSessions } = useTrackingSession();
  const reportSessionId = (location.state as { sessionId?: string } | null)?.sessionId;

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<PerformanceReport | null>(null);
  const [savedReports, setSavedReports] = useState<PerformanceReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [predictedScore, setPredictedScore] = useState<number | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // Load saved reports on mount
  useEffect(() => {
    if (user?.uid) {
      loadSavedReports();
    }
  }, [user?.uid]);

  // When the active session changes, try to pre-fetch a predicted score if missing
  useEffect(() => {
    let cancelled = false;

    const runPrediction = async () => {
      if (!activeSession) {
        setPredictedScore(null);
        return;
      }

      // 먼저 저장된 값을 보여주고, 최신 값을 위해 API를 호출한다.
      if (activeSession.predictedScore != null) {
        setPredictedScore(activeSession.predictedScore);
      }

      setIsPredicting(true);
      try {
        const result = await predictScore(activeSession);
        if (!cancelled) {
          setPredictedScore(result.predictedScore ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to prefetch predicted score:', err);
          setPredictedScore(null);
        }
      } finally {
        if (!cancelled) {
          setIsPredicting(false);
        }
      }
    };

    runPrediction();

    return () => {
      cancelled = true;
    };
  }, [activeSession]);
  useEffect(() => {
    if (!reportSessionId || savedReports.length === 0) return;

    const matchedReport = savedReports.find(report => report.sessionId === reportSessionId);
    if (matchedReport) {
      setCurrentReport(matchedReport);
      setSelectedReportId(matchedReport.id);
    }
  }, [reportSessionId, savedReports]);

  const loadSavedReports = async () => {
    if (!user?.uid) return;
    try {
      const reports = await getUserReports(user.uid);
      setSavedReports(reports);
    } catch (err) {
      console.error('Failed to load saved reports:', err);
    }
  };

  const handleGenerateReport = async () => {
    if (!activeSession || !user?.uid) {
      setError(t('report.error.missingSession', '활성 세션 또는 사용자 정보가 없습니다.'));
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 항상 최신 예측값을 요청하고, 실패 시 기존 값으로 fallback
      let resolvedPredictedScore = predictedScore ?? activeSession.predictedScore ?? null;
      try {
        const prediction = await predictScore(activeSession);
        resolvedPredictedScore = prediction.predictedScore ?? resolvedPredictedScore;
        setPredictedScore(resolvedPredictedScore);
      } catch (predictionError) {
        console.warn('Prediction request failed during report generation', predictionError);
      }

      const report = await generatePerformanceReport({
        userId: user.uid,
        sessionId: activeSession.id,
        reactionTime: activeSession.avgReactionTime,
        overlapScore: activeSession.gazeAccuracy,
        trackingAccuracy: activeSession.mouseAccuracy,
        accuracy: activeSession.accuracy,
        targetsHit: activeSession.targetsHit,
        totalTargets: activeSession.totalTargets,
        predictedScore: resolvedPredictedScore,
        calibrationError: calibrationResult?.validationError,
      });

      setCurrentReport(report);
      
      // Save to Firebase
      await saveReport(user.uid, report);

      // Reload saved reports
      await loadSavedReports();
      setSelectedReportId(report.id);
    } catch (err) {
      console.error('Report generation failed:', err);
      setError(t('report.error.generateFail', '리포트 생성에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewSavedReport = (reportId: string) => {
    const report = savedReports.find(r => r.id === reportId);
    if (report) {
      setCurrentReport(report);
      setSelectedReportId(reportId);
    }
  };

  const formatReportDate = (dateString: string, includeTime: boolean = false): string => {
    const date = new Date(dateString);
    if (includeTime) {
      return date.toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', { 
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getReportTitle = (report: PerformanceReport): string => {
    const date = new Date(report.generatedAt);
    const timeString = date.toLocaleTimeString(language === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    return t('report.card.title', '{time} 리포트').replace('{time}', timeString);
  };

  const renderReportContent = (report: PerformanceReport) => {
    const sessionInfo: TrainingSessionSummary | undefined = recentSessions.find(s => s.id === report.sessionId);
    const sessionDateText = sessionInfo
      ? new Date(sessionInfo.date).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
      : null;
    const sessionDurationText = sessionInfo ? `${sessionInfo.duration}s` : null;
    const sessionAccuracyText = sessionInfo ? `${sessionInfo.accuracy.toFixed(1)}%` : null;
    const sessionTargetsText = sessionInfo ? `${sessionInfo.targetsHit}/${sessionInfo.totalTargets}` : null;

    return (
      <div className="report-content">
        <div className="report-header">
          <h2>{t('report.title', '성능 분석 리포트')}</h2>
          <div className="report-meta">
            <span>📅 {formatReportDate(report.generatedAt, true)}</span>
          </div>
          <div className="report-session-meta">
            <div className="meta-row">
              <span className="meta-label">{t('report.session.id', '세션 ID')}</span>
              <span className="meta-value">{report.sessionId}</span>
            </div>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="meta-label">{t('report.session.date', '날짜')}</span>
                <span className="meta-value">{sessionDateText ?? '-'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">{t('report.session.duration', '세션 길이')}</span>
                <span className="meta-value">{sessionDurationText ?? '-'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">{t('report.session.targets', '명중')}</span>
                <span className="meta-value">{sessionTargetsText ?? '-'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">{t('report.session.accuracy', '정확도')}</span>
                <span className="meta-value">{sessionAccuracyText ?? '-'}</span>
              </div>
            </div>
          </div>
        </div>

        <div 
          className="report-markdown"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(report.content) }}
        />

        <div className="report-data-summary">
          <h3>{t('report.data.title', '측정 데이터')}</h3>
          <div className="data-grid">
            <div className="data-item">
              <span className="data-label">{t('report.data.predicted', '예측 점수')}</span>
              <span className="data-value">
                {report.metrics.predictedScore != null
                  ? report.metrics.predictedScore.toFixed(1)
                  : 'N/A'}
              </span>
            </div>
            <div className="data-item">
              <span className="data-label">{t('report.data.reaction', '반응 속도')}</span>
              <span className="data-value">{report.metrics.reactionTime.toFixed(0)}ms</span>
              <span className="data-percentile">(상위 {report.metrics.reactionTimePercentile}%)</span>
            </div>
            <div className="data-item">
              <span className="data-label">{t('report.data.overlap', '시선-에임 일치도')}</span>
              <span className="data-value">{report.metrics.overlapScore.toFixed(1)}%</span>
              <span className="data-percentile">(상위 {report.metrics.overlapScorePercentile}%)</span>
            </div>
            <div className="data-item">
              <span className="data-label">{t('report.data.tracking', '트래킹 정확도')}</span>
              <span className="data-value">{report.metrics.trackingAccuracy.toFixed(1)}%</span>
            </div>
            <div className="data-item">
              <span className="data-label">{t('report.data.accuracy', '종합 정확도')}</span>
              <span className="data-value">{report.metrics.accuracy.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Simple markdown to HTML converter
  const renderMarkdown = (markdown: string): string => {
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, '<p>$1</p>')
      .replace(/<p><\/p>/g, '')
      .replace(/<p><h/g, '<h')
      .replace(/<\/h[1-6]><\/p>/g, (match) => match.replace('<p>', '').replace('</p>', ''))
      .replace(/<p><ul>/g, '<ul>')
      .replace(/<\/ul><\/p>/g, '</ul>');
  };

  return (
    <div className="report-page">
      <div className="report-container">
        <button className="back-button" onClick={() => navigate('/results')}>
          ← {t('report.back', '결과 페이지로 돌아가기')}
        </button>

        <div className="report-layout">
          {/* Sidebar with saved reports */}
          <aside className="report-sidebar">
            <h3>{t('report.sidebar.title', '저장된 리포트')}</h3>
            <div className="report-list">
              {savedReports.length === 0 ? (
                <p className="no-reports">
                  <FileText size={48} strokeWidth={1.5} style={{ opacity: 0.3, margin: '1rem auto' }} />
                  <br />
                  {t('report.sidebar.empty', '저장된 리포트가 없습니다')}
                </p>
              ) : (
                savedReports.map(report => (
                  <div
                    key={report.id}
                    className={`report-item ${selectedReportId === report.id ? 'active' : ''}`}
                    onClick={() => handleViewSavedReport(report.id)}
                  >
                    <div className="report-item-date">
                      {formatReportDate(report.generatedAt)}
                    </div>
                    <div className="report-item-preview">
                      {getReportTitle(report)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Main content */}
          <main className="report-main">
            {!currentReport ? (
              <div className="report-generate">
                <h1>{t('report.generate.title', 'AI 성능 분석 리포트')}</h1>
                <p className="report-description">
                  {t(
                    'report.generate.desc',
                    '전직 FPS 프로게이머 출신 코치의 시각으로 당신의 플레이를 분석하고, 맞춤형 훈련 방법을 제안합니다.',
                  )}
                </p>

                {!activeSession && (
                  <div className="warning-box">
                    <p>⚠️ {t('report.warning.noSession', '활성 세션이 없습니다. 먼저 트레이닝을 완료해주세요.')}</p>
                  </div>
                )}

                {activeSession && (
                  <div className="session-summary">
                    <h3>{t('report.summary.title', '현재 세션 데이터')}</h3>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span>{t('report.data.predicted', '예측 점수')}</span>
                        <strong>
                          {predictedScore != null
                            ? predictedScore.toFixed(1)
                            : isPredicting
                              ? t('report.loading.prediction', '계산 중...')
                              : 'N/A'}
                        </strong>
                      </div>
                      <div className="summary-item">
                        <span>{t('report.data.reaction', '반응 속도')}</span>
                        <strong>{activeSession.avgReactionTime.toFixed(0)}ms</strong>
                      </div>
                      <div className="summary-item">
                        <span>{t('report.summary.gazeAcc', '시선 정확도')}</span>
                        <strong>{activeSession.gazeAccuracy.toFixed(1)}%</strong>
                      </div>
                      <div className="summary-item">
                        <span>{t('report.summary.mouseAcc', '마우스 정확도')}</span>
                        <strong>{activeSession.mouseAccuracy.toFixed(1)}%</strong>
                      </div>
                      <div className="summary-item">
                        <span>{t('report.summary.hitRate', '적중률')}</span>
                        <strong>{activeSession.accuracy.toFixed(1)}%</strong>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="error-box">
                    <p>{error}</p>
                  </div>
                )}

                <button
                  className="generate-button"
                  onClick={handleGenerateReport}
                  disabled={isGenerating || !activeSession}
                >
                  {isGenerating ? (
                    <>
                      <span className="spinner"></span>
                      {t('report.actions.generating', '리포트 생성 중...')}
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      {t('report.actions.generate', '리포트 생성하기')}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <>
                {renderReportContent(currentReport)}
                <div className="report-actions">
                  <button
                    className="new-report-button inline"
                    onClick={() => {
                      setCurrentReport(null);
                      setSelectedReportId(null);
                    }}
                  >
                    {t('report.actions.new', '새 리포트 생성')}
                  </button>
                  <button className="print-button" onClick={() => window.print()}>
                    🖨️ {t('report.actions.print', '리포트 인쇄')}
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
