import { RECALIBRATION_THRESHOLD } from './constants';
import { useGazeTracker } from './GazeTrackerContext';
import './CalibrationFlow.css';

const Validation = () => {
  const {
    validationError,
    gazeStability,
    handleRecalibrate,
    goToResults,
    validationTargets,
    currentValidationTarget,
    validationIndex,
    validationRecords,
    validationDurationMs,
  } = useGazeTracker();

  const totalPoints = validationTargets.length || 0;
  const isComplete = totalPoints > 0 && validationIndex >= totalPoints;
  const activeStep = totalPoints > 0 ? Math.min(validationIndex + 1, totalPoints) : 0;
  const progress = totalPoints > 0 ? Math.min((validationIndex / totalPoints) * 100, 100) : 0;
  const needsRecalibration = validationError !== null && validationError > RECALIBRATION_THRESHOLD;
  const canProceed = validationError !== null && !needsRecalibration && isComplete;

  const lastCompleted = validationRecords[validationRecords.length - 1];

  return (
    <div className="validation-container">
      <div className="validation-grid-overlay">
        {currentValidationTarget && !isComplete && (
          <div
            className="validation-dot"
            style={{ left: `${currentValidationTarget.x}px`, top: `${currentValidationTarget.y}px` }}
          />
        )}
        {validationTargets.map((target, idx) => (
          <div
            key={`${target.x}-${target.y}-${idx}`}
            className={`validation-marker ${idx < validationIndex ? 'complete' : ''}`}
            style={{ left: `${target.x}px`, top: `${target.y}px` }}
          >
            <span>{idx + 1}</span>
          </div>
        ))}
      </div>

      <div className="validation-panel">
        {!isComplete ? (
          <>
            <h3>정확도 검증 진행 중</h3>
            <p>
              화면에 표시되는 9개 점을 차례대로 {validationDurationMs / 1000}초 동안 응시하세요. 각 점은 한 번에 하나씩
              나타납니다.
            </p>
            <div className="progress-bar-container thin">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <p className="validation-message">
              현재 {activeStep}/{totalPoints || 9} 지점 측정 중
            </p>
            {lastCompleted && lastCompleted.meanError !== null && (
              <p className="validation-hint">
                이전 지점 오차: 평균 {lastCompleted.meanError.toFixed(2)}px · 표준편차{' '}
                {lastCompleted.stdDev !== null ? lastCompleted.stdDev.toFixed(2) : 'N/A'}px
              </p>
            )}
          </>
        ) : (
          <div className="result-container validation-message">
            <h3>9개 지점 검증 완료</h3>
            <p>
              측정된 평균 오차: <strong>{validationError !== null ? `${validationError.toFixed(2)} 픽셀` : 'N/A'}</strong>
            </p>
            {gazeStability !== null && (
              <p>
                시선 안정성 (Avg. StdDev): <strong>{gazeStability.toFixed(2)} 픽셀</strong>
              </p>
            )}
            {needsRecalibration ? (
              <p style={{ color: 'red', fontWeight: 'bold' }}>
                오차가 크게 측정되었습니다. 정확한 측정을 위해 재보정을 진행해 주세요.
              </p>
            ) : (
              <p style={{ color: 'green', fontWeight: 'bold' }}>
                목표 정확도 기준을 충족했습니다. 결과 화면에서 세부 분포를 확인하세요.
              </p>
            )}
            <div className="controls">
              <button onClick={handleRecalibrate}>재보정</button>
              {canProceed && (
                <button className="primary-button" onClick={goToResults}>
                  결과 보기
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Validation;