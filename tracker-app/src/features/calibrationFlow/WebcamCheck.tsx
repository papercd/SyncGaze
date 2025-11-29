import { useGazeTracker } from './GazeTrackerContext';
import './CalibrationFlow.css';

const WebcamCheck = () => {
  const { quality, setQuality, isGazeDetected, handleCalibrationStart } = useGazeTracker();

  return (
    <div className="webcam-check-panel">
      <div className="webcam-check-header">
        <p className="eyebrow">Pre-calibration checklist</p>
        <h2>웹캠 상태 및 추적 품질 설정</h2>
        <p>
          화면 좌측 상단에 표시되는 카메라 영상을 확인하고, 얼굴 특징점이 안정적으로 감지될 때까지 조명을 조정해 주세요.
        </p>
      </div>

      <section className="webcam-guidelines">
        <h3>환경 설정 가이드</h3>
        <ul>
          <li>정면을 바라보고, 모니터와 눈의 거리를 50~70cm 정도로 유지합니다.</li>
          <li>얼굴 전체가 보이도록 주변 조명을 밝히고, 역광이나 강한 그림자를 피합니다.</li>
          <li>웹캠 프리뷰에 초록색 박스와 얼굴 특징점이 표시되면 인식이 완료된 것입니다.</li>
        </ul>
      </section>

      <section className="quality-selector">
        <h3>시선 추적 품질</h3>
        <div className="quality-options">
          <button
            type="button"
            className={quality === 'low' ? 'active' : ''}
            onClick={() => setQuality('low')}
          >
            낮음
            <span>저사양 PC · 640×480 · 30fps</span>
          </button>
          <button
            type="button"
            className={quality === 'medium' ? 'active' : ''}
            onClick={() => setQuality('medium')}
          >
            중간
            <span>권장 설정 · 1280×720 · 60fps</span>
          </button>
          <button
            type="button"
            className={quality === 'high' ? 'active' : ''}
            onClick={() => setQuality('high')}
          >
            높음
            <span>기본값 · 1920×1080 · 60fps</span>
          </button>
        </div>
      </section>

      <div className={`detection-status ${isGazeDetected ? 'success' : 'pending'}`}>
        {isGazeDetected
          ? '얼굴이 안정적으로 인식되었습니다. 캘리브레이션을 진행하세요.'
          : '얼굴을 인식하는 중입니다... 조명과 자세를 조정해 주세요.'}
      </div>

      <div className="confirm-row">
        <button className="primary-button" type="button" onClick={handleCalibrationStart} disabled={!isGazeDetected}>
          인식 완료, 캘리브레이션 시작
        </button>
      </div>
    </div>
  );
};

export default WebcamCheck;