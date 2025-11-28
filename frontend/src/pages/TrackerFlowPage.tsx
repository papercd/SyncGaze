import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './TrackerFlowPage.css';
import { useTrackingSession } from '../state/trackingSessionContext';
import { useTranslation } from '../state/languageContext';

const TrackerFlowPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    surveyResponses,
    consentAccepted,
    calibrationResult,
    activeSession,
    recentSessions,
  } = useTrackingSession();

  const flowSteps = useMemo(() => {
    return [
      {
        id: 'survey',
        title: t('trackerFlow.step.survey.title', '스크리닝 설문'),
        description: t('trackerFlow.step.survey.description', '기본 자격 확인과 연구 대상 선별'),
        completed: Boolean(surveyResponses),
        actionLabel: surveyResponses
          ? t('trackerFlow.step.survey.action.edit', '응답 수정')
          : t('trackerFlow.step.survey.action.start', '설문 작성'),
        navigateTo: '/onboarding/survey',
      },
      {
        id: 'consent',
        title: t('trackerFlow.step.consent.title', '연구 소개 및 동의'),
        description: t('trackerFlow.step.consent.description', '연구 절차 안내 후 참여 동의'),
        completed: consentAccepted,
        actionLabel: consentAccepted
          ? t('trackerFlow.step.consent.action.manage', '동의 상태 관리')
          : t('trackerFlow.step.consent.action.sign', '동의하기'),
        navigateTo: '/onboarding/consent',
      },
      {
        id: 'calibration',
        title: t('trackerFlow.step.calibration.title', '캘리브레이션'),
        description: t('trackerFlow.step.calibration.description', '웹캠 기반 시선 추적 정렬'),
        completed: calibrationResult?.status === 'validated',
        actionLabel:
          calibrationResult?.status === 'validated'
            ? t('trackerFlow.step.calibration.action.retry', '재측정')
            : t('trackerFlow.step.calibration.action.start', '시작하기'),
        navigateTo: '/calibration',
        meta:
          calibrationResult?.validationError != null
            ? `${Math.round(calibrationResult.validationError)}px error`
            : undefined,
      },
      {
        id: 'training',
        title: t('trackerFlow.step.training.title', '트레이닝 세션'),
        description: t('trackerFlow.step.training.description', '60초 동안 표적 맞추기'),
        completed: Boolean(activeSession),
        actionLabel: t('trackerFlow.step.training.action', '트레이닝 실행'),
        navigateTo: '/training',
      },
      {
        id: 'results',
        title: t('trackerFlow.step.results.title', '결과 리포트'),
        description: t('trackerFlow.step.results.description', '정확도, 반응속도, 시선-마우스 차이 분석'),
        completed: Boolean(activeSession),
        actionLabel: t('trackerFlow.step.results.action', '결과 보기'),
        navigateTo: '/results',
      },
    ];
  }, [activeSession, calibrationResult, consentAccepted, surveyResponses, t]);

  return (
    <div className="tracker-flow-page">
      <header className="flow-header">
        <div>
          <p className="eyebrow">Tracker Flow</p>
          <h1>{t('trackerFlow.title', '연구 진행 현황')}</h1>
          <p>
            {t(
              'trackerFlow.description',
              'tracker-app과 동일한 세션 컨텍스트를 공유하여 온보딩, 캘리브레이션, 트레이닝 단계를 하나의 흐름으로 추적합니다.',
            )}
          </p>
        </div>
        <button className="secondary-button" onClick={() => navigate('/dashboard')}>
          {t('trackerFlow.toDashboard', '대시보드로 이동')}
        </button>
      </header>

      <section className="flow-grid">
        {flowSteps.map(step => (
          <article key={step.id} className={`flow-card ${step.completed ? 'completed' : ''}`}>
              <div className="flow-card-header">
                <div>
                  <p className="step-label">STEP {flowSteps.indexOf(step) + 1}</p>
                  <h2>{step.title}</h2>
                </div>
                <span className={`status-pill ${step.completed ? 'success' : 'pending'}`}>
                {step.completed ? t('trackerFlow.status.complete', '완료') : t('trackerFlow.status.waiting', '대기')}
                </span>
              </div>
            <p className="flow-description">{step.description}</p>
            {step.meta && <p className="flow-meta">{step.meta}</p>}
            <button className="primary-button" onClick={() => navigate(step.navigateTo)}>
              {step.actionLabel}
            </button>
          </article>
        ))}
      </section>

      <section className="session-panel">
          <div className="panel-header">
            <div>
            <h3>{t('trackerFlow.recentSessions', '최근 세션')}</h3>
            <p>{t('trackerFlow.recentSessions.desc', '컨텍스트에 저장된 마지막 3건의 트레이닝 데이터')}</p>
            </div>
            <button className="link-button" onClick={() => navigate('/training')}>
            {t('trackerFlow.newSession', '새 세션 시작')}
            </button>
          </div>

        {recentSessions.length === 0 ? (
          <div className="empty-state">{t('trackerFlow.empty', '아직 저장된 세션이 없습니다.')}</div>
        ) : (
          <div className="session-table">
            <div className="session-row session-row--head">
              <span>{t('trackerFlow.table.date', '날짜')}</span>
              <span>{t('trackerFlow.table.accuracy', '정확도')}</span>
              <span>{t('trackerFlow.table.reaction', '평균 반응속도')}</span>
              <span>{t('trackerFlow.table.target', '타겟 명중')}</span>
            </div>
            {recentSessions.slice(0, 3).map(session => (
              <div key={session.id} className="session-row">
                <span>{new Date(session.date).toLocaleString()}</span>
                <span>{session.accuracy.toFixed(1)}%</span>
                <span>{session.avgReactionTime.toFixed(0)}ms</span>
                <span>
                  {session.targetsHit}/{session.totalTargets}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default TrackerFlowPage;