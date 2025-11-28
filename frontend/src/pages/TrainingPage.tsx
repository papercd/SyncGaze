// frontend/src/pages/TrainingPage.tsx
// CORRECTED: Only stops WebGazer when explicitly navigating to Dashboard
// ResultsPage handles stopping WebGazer, so we don't interfere with the normal flow

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrainingScene } from '../components/TrainingScene';
import { TrackingDataRecord } from '../hooks/useTrackingData';
import './TrainingPage.css';
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

const TrainingPage = () => {
  const navigate = useNavigate();
  const {
    addSession,
    setActiveSessionId,
    calibrationResult,
    surveyResponses,
    consentAccepted,
    activeSessionId,
  } = useTrackingSession();
  
  const { user } = useAuth();
  const { stopSession } = useWebgazer();
  const { t } = useTranslation();
  
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [isTraining, setIsTraining] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const trainingStartTime = useRef<number>(0);

  // ❌ REMOVED: No automatic cleanup on unmount
  // This was causing WebGazer to stop when transitioning from CalibrationPage
  // WebGazer should stay running during: CalibrationPage → TrainingPage → ResultsPage
  // Only stop when explicitly navigating to Dashboard

  const handleStartTraining = useCallback(() => {
    trainingStartTime.current = Date.now();
    setIsTraining(true);
    setIsComplete(false);
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
    rawTrackingData: TrackingDataRecord[]
  ) => {
    setIsComplete(true);
    setIsTraining(false);
    setFinalScore(score);

    console.log('📊 Processing training session:', {
      score,
      targetsHit,
      rawDataPoints: rawTrackingData.length,
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
  }, [addSession, setActiveSessionId, calibrationResult, surveyResponses, consentAccepted, user]);

  const handleViewResults = useCallback(() => {
    // ✅ Don't stop WebGazer here - ResultsPage will handle it on mount
    navigate('/results', {
      state: {
        fromTrainingComplete: true,
        sessionId: activeSessionId ?? null,
      },
    });
  }, [navigate, activeSessionId]);

  const handleBackToDashboard = useCallback(() => {
    // ✅ Only stop WebGazer when navigating to Dashboard
    // (Dashboard doesn't use WebGazer, so we need to clean it up)
    console.log('🏠 Navigating to Dashboard - stopping WebGazer');
    stopSession();
    navigate('/dashboard');
  }, [stopSession, navigate]);

  return (
    <div className="training-page">
      {/* Training Scene - renders when training is active */}
      {isTraining && (
        <TrainingScene onComplete={handleTrainingComplete} />
      )}
      
      {/* Pre-Training Instructions */}
          {!isTraining && !isComplete && (
            <div className="training-overlay">
              <div className="training-instructions">
            <h1>{t('training.overlay.title')}</h1>
            <div className="training-info">
              <div className="info-item">
                <span className="info-icon">⏱️</span>
                <div>
                  <h3>{t('training.info.session.title')}</h3>
                  <p>{t('training.info.session.desc')}</p>
                </div>
              </div>

              <div className="info-item">
                <span className="info-icon">🎯</span>
                <div>
                  <h3>{t('training.info.gaze.title')}</h3>
                  <p>{t('training.info.gaze.desc')}</p>
                </div>
              </div>

              <div className="info-item">
                <span className="info-icon">📊</span>
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
        <div className="training-overlay">
          <div className="training-complete">
            <h1>{t('training.complete.title')}</h1>
            <div className="completion-stats">
              <div className="stat-card">
                <span className="stat-icon">🎯</span>
                <div className="stat-content">
                  <h3>{t('training.complete.score')}</h3>
                  <p className="stat-value">{finalScore}</p>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon">⏱️</span>
                <div className="stat-content">
                  <h3>{t('training.complete.duration')}</h3>
                  <p className="stat-value">60s</p>
                </div>
              </div>
            </div>

            <div className="training-controls">
              <button className="view-results-button" onClick={handleViewResults}>
                {t('training.button.viewResults')}
              </button>
              <button className="start-button" onClick={handleStartTraining}>
                {t('training.button.trainAgain')}
              </button>
              <button className="back-button-inline" onClick={handleBackToDashboard}>
                {t('training.button.back')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingPage;