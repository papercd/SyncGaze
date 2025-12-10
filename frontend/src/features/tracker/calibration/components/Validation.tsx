import { RECALIBRATION_THRESHOLD } from '../constants';
import { useTranslation } from '../../../../state/languageContext';

interface ValidationProps {
  validationError: number | null;
  gazeStability: number | null;
  onRecalibrate: () => void;
  canProceed?: boolean;
  onProceed?: () => void;
}

const Validation = ({ validationError, gazeStability, onRecalibrate, canProceed, onProceed, }: ValidationProps) => {
  const { t } = useTranslation();
  const needsRecalibration = validationError !== null && validationError > RECALIBRATION_THRESHOLD;
  return (
    <div className="validation-container">
      <div className="validation-dot-wrapper">
        <div className="validation-dot" />
      </div>
      {validationError === null ? (
        <p className="validation-message">
          {t('calibration.validation.measuring', '정확도 측정 중... 화면 중앙의 파란 점을 3초간 응시하세요.')}
        </p>
      ) : (
        <div className="result-container validation-message">
          <p>
            {t('calibration.validation.averageError', '측정된 평균 오차')}: <strong>{validationError.toFixed(2)} 픽셀</strong>
          </p>
          {gazeStability !== null && (
            <p>
              {t('calibration.validation.stability', '시선 안정성 (Avg. StdDev)')}:{' '}
              <strong>{gazeStability.toFixed(2)} 픽셀</strong>
            </p>
          )}
          {needsRecalibration ? (
            <p style={{ color: 'red', fontWeight: 'bold' }}>
              {t(
                'calibration.validation.retry',
                '오차가 크게 측정되었습니다. 정확한 측정을 위해 재보정을 진행해 주세요.',
              )}
            </p>
          ) : (
            <p style={{ color: 'green', fontWeight: 'bold' }}>
              {t(
                'calibration.validation.pass',
                '목표 정확도 기준을 충족했습니다. 다음 단계로 이동할 수 있습니다.',
              )}
            </p>
          )}
          <div className="controls">
            <button onClick={onRecalibrate}>
              {t('calibration.validation.recalibrate', '재보정')}
            </button>
            {canProceed && (
              <button className="primary-button" onClick={onProceed}>
                {t('calibration.validation.proceed', '트레이닝으로 진행')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Validation;
