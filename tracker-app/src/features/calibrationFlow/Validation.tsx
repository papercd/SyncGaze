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
    awaitingValidationConfirmation,
    confirmNextValidationPoint,
  } = useGazeTracker();

  const totalPoints = validationTargets.length || 0;
  const completedCount = validationRecords.length;
  const isComplete = totalPoints > 0 && validationIndex >= totalPoints;
  const activeStep = totalPoints > 0 ? Math.min(validationIndex + 1, totalPoints) : 0;
  const progress = totalPoints > 0 ? Math.min((completedCount / totalPoints) * 100, 100) : 0;
  const needsRecalibration = validationError !== null && validationError > RECALIBRATION_THRESHOLD;
  const canProceed = validationError !== null && !needsRecalibration && isComplete;

  const lastCompleted = validationRecords[validationRecords.length - 1];
  const nextTarget = validationTargets[validationIndex];
  const previewTarget = !isComplete ? nextTarget || currentValidationTarget : null;
  const panelClass = `validation-panel${!isComplete && !awaitingValidationConfirmation ? ' recording' : ''}`;

  return (
    <div className="validation-container">
      <div className="validation-grid-overlay">
        {previewTarget && !isComplete && (
          <div
            className={`validation-dot ${awaitingValidationConfirmation ? 'preview' : 'active'}`}
            style={{ left: `${previewTarget.x}px`, top: `${previewTarget.y}px` }}
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

      <div className={panelClass}>
        {!isComplete ? (
          <>
            <h3>정확도 검증 진행 중</h3>
            <p>
              화면에 표시되는 9개 점을 차례대로 {validationDurationMs / 1000}초 동안 응시하세요. 각 점은 시작 전 위치 안내와
              확인 단계를 거친 뒤 {validationDurationMs / 1000}초 동안 기록됩니다.
            </p>
            <div className="progress-bar-container thin">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <p className="validation-message">
              현재 {activeStep}/{totalPoints || 9} 지점 측정 중
            </p>
            <div className="validation-status">
              {awaitingValidationConfirmation ? (
                <>
                  <p className="validation-hint">
                    다음 지점 #{activeStep} 위치 ({nextTarget?.x ?? '-'}px, {nextTarget?.y ?? '-' }px) 근처를 응시할 준비를
                    해주세요.
                  </p>
                  <button className="primary-button" onClick={confirmNextValidationPoint}>
                    #{activeStep} 측정 시작
                  </button>
                </>
              ) : (
                <p className="validation-hint">
                  #{activeStep} 지점 기록 중... 표시된 점을 {validationDurationMs / 1000}초 동안 응시해주세요.
                </p>
              )}
              {lastCompleted && lastCompleted.meanError !== null && (
                <p className="validation-hint muted">
                  이전 지점 오차: 평균 {lastCompleted.meanError.toFixed(2)}px · 표준편차{' '}
                  {lastCompleted.stdDev !== null ? lastCompleted.stdDev.toFixed(2) : 'N/A'}px
                </p>
              )}
            </div>
            <div className="validation-card-grid">
              {validationTargets.map((target, idx) => {
                const record = validationRecords[idx];
                const status = record
                  ? 'complete'
                  : idx === validationIndex && !isComplete
                  ? awaitingValidationConfirmation
                    ? 'ready'
                    : 'recording'
                  : 'pending';
                return (
                  <div key={`${target.x}-${target.y}-${idx}`} className={`validation-mini-card ${status}`}>
                    <div className="mini-card-title">#{idx + 1}</div>
                    <div className="mini-card-pos">{target.x}px, {target.y}px</div>
                    {record ? (
                      <div className="mini-card-metrics">
                        <span>오차 {record.meanError?.toFixed(1) ?? 'N/A'}px</span>
                        <span>표준편차 {record.stdDev?.toFixed(1) ?? 'N/A'}px</span>
                        <span>샘플 {record.sampleCount}</span>
                      </div>
                    ) : (
                      <div className="mini-card-metrics placeholder">
                        {status === 'ready' && '위치 확인 후 시작'}
                        {status === 'recording' && '기록 중'}
                        {status === 'pending' && '대기 중'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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