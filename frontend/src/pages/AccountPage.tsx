import './AccountPage.css';
import { useMemo } from 'react';
import { useAuth } from '../state/authContext';
import { useTrackingSession } from '../state/trackingSessionContext';
import { useTranslation } from '../state/languageContext';

const AccountPage = () => {
  const { user, signOut } = useAuth();
  const { recentSessions } = useTrackingSession();
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
    </div>
  );
};

export default AccountPage;
