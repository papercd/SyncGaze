import { QualitySetting } from '../types';
import '../styles/webcamCheck.css';
import { useTranslation } from '../../../../state/languageContext';

type WebcamCheckProps = {
  quality: QualitySetting;
  onQualityChange: (quality: QualitySetting) => void;
  isFaceDetected: boolean;
  onConfirm: () => void;
};

const WebcamCheck = ({
  quality,
  onQualityChange,
  isFaceDetected,
  onConfirm,
}: WebcamCheckProps) => {
  const { t } = useTranslation();
  return (
    <div className="webcam-check-panel">
      <div className="webcam-check-header">
        <p className="eyebrow">{t('calibration.webcam.eyebrow', '캘리브레이션 준비')}</p>
        <h2>{t('calibration.webcam.title', '웹캠 상태 및 추적 품질 설정')}</h2>
        <p>{t('calibration.webcam.lead', '화면 좌측 상단에 표시되는 카메라 영상을 확인하고, 얼굴 특징점이 안정적으로 감지될 때까지 조명을 조정해 주세요.')}</p>
      </div>

      <section className="webcam-guidelines">
        <h3>{t('calibration.webcam.environment', '환경 설정 가이드')}</h3>
        <ul>
          <li>{t('calibration.webcam.tip.front', '정면을 바라보고, 모니터와 눈의 거리를 50~70cm 정도로 유지합니다.')}</li>
          <li>{t('calibration.webcam.tip.light', '얼굴 전체가 보이도록 주변 조명을 밝히고, 역광이나 강한 그림자를 피합니다.')}</li>
          <li>{t('calibration.webcam.tip.landmarks', '웹캠 프리뷰에 초록색 박스와 얼굴 특징점이 표시되면 인식이 완료된 것입니다.')}</li>
        </ul>
      </section>

      <section className="quality-selector">
        <h3>{t('calibration.webcam.qualityTitle', '시선 추적 품질')}</h3>
        <div className="quality-options">
          <button
            type="button"
            className={quality === 'low' ? 'active' : ''}
            onClick={() => onQualityChange('low')}
          >
            {t('calibration.webcam.quality.low', '낮음')}
            <span>{t('calibration.webcam.quality.lowDesc', '저사양 PC · 640×480 · 30fps')}</span>
          </button>
          <button
            type="button"
            className={quality === 'medium' ? 'active' : ''}
            onClick={() => onQualityChange('medium')}
          >
            {t('calibration.webcam.quality.medium', '중간')}
            <span>{t('calibration.webcam.quality.mediumDesc', '권장 설정 · 1280×720 · 60fps')}</span>
          </button>
          <button
            type="button"
            className={quality === 'high' ? 'active' : ''}
            onClick={() => onQualityChange('high')}
          >
            {t('calibration.webcam.quality.high', '높음')}
            <span>{t('calibration.webcam.quality.highDesc', '기본값 · 1920×1080 · 60fps')}</span>
          </button>
        </div>
      </section>

      <div className={`detection-status ${isFaceDetected ? 'success' : 'pending'}`}>
        {isFaceDetected
          ? t('calibration.webcam.status.ready', '얼굴이 안정적으로 인식되었습니다. 캘리브레이션을 진행하세요.')
          : t('calibration.webcam.status.pending', '얼굴을 인식하는 중입니다... 조명과 자세를 조정해 주세요.')}
      </div>

      <div className="confirm-row">
        <button className="primary-button" type="button" onClick={onConfirm} disabled={!isFaceDetected}>
          {t('calibration.webcam.confirm', '인식 완료, 캘리브레이션 시작')}
        </button>
      </div>
    </div>
  );
};

export default WebcamCheck;
