import './AccountPage.css';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/authContext';
import { useTrackingSession } from '../state/trackingSessionContext';
import { useTranslation } from '../state/languageContext';
import { findGameOption, OTHER_GAME_VALUE } from '../features/onboarding/survey';

const AccountPage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { recentSessions, surveyResponses } = useTrackingSession();
  const { t } = useTranslation();

  const stats = useMemo(() => {
    if (!recentSessions.length) {
      return {
        totalSessions: 0,
        totalDays: 0,
        lastSession: null as string | null,
      };
    }

    const dates = recentSessions
      .map(session => new Date(session.date).toDateString())
      .filter(Boolean);
    const uniqueDays = new Set(dates);

    const last = recentSessions
      .map(session => new Date(session.date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      totalSessions: recentSessions.length,
      totalDays: uniqueDays.size,
      lastSession: last ? last.toLocaleString() : null,
    };
  }, [recentSessions]);

  const handleDeleteAccount = () => {
    // Placeholder: real delete flow should be implemented with backend support.
    alert(t('account.delete.warning', '계정 삭제 기능은 관리자에게 문의하세요.'));
  };

  const focusGameLabel = useMemo(() => {
    if (!surveyResponses) return null;
    return surveyResponses.mainGame === OTHER_GAME_VALUE
      ? surveyResponses.mainGameOther || t('settings.survey.manualGame', '사용자 입력')
      : findGameOption(surveyResponses.mainGame)?.label ?? surveyResponses.mainGame;
  }, [surveyResponses, t]);

  const readinessLabel = useMemo(() => {
    if (!surveyResponses) return null;
    return surveyResponses.ageCheck && surveyResponses.webcamCheck
      ? t('settings.survey.readiness.ready', '세팅 준비 완료')
      : t('settings.survey.readiness.missing', '세팅 확인 필요');
  }, [surveyResponses, t]);

  const practiceUsageLabel = useMemo(() => {
    if (!surveyResponses) return null;
    return surveyResponses.aimTrainerUsage === 'yes'
      ? t('settings.survey.practice.yes', '연습 도구 사용 중')
      : t('settings.survey.practice.no', '연습 도구는 사용하지 않음');
  }, [surveyResponses, t]);

  return (
    <div className="account-page">
      <header className="account-header">
        <div>
          <p className="account-kicker">{t('account.kicker', 'Account')}</p>
          <h1>{t('account.title', 'Your profile')}</h1>
          <p className="account-subtitle">
            {t('account.subtitle', '개인 정보와 트레이닝 활동 요약을 확인하세요.')}
          </p>
        </div>
      </header>

      <section className="account-grid">
        <div className="account-card">
          <p className="card-label">{t('account.info.title', 'Account info')}</p>
          <p className="card-value">{user?.email}</p>
          <p className="card-meta">
            {user?.displayName || t('account.info.noName', '이름이 설정되어 있지 않습니다.')}
          </p>
        </div>

        <div className="account-card">
          <p className="card-label">{t('account.sessions.total', 'Total sessions')}</p>
          <p className="card-value">{stats.totalSessions}</p>
          <p className="card-meta">{t('account.sessions.desc', '지금까지 기록된 세션 수')}</p>
        </div>

        <div className="account-card">
          <p className="card-label">{t('account.sessions.days', 'Active days')}</p>
          <p className="card-value">{stats.totalDays}</p>
          <p className="card-meta">{t('account.sessions.daysDesc', '우리 서비스와 함께한 일 수')}</p>
        </div>

        <div className="account-card">
          <p className="card-label">{t('account.sessions.last', 'Last session')}</p>
          <p className="card-value">{stats.lastSession ?? t('account.sessions.none', '기록 없음')}</p>
          <p className="card-meta">{t('account.sessions.lastDesc', '마지막 기록된 세션 시각')}</p>
        </div>
      </section>

      <section className="account-section">
        <div className="section-header">
          <h2>{t('account.actions.title', '계정 및 출석')}</h2>
          <p className="muted">{t('account.actions.subtitle', '출석 정보와 계정 관리')}</p>
        </div>
        <div className="account-actions">
          <button className="secondary-button" onClick={() => alert(t('account.attendance', '출석 확인 기능은 준비 중입니다.'))}>
            {t('account.actions.attendance', '출석 정보 보기')}
          </button>
          <button className="secondary-button" onClick={() => alert(t('account.summary', '세션 요약 기능은 준비 중입니다.'))}>
            {t('account.actions.summary', '세션 요약 보기')}
          </button>
          <button className="danger-button" onClick={handleDeleteAccount}>
            {t('account.actions.delete', '계정 탈퇴')}
          </button>
          <button className="secondary-button ghost" onClick={signOut}>
            {t('account.actions.signout', '로그아웃')}
          </button>
        </div>
      </section>

      <section className="account-section">
        <div className="section-header">
          <div>
            <p className="account-kicker">{t('settings.survey.title', 'Skill snapshot')}</p>
            <h2 style={{ margin: 0 }}>{t('settings.survey.title', 'Skill snapshot')}</h2>
            <p className="muted">
              {t(
                'settings.survey.desc',
                '온보딩 설문 응답을 업데이트하면 추천 목표와 리포트가 더 정확해집니다.',
              )}
            </p>
          </div>
          <button className="primary-button" onClick={() => navigate('/onboarding/survey')}>
            {t('settings.survey.cta', '설문 다시 작성')}
          </button>
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
          <p className="muted">
            {t(
              'settings.survey.empty',
              '첫 로그인 시 작성한 설문이 여기에 표시됩니다. 설문을 작성해 맞춤 추천을 받아보세요.',
            )}
          </p>
        )}
      </section>
    </div>
  );
};

export default AccountPage;
