// src/pages/CalibrationPage.tsx
import { useEffect, useRef, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import './CalibrationPage.css';
import { useTrackingSession } from '../state/trackingSessionContext';
import {
  Calibration,
  CalibrationProps,
  Validation,
  WebcamCheck,
  RECALIBRATION_THRESHOLD,
} from '../features/tracker/calibration';
import { useWebgazer } from '../hooks/tracking/useWebgazer';
import { useTranslation } from '../state/languageContext';

const CalibrationPage = () => {
  const navigate = useNavigate();
  const { saveCalibrationResult } = useTrackingSession();
  const { t } = useTranslation();
  const {
    isReady,
    gameState,
    liveGaze,
    validationError,
    gazeStability,
    isValidationSuccessful,
    validationSequence,
    startSession,
    stopSession,
    handleCalibrationComplete,
    quality,
    setQuality,
    isFaceDetected,
    handleWebcamCheckComplete,
    startValidation,
    handleRecalibrate,
    handleCalStage3Complete,
  } = useWebgazer();
  const lastSequenceRef = useRef(validationSequence);
  const isNavigatingToTraining = useRef(false);

   useEffect(() => {
     return () => {
       if (!isNavigatingToTraining.current) {
         stopSession(); // Only stop if NOT going to training
       }
     };
   }, [stopSession]);



  useEffect(() => {
    if (
      isValidationSuccessful &&
      validationSequence > lastSequenceRef.current &&
      validationError !== null &&
      validationError <= RECALIBRATION_THRESHOLD
    ) {
      lastSequenceRef.current = validationSequence;
      saveCalibrationResult({
        status: 'validated',
        validationError,
        validationStdDev: gazeStability,
        completedAt: new Date().toISOString(),
      });
    }
  }, [
    isValidationSuccessful,
    validationSequence,
    validationError,
    gazeStability,
    saveCalibrationResult,
  ]);

  const handleProceedToTraining = () => {
     isNavigatingToTraining.current = true; // Set flag
     window.webgazer?.showPredictionPoints(false);
     navigate('/training');
   };

  const CalibrationComponent = Calibration as FC<CalibrationProps>;

  const renderContent = () => {
    if (!isReady) {
      return (
        <div className="calibration-screen">
          <div className="loading-container">
            <div className="spinner" />
            <h2>{t('calibration.loader.title')}</h2>
            <p>{t('calibration.loader.desc')}</p>
          </div>
        </div>
      );
    }

    switch (gameState) {
      case 'idle':
        return (
          <div className="calibration-screen">
            <div className="instructions-container">
              <p className="eyebrow">{t('calibration.prep.eyebrow')}</p>
              <h1>{t('calibration.prep.title')}</h1>
              <div className="instructions-content">
                <div className="instruction-item">
                  <span className="instruction-icon">📷</span>
                  <div>
                    <h3>{t('calibration.prep.camera.title')}</h3>
                    <p>{t('calibration.prep.camera.desc')}</p>
                  </div>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">👁️</span>
                  <div>
                    <h3>{t('calibration.prep.points.title')}</h3>
                    <p>{t('calibration.prep.points.desc')}</p>
                  </div>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">💡</span>
                  <div>
                    <h3>{t('calibration.prep.light.title')}</h3>
                    <p>{t('calibration.prep.light.desc')}</p>
                  </div>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">🎯</span>
                  <div>
                    <h3>{t('calibration.prep.posture.title')}</h3>
                    <p>{t('calibration.prep.posture.desc')}</p>
                  </div>
                </div>
              </div>
              <div className="environment-callout">
                <h3>{t('calibration.checklist.title')}</h3>
                <ul>
                  <li>{t('calibration.checklist.item1')}</li>
                  <li>{t('calibration.checklist.item2')}</li>
                  <li>{t('calibration.checklist.item3')}</li>
                </ul>
              </div>
              <div className="button-group">
                <button className="primary-button" onClick={startSession} disabled={!isReady}>
                  {t('calibration.action.start')}
                </button>
              </div>
            </div>
          </div>
        );
      case 'webcamCheck':
        return (
          <div className="calibration-screen">
            <WebcamCheck
              quality={quality}
              onQualityChange={setQuality}
              isFaceDetected={isFaceDetected}
              onConfirm={handleWebcamCheckComplete}
            />
          </div>
        );
      case 'calibrating':
        return (
          <div className="calibration-screen">
            <div className="calibrating-container">
              <h2>{t('calibration.progress.title')}</h2>
              <CalibrationComponent
                onComplete={handleCalibrationComplete}
                liveGaze={liveGaze}
                onCalStage3Complete={handleCalStage3Complete}
              />
            </div>
          </div>
        );
      case 'confirmValidation':
        return (
          <div className="calibration-screen">
            <div className="confirmation-box">
              <h2>{t('calibration.confirm.title')}</h2>
              <p>{t('calibration.confirm.desc')}</p>
              <button className="primary-button" onClick={startValidation}>
                {t('calibration.confirm.action')}
              </button>
            </div>
          </div>
        );
      case 'validating':
        return (
          <div className="calibration-screen validation-active">
            <Validation
              validationError={validationError}
              gazeStability={gazeStability}
              onRecalibrate={handleRecalibrate}
            />
          </div>
        );
      case 'validationResult':
        return (
          <div className="calibration-screen validation-active">
            <Validation
              validationError={validationError}
              gazeStability={gazeStability}
              onRecalibrate={handleRecalibrate}
              canProceed={isValidationSuccessful}
              onProceed={handleProceedToTraining}  
              
            />
          </div>
        );
      default:
        return null;
    }
  };

  return <div className="calibration-page">{renderContent()}</div>;
};

export default CalibrationPage;