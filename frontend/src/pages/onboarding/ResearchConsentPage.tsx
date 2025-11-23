import { ChangeEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ResearchConsentPage.css';
import { useAuth } from '../../state/authContext';
import { saveSurveyAndConsent, useTrackingSession } from '../../state/trackingSessionContext';

const ResearchConsentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { consentAccepted, setConsentAccepted } = useTrackingSession();
  const [agreements, setAgreements] = useState({
    webcam: consentAccepted,
    video: consentAccepted,
    data: consentAccepted,
    privacy: consentAccepted,
  });
  const [error, setError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (field: keyof typeof agreements) => (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setAgreements(prev => ({
      ...prev,
      [field]: event.target.checked,
    }));
  };

  const handleProceed = async () => {
    const allChecked = Object.values(agreements).every(Boolean);
    if (!allChecked) {
      setError('모든 항목에 명시적으로 동의해야 다음 단계로 이동할 수 있습니다.');
      return;
    }

    if (!user) {
      setPersistError('로그인 정보를 확인할 수 없습니다. 다시 로그인한 뒤 진행해주세요.');
      return;
    }

    const consentTimestamp = new Date().toISOString();
    setIsSaving(true);
    setError(null);
    setPersistError(null);

    try {
      await saveSurveyAndConsent({ uid: user.uid, consentTimestamp });

      try {
        sessionStorage.setItem('consentTimestamp', consentTimestamp);
      } catch (storageError) {
        console.warn('Failed to persist consent timestamp:', storageError);
      }

      setConsentAccepted(true);
      navigate('/calibration');
    } catch (consentError) {
      console.error('Failed to save consent to Firestore', consentError);
      setPersistError('동의 내용을 저장하지 못했습니다. 네트워크 상태를 확인 후 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
  <div className="research-consent-page">
    <div className="research-consent-card">
      <p className="eyebrow">Research Briefing</p>
      <h1>연구 참여 및 동의</h1>
      <p className="lead">
        본 연구는 <b>FPS 게이머의 시선(gaze)과 마우스(mouse) 움직임의 상관관계</b>를 분석하기 위해 진행됩니다.<br/>
        귀하의 플레이 데이터는 차세대 게임 인터페이스 개발에 큰 도움이 됩니다.
        <br/>SyncGaze는 게이머의 에이밍 실력을 향상시키는 모델을 개발하는 것을 목표로 합니다.
      </p>

      <section className="research-overview">
        <h2>진행 순서 (약 5분 소요)</h2>
        <ul>
          <li>
            <b>STEP 1. 세팅:</b> 기본 설문 및 시선 추적 보정 (Calibration)
          </li>
          <li>
            <b>STEP 2. 플레이:</b> 화면에 나타나는 표적을 맞추는 미니 게임 진행
          </li>
        </ul>
      </section>

      <section className="privacy-callout">
        <h3>🔒 프라이버시 및 데이터 보호</h3>
        <p>
            <br/>
            <b>1. 웹캠 영상 비저장:</b> 본 연구는 WebGazer.js 기술을 사용하여 브라우저 내에서만 작동합니다. 
            <b>귀하의 웹캠 영상은 서버로 전송되거나 저장되지 않으며, 오직 시선 좌표(x,y) 데이터만 추출하여 연구 목적으로 기록됩니다.</b>
          </p>
          <p style={{ marginTop: '10px' }}>
            <b>2. 데이터 보안:</b> 모든 로그인 정보와 수집된 연구 데이터(설문조사, 시선 좌표, 게임 로그)는 <b>Google Firebase</b> 플랫폼을 통해 
            익명화된 상태로 안전하게 저장되며, 연구 목적 외에는 사용되지 않습니다.
        </p>
      </section>

      <section className="consent-checklist">
        <h2>동의 항목</h2>
        <br/>
        <label className="checkbox-label">
          <input type="checkbox" checked={agreements.webcam} onChange={handleToggle('webcam')} />
          <span>
            <b>[웹캠 접근]</b> 시선 추적을 위해 브라우저의 카메라 접근을 허용합니다.
          </span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={agreements.video} onChange={handleToggle('video')} />
          <span>
            <b>[영상 보안]</b> 내 얼굴 영상이 서버에 저장되지 않고 내 컴퓨터에서만 처리됨을 이해했습니다.
          </span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={agreements.data} onChange={handleToggle('data')} />
          <span>
            <b>[데이터 활용]</b> 익명화된 시선 좌표, 마우스 입력, 게임 로그가 연구 분석에 사용되는 것에 동의합니다.
          </span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={agreements.privacy} onChange={handleToggle('privacy')} />
          <span>
            <b>[참여 권리]</b> 언제든지 참여를 중단하거나 동의를 철회할 수 있음을 확인했습니다.
          </span>
        </label>
      </section>

        {(error || persistError) && (
          <div className="error-banner" role="alert">
            <div>{error ?? persistError}</div>
            {persistError && (
              <button
                className="secondary-button"
                type="button"
                onClick={handleProceed}
                disabled={isSaving}
              >
                {isSaving ? '동의 재저장 중...' : '동의 정보 다시 저장하기'}
              </button>
            )}
          </div>
        )}

        <div className="consent-actions">
          <button className="primary-button" type="button" onClick={handleProceed} disabled={isSaving}>
            {isSaving ? '동의 내용 저장 중...' : '연구에 동의하고 캘리브레이션으로 이동'}
          </button>
          <button className="secondary-button" type="button" onClick={() => navigate('/onboarding/survey')}>
            설문 수정하기
          </button>
        </div>

        {/* 연구자 연락처 추가 */}
      <div className="researcher-contact" style={{marginTop: '25px', fontSize: '1rem', color: '#ffffffff', textAlign: 'center'}}>
        <p>연구 관련 문의: syncgaze25@gmail.com</p>

        {/* 깃허브 링크 */}
        <p style={{ marginTop: '10px', fontSize: '1rem', opacity: 0.8 }}>
          본 프로젝트는 오픈소스로 공개되어 있습니다.<br/>
          <a 
            href="https://github.com/papercd/syncgaze" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#4facfe84', textDecoration: 'underline', cursor: 'pointer' }}
          >
            GitHub Repository 방문하기 🔗
          </a>
        </p>
      </div>

      </div>
    </div>
  );
};

export default ResearchConsentPage;