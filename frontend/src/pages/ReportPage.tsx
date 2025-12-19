// frontend/src/pages/ReportPage.tsx - UPDATED with session IDs removed
import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Sparkles } from 'lucide-react';
import { useAuth } from '../state/authContext';
import { useTrackingSession, type TrainingSessionSummary } from '../state/trackingSessionContext';
import { generatePerformanceReport, saveReport, getUserReports, PerformanceReport } from '../services/reportService';
import { predictScore } from '../services/predictionService';
import './ReportPage.css';
import { useTranslation } from '../state/languageContext';
import { calculatePerformanceAnalytics, type PerformanceAnalytics } from '../utils/analytics';

type MetricKey =
  | 'targets'
  | 'avgReaction'
  | 'gazeReaction'
  | 'gazeAimLatency'
  | 'hitError'
  | 'sync';

type MetricPercentile = {
  value: number;
  label: string;
};

const clampPercentile = (value: number): number => Math.min(99, Math.max(1, Math.round(value)));
const formatPercentileLabel = (value: number, formatter: (pct: number) => string) => formatter(clampPercentile(value));

const metricPercentile = (
  key: MetricKey,
  analytics: PerformanceAnalytics,
    formatter: (pct: number) => string,
): MetricPercentile => {
  switch (key) {
    case 'targets': {
      const ratio = analytics.totalTargets > 0 ? analytics.targetsHit / analytics.totalTargets : 0;
      if (ratio >= 0.95) return { value: 12, label: formatPercentileLabel(12, formatter) };
      if (ratio >= 0.85) return { value: 28, label: formatPercentileLabel(28, formatter) };
      if (ratio >= 0.7) return { value: 45, label: formatPercentileLabel(45, formatter) };
      if (ratio >= 0.55) return { value: 65, label: formatPercentileLabel(65, formatter) };
      return { value: 85, label: formatPercentileLabel(85, formatter) };
    }
    case 'avgReaction': {
      const v = analytics.avgReactionTime;
      if (v <= 300) return { value: 10, label: formatPercentileLabel(10, formatter) };
      if (v <= 450) return { value: 18, label: formatPercentileLabel(18, formatter) };
      if (v <= 650) return { value: 26, label: formatPercentileLabel(26, formatter) };
      if (v <= 820) return { value: 30, label: formatPercentileLabel(30, formatter) };
      if (v <= 1100) return { value: 55, label: formatPercentileLabel(55, formatter) };
      return { value: 85, label: formatPercentileLabel(85, formatter) };
    }
    case 'gazeReaction': {
      const v = analytics.avgGazeReactionTime;
      if (v <= 200) return { value: 10, label: formatPercentileLabel(10, formatter) };
      if (v <= 280) return { value: 20, label: formatPercentileLabel(20, formatter) };
      if (v <= 340) return { value: 35, label: formatPercentileLabel(35, formatter) };
      if (v <= 420) return { value: 50, label: formatPercentileLabel(50, formatter) };
      if (v <= 520) return { value: 72, label: formatPercentileLabel(72, formatter) };
      return { value: 90, label: formatPercentileLabel(90, formatter) };
    }
    case 'gazeAimLatency': {
      const v = analytics.gazeAimLatency;
      if (v <= 320) return { value: 18, label: formatPercentileLabel(18, formatter) };
      if (v <= 480) return { value: 35, label: formatPercentileLabel(35, formatter) };
      if (v <= 650) return { value: 45, label: formatPercentileLabel(45, formatter) };
      if (v <= 780) return { value: 50, label: formatPercentileLabel(50, formatter) };
      if (v <= 950) return { value: 70, label: formatPercentileLabel(70, formatter) };
      return { value: 90, label: formatPercentileLabel(90, formatter) };
    }
    case 'hitError': {
      const avgError = (analytics.gazeErrorAtHit + analytics.mouseErrorAtHit) / 2;
      if (avgError <= 80) return { value: 20, label: formatPercentileLabel(20, formatter) };
      if (avgError <= 120) return { value: 45, label: formatPercentileLabel(45, formatter) };
      if (avgError <= 170) return { value: 65, label: formatPercentileLabel(65, formatter) };
      if (avgError <= 230) return { value: 82, label: formatPercentileLabel(82, formatter) };
      return { value: 90, label: formatPercentileLabel(90, formatter) };
    }
    case 'sync': {
      const v = analytics.synchronization;
      if (v <= 110) return { value: 18, label: formatPercentileLabel(18, formatter) };
      if (v <= 150) return { value: 30, label: formatPercentileLabel(30, formatter) };
      if (v <= 190) return { value: 40, label: formatPercentileLabel(40, formatter) };
      if (v <= 230) return { value: 60, label: formatPercentileLabel(60, formatter) };
      return { value: 80, label: formatPercentileLabel(80, formatter) };
    }
    default:
      return { value: 50, label: formatPercentileLabel(50, formatter) };
  }
};

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
  const activeAnalytics = useMemo(
    () => (activeSession ? calculatePerformanceAnalytics(activeSession.rawData) : null),
    [activeSession],
  );

  const formatPercentile = useMemo(
    () =>
      (value: number) =>
        t('results.percentile.label', language === 'ko' ? '상위 {percentile}%' : 'Top {percentile}%').replace(
          '{percentile}',
          `${clampPercentile(value)}`,
        ),
    [language, t],
  );

  const percentileTextColor = useMemo(
    () => (pct: number) => (pct <= 35 ? '#66d9ff' : pct <= 70 ? '#f1c40f' : '#ff6b6b'),
    [],
  );

  const metricTooltips = useMemo(
    () => ({
      targets: t('results.tooltip.targets', 'Hits show decisiveness and tempo.'),
      avgReaction: t('results.tooltip.avgReaction', 'Faster reactions secure the first-shot edge.'),
      gazeReaction: t('results.tooltip.gazeReaction', 'Gaze reaction shows how fast you acquire targets.'),
      gazeAimLatency: t('results.tooltip.gazeAimLatency', 'Shorter gaze-aim latency keeps aim and shots synced.'),
      hitError: t('results.tooltip.hitError', 'Smaller hit error means steadier micro-aim.'),
      sync: t('results.tooltip.sync', 'Gaze-mouse sync reflects aiming consistency.'),
    }),
    [t],
  );

  const getMetricLevel = useMemo(
    () => (key: MetricKey, analytics: PerformanceAnalytics) => {
      const badColor = '#ff6b6b';
      const midColor = '#f1c40f';
      const goodColor = '#66d9ff';

      switch (key) {
        case 'targets': {
          const ratio = analytics.totalTargets > 0 ? analytics.targetsHit / analytics.totalTargets : 0;
          if (ratio >= 0.8) return { label: t('results.level.targets.top', 'High hit rate'), color: goodColor };
          if (ratio >= 0.7) return { label: t('results.level.targets.mid', 'Average hit rate'), color: midColor };
          return { label: t('results.level.targets.low', 'Needs hit rate improvement'), color: badColor };
        }
        case 'avgReaction': {
          const v = analytics.avgReactionTime;
          if (v <= 450) return { label: t('results.level.reaction.top', 'Excellent reaction time'), color: goodColor };
          if (v <= 900) return { label: t('results.level.reaction.mid', 'Average reaction time'), color: midColor };
          return { label: t('results.level.reaction.low', 'Needs reaction improvement'), color: badColor };
        }
        case 'gazeReaction': {
          const v = analytics.avgGazeReactionTime;
          if (v <= 320) return { label: t('results.level.gaze.top', 'Fast gaze acquisition'), color: goodColor };
          if (v <= 520) return { label: t('results.level.gaze.mid', 'Average gaze acquisition'), color: midColor };
          return { label: t('results.level.gaze.low', 'Slow gaze acquisition'), color: badColor };
        }
        case 'gazeAimLatency': {
          const v = analytics.gazeAimLatency;
          if (v <= 480) return { label: t('results.level.gazeAim.top', 'Short gaze-hand delay'), color: goodColor };
          if (v <= 900) return { label: t('results.level.gazeAim.mid', 'Average gaze-hand delay'), color: midColor };
          return { label: t('results.level.gazeAim.low', 'Needs latency improvement'), color: badColor };
        }
        case 'hitError': {
          const avgError = (analytics.gazeErrorAtHit + analytics.mouseErrorAtHit) / 2;
          if (avgError <= 80) return { label: t('results.level.hitError.top', 'Excellent accuracy'), color: goodColor };
          if (avgError <= 170) return { label: t('results.level.hitError.mid', 'Average accuracy'), color: midColor };
          return { label: t('results.level.hitError.low', 'Needs accuracy improvement'), color: badColor };
        }
        case 'sync': {
          const v = analytics.synchronization;
          if (v <= 150) return { label: t('results.level.sync.top', 'Great gaze-mouse sync'), color: goodColor };
          if (v <= 230) return { label: t('results.level.sync.mid', 'Average sync'), color: midColor };
          return { label: t('results.level.sync.low', 'Needs sync improvement'), color: badColor };
        }
        default:
          return { label: '', color: '#d8ddf3' };
      }
    },
    [t],
  );

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
        gazeReactionTime: activeAnalytics?.avgGazeReactionTime,
        gazeAimLatency: activeAnalytics?.gazeAimLatency,
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
    const analytics: PerformanceAnalytics | null = sessionInfo ? calculatePerformanceAnalytics(sessionInfo.rawData) : null;

    const metricsList = analytics
      ? ([
          {
            key: 'targets' as const,
            label: t('results.metric.targets.label', '명중 수'),
            value: `${analytics.targetsHit}/${analytics.totalTargets}`,
            meaning: metricTooltips.targets,
            level: getMetricLevel('targets', analytics),
            percentile: metricPercentile('targets', analytics, formatPercentile),
          },
          {
            key: 'avgReaction' as const,
            label: t('results.metric.avgReaction.label', '평균 반응'),
            value: `${analytics.avgReactionTime.toFixed(0)}ms`,
            meaning: metricTooltips.avgReaction,
            level: getMetricLevel('avgReaction', analytics),
            percentile: metricPercentile('avgReaction', analytics, formatPercentile),
          },
          {
            key: 'gazeReaction' as const,
            label: t('results.metric.gazeReaction.label', '시선 반응'),
            value: `${analytics.avgGazeReactionTime.toFixed(0)}ms`,
            meaning: metricTooltips.gazeReaction,
            level: getMetricLevel('gazeReaction', analytics),
            percentile: metricPercentile('gazeReaction', analytics, formatPercentile),
          },
          {
            key: 'gazeAimLatency' as const,
            label: t('results.metric.gazeAimLatency.label', '시선-마우스 지연'),
            value: `${analytics.gazeAimLatency.toFixed(0)}ms`,
            meaning: metricTooltips.gazeAimLatency,
            level: getMetricLevel('gazeAimLatency', analytics),
            percentile: metricPercentile('gazeAimLatency', analytics, formatPercentile),
          },
          {
            key: 'hitError' as const,
            label: t('results.metric.hitError.label', '명중 오차 (시선/마우스)'),
            value: `G: ${analytics.gazeErrorAtHit.toFixed(0)}px / M: ${analytics.mouseErrorAtHit.toFixed(0)}px`,
            meaning: metricTooltips.hitError,
            level: getMetricLevel('hitError', analytics),
            percentile: metricPercentile('hitError', analytics, formatPercentile),
          },
          {
            key: 'sync' as const,
            label: t('results.metric.sync.label', '동기화'),
            value: `${analytics.synchronization.toFixed(0)}px`,
            meaning: metricTooltips.sync,
            level: getMetricLevel('sync', analytics),
            percentile: metricPercentile('sync', analytics, formatPercentile),
          },
        ]) satisfies {
          key: MetricKey;
          label: string;
          value: string;
          meaning: string;
          level: { label: string; color: string };
          percentile: MetricPercentile;
        }[]
      : [];

    const metricsBlock = (
      <div className="report-metrics">
        <div className="report-metrics__header">
          <div>
            <h3>{t('report.metrics.title', '핵심 메트릭 한눈에')}</h3>
            <p className="report-metrics__subtitle">
              {t(
                'report.metrics.subtitle',
                '결과 페이지 카드 6개와 동일한 수치, 의미, 평가 코멘트를 종합 평가 바로 아래에서 확인하세요.',
              )}
            </p>
          </div>
          <span className="report-metrics__badge">{t('report.metrics.badge', 'Results view')}</span>
        </div>

        {analytics ? (
          <div className="report-metrics-grid">
            {metricsList.map(metric => (
              <div key={metric.key} className="report-metric-card">
                <div className="report-metric-top">
                  <span className="report-metric-label">{metric.label}</span>
                  <span className="report-metric-chip" style={{ color: metric.level.color, borderColor: metric.level.color }}>
                    {metric.percentile.label}
                  </span>
                </div>
                <div className="report-metric-value">{metric.value}</div>
                <div className="report-metric-meaning">{metric.meaning}</div>
                <div className="report-metric-eval" style={{ color: metric.level.color }}>
                  {metric.level.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="report-metrics--empty">
            {t(
              'report.metrics.missing',
              '세션의 상세 원본 데이터가 없어 결과 페이지 메트릭을 불러올 수 없습니다.',
            )}
          </div>
        )}
      </div>
    );

    const renderMarkdownWithMetrics = () => {
      const markdownHtml = renderMarkdown(report.content);
      const anchors = ['<h2>종합 평가</h2>', '<h2>Overall Evaluation</h2>'];
      const anchor = anchors.find(a => markdownHtml.includes(a));

      if (!anchor) {
        return (
          <div className="report-markdown">
            <div dangerouslySetInnerHTML={{ __html: markdownHtml }} />
            {metricsBlock}
          </div>
        );
      }

      const insertIndex = markdownHtml.indexOf(anchor) + anchor.length;
      const before = markdownHtml.slice(0, insertIndex);
      const after = markdownHtml.slice(insertIndex);

      return (
        <div className="report-markdown">
          <div dangerouslySetInnerHTML={{ __html: before }} />
          {metricsBlock}
          <div dangerouslySetInnerHTML={{ __html: after }} />
        </div>
      );
    };

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

        {renderMarkdownWithMetrics()}

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
              <span
                className="data-percentile"
                style={{ color: percentileTextColor(report.metrics.reactionTimePercentile) }}
              >
                (상위 {report.metrics.reactionTimePercentile}%)
              </span>
            </div>
            {report.metrics.gazeReactionTime != null && (
              <div className="data-item">
                <span className="data-label">{t('report.data.gazeReaction', '시선 반응')}</span>
                <span className="data-value">{report.metrics.gazeReactionTime.toFixed(0)}ms</span>
                {report.metrics.gazeReactionTimePercentile != null && (
                  <span
                    className="data-percentile"
                    style={{ color: percentileTextColor(report.metrics.gazeReactionTimePercentile) }}
                  >
                    (상위 {report.metrics.gazeReactionTimePercentile}%)
                  </span>
                )}
              </div>
            )}
            {report.metrics.gazeAimLatency != null && (
              <div className="data-item">
                <span className="data-label">{t('report.data.gazeAimLatency', '시선-마우스 지연')}</span>
                <span className="data-value">{report.metrics.gazeAimLatency.toFixed(0)}ms</span>
                {report.metrics.gazeAimLatencyPercentile != null && (
                  <span
                    className="data-percentile"
                    style={{ color: percentileTextColor(report.metrics.gazeAimLatencyPercentile) }}
                  >
                    (상위 {report.metrics.gazeAimLatencyPercentile}%)
                  </span>
                )}
              </div>
            )}
            <div className="data-item">
              <span className="data-label">{t('report.data.overlap', '시선-에임 일치도')}</span>
              <span className="data-value">{report.metrics.overlapScore.toFixed(1)}%</span>
              <span
                className="data-percentile"
                style={{ color: percentileTextColor(report.metrics.overlapScorePercentile) }}
              >
                (상위 {report.metrics.overlapScorePercentile}%)
              </span>
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
