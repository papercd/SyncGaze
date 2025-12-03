import './SettingsPage.css';
import { useNavigate } from 'react-router-dom';
import ControlSettingsPanel from '../components/ControlSettingsPanel';
import { useTrackingSession } from '../state/trackingSessionContext';
import { findGameOption, OTHER_GAME_VALUE } from '../features/onboarding/survey';
import { useTranslation } from '../state/languageContext';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { surveyResponses } = useTrackingSession();
  const { t } = useTranslation();

  const focusGameLabel = surveyResponses
    ? surveyResponses.mainGame === OTHER_GAME_VALUE
      ? surveyResponses.mainGameOther || t('settings.survey.manualGame', '사용자 입력')
      : findGameOption(surveyResponses.mainGame)?.label ?? surveyResponses.mainGame
    : null;

  const readinessLabel = surveyResponses
    ? surveyResponses.ageCheck && surveyResponses.webcamCheck
      ? t('settings.survey.readiness.ready', '세팅 준비 완료')
      : t('settings.survey.readiness.missing', '세팅 확인 필요')
    : null;

  const practiceUsageLabel = surveyResponses
    ? surveyResponses.aimTrainerUsage === 'yes'
      ? t('settings.survey.practice.yes', '연습 도구 사용 중')
      : t('settings.survey.practice.no', '연습 도구는 사용하지 않음')
    : null;

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div className="settings-header__content">
          <div>
            <p className="settings-kicker">Customize</p>
            <h1>Training Settings</h1>
            <p className="settings-subtitle">Tune your controls to feel comfortable before jumping back in.</p>
          </div>
          <button className="settings-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </header>

      <main className="settings-main">
        <section className="settings-card">
          <div className="settings-card__header">
            <div>
              <p className="settings-kicker">Profile</p>
              <h2>{t('settings.survey.title', 'Skill snapshot')}</h2>
              <p className="settings-description">
                {t(
                  'settings.survey.desc',
                  '온보딩 설문 응답을 업데이트하면 추천 목표와 리포트가 더 정확해집니다.',
                )}
              </p>
            </div>
            <div className="settings-card__actions">
              <button className="primary-button" onClick={() => navigate('/onboarding/survey')}>
                {t('settings.survey.cta', '설문 다시 작성')}
              </button>
            </div>
          </div>

          {surveyResponses ? (
            <ul className="survey-summary">
              <li className="survey-summary__item">
                <span className="survey-summary__label">{t('settings.survey.readiness.title', '준비 상태')}</span>
                <span className="survey-summary__value">{readinessLabel ?? '-'}</span>
              </li>
              <li className="survey-summary__item">
                <span className="survey-summary__label">{t('settings.survey.focus', '집중 게임')}</span>
                <span className="survey-summary__value">{focusGameLabel ?? '-'}</span>
              </li>
              <li className="survey-summary__item">
                <span className="survey-summary__label">{t('settings.survey.rank', '현재 티어/점수')}</span>
                <span className="survey-summary__value">{surveyResponses.inGameRank || '-'}</span>
              </li>
              <li className="survey-summary__item">
                <span className="survey-summary__label">{t('settings.survey.playTime', '주간 플레이 시간')}</span>
                <span className="survey-summary__value">{surveyResponses.playTime}</span>
              </li>
              <li className="survey-summary__item">
                <span className="survey-summary__label">{t('settings.survey.practice', '연습 도구')}</span>
                <span className="survey-summary__value">{practiceUsageLabel ?? '-'}</span>
              </li>
              <li className="survey-summary__item">
                <span className="survey-summary__label">{t('settings.survey.selfAssessment', '자가 평가')}</span>
                <span className="survey-summary__value">{surveyResponses.selfAssessment}/10</span>
              </li>
              <li className="survey-summary__item">
                <span className="survey-summary__label">{t('settings.survey.goal', '시즌 목표')}</span>
                <span className="survey-summary__value">{surveyResponses.trainingGoal || '-'}</span>
              </li>
            </ul>
          ) : (
            <p className="settings-description">
              {t(
                'settings.survey.empty',
                '첫 로그인 시 작성한 설문이 여기에 표시됩니다. 설문을 작성해 맞춤 추천을 받아보세요.',
              )}
            </p>
          )}
        </section>

        <section className="settings-card">
          <div className="settings-card__header">
            <div>
              <p className="settings-kicker">Controls</p>
              <h2>Control sensitivity</h2>
              <p className="settings-description">
                Use the slider to change how responsive mouse look feels inside training. Adjust while paused or here on
                the settings page anytime.
              </p>
            </div>
          </div>
          <ControlSettingsPanel showReset />
        </section>
      </main>
    </div>
  );
};

export default SettingsPage;
