// frontend/src/pages/TrainingPage.tsx
// CORRECTED: Only stops WebGazer when explicitly navigating to Dashboard
// ResultsPage handles stopping WebGazer, so we don't interfere with the normal flow

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrainingScene } from '../components/TrainingScene';
import { TrackingDataRecord } from '../hooks/useTrackingData';
import './TrainingPage.css';
import { Timer, Crosshair, BarChart3 } from 'lucide-react';
import {
  TrainingDataPoint,
  TrainingSessionSummary,
  useTrackingSession,
} from '../state/trackingSessionContext';
import { useAuth } from '../state/authContext';
import { useWebgazer } from '../hooks/tracking/useWebgazer';
import { serializeSessionToCsv } from '../utils/sessionExport';
import { calculatePerformanceAnalytics } from '../utils/analytics';
import { useTranslation } from '../state/languageContext';
import { useControlSettings } from '../state/controlSettingsContext';

const TrainingPage = () => {
  const navigate = useNavigate();
  const {
    addSession,
    setActiveSessionId,
    calibrationResult,
    surveyResponses,
    consentAccepted,
    activeSessionId,
    recentSessions,
  } = useTrackingSession();
  
  const { user } = useAuth();
  const { stopSession, isTrackingActive } = useWebgazer();
  const { t } = useTranslation();
  const { controlSensitivity } = useControlSettings();

  const [timeRemaining, setTimeRemaining] = useState(60);
  const [isTraining, setIsTraining] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [scoreComparisonText, setScoreComparisonText] = useState<string | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [trackingWarning, setTrackingWarning] = useState<string | null>(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const trainingStartTime = useRef<number>(0);

  // ❌ REMOVED: No automatic cleanup on unmount
  // This was causing WebGazer to stop when transitioning from CalibrationPage
  // WebGazer should stay running during: CalibrationPage → TrainingPage → ResultsPage
  // Only stop when explicitly navigating to Dashboard

  // Stop WebGazer if the user leaves the training/results flow unexpectedly
  useEffect(() => {
    const handlePageHide = () => {
      stopSession();
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);

      const nextPath = window.location.pathname;
      const staysInGazeFlow = nextPath.startsWith('/training') || nextPath.startsWith('/results');

      if (!staysInGazeFlow) {
        console.log('🛑 TrainingPage unmounted - stopping WebGazer for route change:', nextPath);
        stopSession();
      }
    };
  }, [stopSession]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowExitPrompt(true);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [navigate, stopSession]);

  const handleStartTraining = useCallback(() => {
    trainingStartTime.current = Date.now();
    setIsTraining(true);
    setIsComplete(false);
    setTrackingWarning(null);
    setSessionSaved(false);
    setScoreComparisonText(null);
  }, []);

  const hasLiveCameraFeed = useCallback(() => {
    if (typeof document === 'undefined') return false;
    const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
    const stream = videoEl?.srcObject as MediaStream | null;
    if (!stream) return false;
    return stream.getVideoTracks().some(track => track.readyState === 'live' && track.enabled);
  }, []);

  const isWebgazerOperational = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (!window.webgazer) return false;
    try {
      if (typeof window.webgazer.isReady === 'function') {
        return Boolean(window.webgazer.isReady());
      }
      if (typeof window.webgazer.getVideoElementCanvas === 'function') {
        const canvas = window.webgazer.getVideoElementCanvas();
        return Boolean(canvas && canvas.width > 0);
      }
    } catch (error) {
      console.warn('Failed to check WebGazer readiness', error);
      return false;
    }
    return false;
  }, []);

  // Convert TrackingDataRecord to TrainingDataPoint format
  const convertTrainingData = (rawData: TrackingDataRecord[]): TrainingDataPoint[] => {
    return rawData.map(record => ({
      timestamp: record.timestamp,
      gazeX: record.gazeX,
      gazeY: record.gazeY,
      mouseX: record.mouseX,
      mouseY: record.mouseY,
      targetHit: record.hitRegistered,
      targetId: record.targetId,
      targetX: record.targetX,
      targetY: record.targetY,
    }));
  };

  const handleTrainingComplete = useCallback((
    score: number,
    targetsHit: number,
    rawTrackingData: TrackingDataRecord[],
    trackingMeta: { gazeSamples: number }
  ) => {
    setIsComplete(true);
    setIsTraining(false);
    setFinalScore(score);
    setSessionSaved(false);

    const gazeSamplesFromMeta = trackingMeta?.gazeSamples ?? 0;
    const gazeSamplesFromData = rawTrackingData.filter(
      point => !point.hitRegistered && point.gazeX !== null && point.gazeY !== null,
    ).length;
    const totalGazeSamples = Math.max(gazeSamplesFromMeta, gazeSamplesFromData);
    const hasGazeSamples = totalGazeSamples > 0;
    const webgazerHealthy = isWebgazerOperational();
    const cameraHealthy = hasLiveCameraFeed();

    if (!hasGazeSamples) {
      setTrackingWarning(
        t(
          'training.warning.trackingMissing',
          '시야 데이터 수집에 문제가 있어 이번 세션 기록은 저장되지 않았습니다. 캘리브레이션과 웹캠 상태를 확인한 뒤 다시 시도해주세요.',
        ),
      );
      setScoreComparisonText(null);
      return;
    }

    if (!isTrackingActive || !webgazerHealthy || !cameraHealthy) {
      console.warn('⚠️ Gaze samples captured but tracker health check failed, saving anyway', {
        isTrackingActive,
        webgazerHealthy,
        cameraHealthy,
        gazeSamplesFromMeta,
        gazeSamplesFromData,
      });
    }

    setTrackingWarning(null);
    setSessionSaved(true);
    const previousScores = recentSessions.map(session => session.score);
    const previousBest = previousScores.length ? Math.max(...previousScores) : null;
    const lastScore = recentSessions[0]?.score ?? null;
    let comparisonMessage: string | null = null;

    if (!previousScores.length) {
      comparisonMessage = t(
        'training.complete.firstRun',
        '첫 기록이에요! 다음 판에서 더 올려보세요.',
      );
    } else if (previousBest !== null && score > previousBest) {
      const diff = score - previousBest;
      comparisonMessage = t(
        'training.complete.personalBest',
        '신기록 달성! (+{diff}점)',
      ).replace('{diff}', String(diff));
    } else if (lastScore !== null && score > lastScore) {
      const diff = score - lastScore;
      comparisonMessage = t(
        'training.complete.improvedFromLast',
        '지난번보다 +{diff}점 상승',
      ).replace('{diff}', String(diff));
    } else if (lastScore !== null && score === lastScore) {
      comparisonMessage = t(
        'training.complete.tiedLast',
        '지난번과 같은 점수예요. 조금만 더 집중해볼까요?',
      );
    } else {
      comparisonMessage = t(
        'training.complete.keepTrying',
        '아주 근접했어요! 다음엔 신기록을 노려보세요.',
      );
    }

    setScoreComparisonText(comparisonMessage);

    console.log('📊 Processing training session:', {
      score,
      targetsHit,
      rawDataPoints: rawTrackingData.length,
      gazeSamples: totalGazeSamples,
    });

    // Convert the raw tracking data to the format expected by the session system
    const convertedData = convertTrainingData(rawTrackingData);

    // Calculate metrics from the collected data
    const metrics = convertedData.length > 0
      ? calculatePerformanceAnalytics(convertedData)
      : {
          accuracy: 0,
          avgReactionTime: 0,
          gazeAccuracy: 0,
          mouseAccuracy: 0,
          totalTargets: 0,
          targetsHit: 0,
        };
    
    // Create the session record with actual data
    const sessionRecord: TrainingSessionSummary = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      duration: 60,
      score: score,
      accuracy: metrics.accuracy,
      targetsHit: metrics.targetsHit || score,
      totalTargets: metrics.totalTargets || metrics.targetsHit || score,
      avgReactionTime: metrics.avgReactionTime,
      gazeAccuracy: metrics.gazeAccuracy,
      mouseAccuracy: metrics.mouseAccuracy,
      controlSensitivity,
      screenSize: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      rawData: convertedData, // Now includes actual collected data (may be empty if collection failed)
      csvData: '', // Will be set below
    };

    // Generate CSV with all the data
    const csvData = serializeSessionToCsv({
      session: sessionRecord,
      surveyResponses,
      consentAccepted,
      calibrationResult,
      screenSize: sessionRecord.screenSize,
      participantLabel: user?.email ?? user?.displayName ?? user?.uid,
    });

    // Update session record with CSV
    const finalSession = {
      ...sessionRecord,
      csvData,
    };

    // Save to context
    addSession(finalSession);
    setActiveSessionId(finalSession.id);
    
    console.log('✅ Training session saved:', {
      id: finalSession.id,
      score,
      targetsHit,
      dataPoints: convertedData.length,
      accuracy: metrics.accuracy.toFixed(2) + '%',
    });
  }, [
    addSession,
    setActiveSessionId,
    calibrationResult,
    surveyResponses,
    consentAccepted,
    user,
    controlSensitivity,
    recentSessions,
    isTrackingActive,
    isWebgazerOperational,
    hasLiveCameraFeed,
    t,
  ]);

  const handleViewResults = useCallback(() => {
    if (!sessionSaved) {
      setTrackingWarning(prev => prev ?? t(
        'training.warning.trackingMissing',
        '시야 데이터 수집에 문제가 있어 이번 세션 기록은 저장되지 않았습니다. 캘리브레이션과 웹캠 상태를 확인한 뒤 다시 시도해주세요.',
      ));
      return;
    }
    // ✅ Don't stop WebGazer here - ResultsPage will handle it on mount
    navigate('/results', {
      state: {
        fromTrainingComplete: true,
        sessionId: activeSessionId ?? null,
      },
    });
  }, [navigate, activeSessionId, sessionSaved, t]);

  const handleBackToDashboard = useCallback(() => {
    // ✅ Only stop WebGazer when navigating to Dashboard
    // (Dashboard doesn't use WebGazer, so we need to clean it up)
    console.log('🏠 Navigating to Dashboard - stopping WebGazer');
    stopSession();
    navigate('/dashboard');
  }, [stopSession, navigate]);

  const renderExitPrompt = () => {
    if (!showExitPrompt) return null;

    return (
      <div className="exit-overlay" role="dialog" aria-modal="true">
        <div className="exit-modal">
          <h3>{t('session.exit.title')}</h3>
          <p>{t('session.exit.desc')}</p>
          <div className="exit-actions">
            <button className="secondary-button" onClick={() => setShowExitPrompt(false)}>
              {t('session.exit.continue')}
            </button>
            <button className="danger-button" onClick={handleBackToDashboard}>
              {t('session.exit.dashboard')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="training-page">
      {/* Training Scene - renders when training is active */}
      {isTraining && (
        <TrainingScene
          onComplete={handleTrainingComplete}
          onExitDashboard={handleBackToDashboard}
        />
      )}
      
      {/* Pre-Training Instructions */}
          {!isTraining && !isComplete && (
            <div className="training-overlay training-overlay--center">
              <div className="training-instructions">
            <h1>{t('training.overlay.title')}</h1>
            <div className="training-info">
              <div className="info-item">
                <span className="info-icon">
                  <Timer size={40} strokeWidth={2.5} />
                </span>
                <div>
                  <h3>{t('training.info.session.title')}</h3>
                  <p>{t('training.info.session.desc')}</p>
                </div>
              </div>

              <div className="info-item">
                <span className="info-icon">
                  <Crosshair size={40} strokeWidth={2.5} />
                </span>
                <div>
                  <h3>{t('training.info.gaze.title')}</h3>
                  <p>{t('training.info.gaze.desc')}</p>
                </div>
              </div>

              <div className="info-item">
                <span className="info-icon">
                  <BarChart3 size={40} strokeWidth={2.5} />
                </span>
                <div>
                  <h3>{t('training.info.performance.title')}</h3>
                  <p>{t('training.info.performance.desc')}</p>
                </div>
              </div>
            </div>

            <div className="training-controls">
              <button className="start-button" onClick={handleStartTraining}>
                {t('training.button.start')}
              </button>
              <button className="back-button-inline" onClick={handleBackToDashboard}>
                {t('training.button.back')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Training Results */}
      {isComplete && (
        <div className="training-overlay training-overlay--center">
          <div className="training-complete">
            <h1>{t('training.complete.title')}</h1>
            <div className="completion-stats">
              <div className="stat-card">
                <span className="stat-icon">
                  <Crosshair size={36} strokeWidth={2.5} />
                </span>
                <div className="stat-content">
                  <h3>{t('training.complete.score')}</h3>
                  <p className="stat-value">{finalScore}</p>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon">
                  <Timer size={36} strokeWidth={2.5} />
                </span>
                <div className="stat-content">
                  <h3>{t('training.complete.duration')}</h3>
                  <p className="stat-value">60s</p>
                </div>
              </div>
            </div>
            {scoreComparisonText && (
              <div className="score-callout" role="status">
                <p>{scoreComparisonText}</p>
              </div>
            )}
            {trackingWarning && (
              <div className="tracking-warning" role="alert">
                <p>{trackingWarning}</p>
              </div>
            )}

            <div className="training-controls">
              <button
                className="view-results-button"
                onClick={handleViewResults}
                disabled={!sessionSaved}
                aria-disabled={!sessionSaved}
              >
                {t('training.button.viewResults')}
              </button>
              <button className="start-button" onClick={handleStartTraining}>
                {t('training.button.trainAgain')}
              </button>
            </div>
          </div>
        </div>
      )}
      {renderExitPrompt()}
    </div>
  );
};

export default TrainingPage;
