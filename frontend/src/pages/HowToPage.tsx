import './HowToPage.css';
import { type ComponentType, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../state/languageContext';
import {
  BarChart3,
  Camera,
  CheckCircle2,
  Crosshair,
  FileText,
  MousePointerClick,
  Settings,
  Sparkles,
} from 'lucide-react';

interface StepCard {
  key: string;
  title: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
  bullets: string[];
}

const HowToPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const steps: StepCard[] = useMemo(
    () => [
      {
        key: 'setup',
        title: t('howTo.step.setup.title', '환경 준비'),
        description: t(
          'howTo.step.setup.desc',
          '웹캠, 조명, 입력 장치를 점검해 깔끔한 캘리브레이션을 준비하세요.',
        ),
        icon: Camera,
        bullets: [
          t('howTo.step.setup.item1', '웹캠 권한을 허용하고 얼굴이 화면 중앙에 오도록 맞춰 주세요.'),
          t('howTo.step.setup.item2', '정면에서 은은한 조명이 비치도록 하고 역광은 피하세요.'),
          t('howTo.step.setup.item3', '마우스 패드 공간을 확보하고 DPI/감도를 평소와 동일하게 맞추세요.'),
        ],
      },
      {
        key: 'calibration',
        title: t('howTo.step.calibration.title', '캘리브레이션'),
        description: t(
          'howTo.step.calibration.desc',
          '화면의 점을 따라가며 클릭해 시선 좌표를 보정합니다.',
        ),
        icon: Crosshair,
        bullets: [
          t('howTo.step.calibration.item1', '점이 이동할 때마다 3회씩 정확히 클릭합니다.'),
          t('howTo.step.calibration.item2', '머리를 고정하고 눈만 움직여 정확도를 높이세요.'),
          t('howTo.step.calibration.item3', '검증 단계에서 오차가 크면 조명/자세를 다시 확인하세요.'),
        ],
      },
      {
        key: 'training',
        title: t('howTo.step.training.title', '트레이닝 플레이'),
        description: t(
          'howTo.step.training.desc',
          '가이드에 따라 타겟을 바라보고 클릭하며 반응 속도를 높입니다.',
        ),
        icon: MousePointerClick,
        bullets: [
          t('howTo.step.training.item1', '타겟이 나타나면 시선을 먼저 고정하고 클릭하세요.'),
          t('howTo.step.training.item2', '한 세션은 짧게 진행하고 필요하면 중간에 휴식하세요.'),
          t('howTo.step.training.item3', '예상보다 느리면 감도나 조명을 다시 점검해 보세요.'),
        ],
      },
      {
        key: 'review',
        title: t('howTo.step.review.title', '결과 확인 및 리포트'),
        description: t(
          'howTo.step.review.desc',
          '대시보드와 리포트에서 정확도와 반응 속도를 비교해 보세요.',
        ),
        icon: BarChart3,
        bullets: [
          t('howTo.step.review.item1', '최근 세션 카드에서 자세히 보기를 눌러 세부 지표를 확인합니다.'),
          t('howTo.step.review.item2', '리포트 버튼으로 공유용 리포트를 생성하거나 열람하세요.'),
          t('howTo.step.review.item3', '세팅을 바꿨다면 다음 세션 결과와 비교해 최적값을 찾으세요.'),
        ],
      },
    ],
    [t],
  );

  const faqItems = useMemo(
    () => [
      {
        question: t('howTo.faq.q1.title', '카메라 인식이 잘 안 될 때는?'),
        answer: t(
          'howTo.faq.q1.answer',
          '브라우저의 카메라 접근 허용을 다시 확인하고, 밝은 조명에서 얼굴이 프레임 중앙에 오도록 조정해 주세요.',
        ),
      },
      {
        question: t('howTo.faq.q2.title', '정확도가 낮게 나올 때는?'),
        answer: t(
          'howTo.faq.q2.answer',
          '캘리브레이션을 다시 실행하고, 점을 클릭할 때 머리를 고정한 채 눈만 움직였는지 확인하세요. 조명과 화면 밝기도 70% 이상으로 유지해 주세요.',
        ),
      },
      {
        question: t('howTo.faq.q3.title', '세션을 공유하거나 보관하려면?'),
        answer: t(
          'howTo.faq.q3.answer',
          '대시보드 > 리포트에서 세션을 선택해 리포트를 생성하세요. PDF처럼 링크를 공유하거나 다시 열람할 수 있습니다.',
        ),
      },
    ],
    [t],
  );

  return (
    <div className="howto-page">
      <header className="howto-hero">
        <div className="howto-hero__content">
          <p className="howto-kicker">{t('howTo.kicker', '사용 가이드')}</p>
          <h1 className="howto-title">{t('howTo.title', 'SyncGaze 사용법 한눈에 보기')}</h1>
          <p className="howto-subtitle">
            {t(
              'howTo.subtitle',
              '캘리브레이션부터 리포트까지, 처음 사용자도 3분 만에 흐름을 이해할 수 있도록 정리했어요.',
            )}
          </p>

          <div className="howto-actions">
            <button className="howto-primary" onClick={() => navigate('/calibration')}>
              <Crosshair size={18} />
              {t('howTo.cta.start', '바로 캘리브레이션')}
            </button>
            <button className="howto-secondary" onClick={() => navigate('/settings')}>
              <Settings size={18} />
              {t('howTo.cta.settings', '컨트롤 설정 보기')}
            </button>
            <button className="howto-ghost" onClick={() => navigate('/dashboard')}>
              {t('howTo.cta.dashboard', '대시보드로 돌아가기')}
            </button>
          </div>

          <div className="howto-checklist">
            <span>{t('howTo.requirements.camera', '웹캠 허용')}</span>
            <span>{t('howTo.requirements.light', '정면 조명')}</span>
            <span>{t('howTo.requirements.space', '마우스 패드 공간')}</span>
          </div>
        </div>

        <div className="howto-hero__panel">
          <div className="panel-card">
            <div className="panel-label">{t('howTo.flow.label', '핵심 흐름')}</div>
            <ol className="flow-steps">
              {steps.map((step, index) => (
                <li key={step.key} className="flow-step">
                  <span className="flow-step__number">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="flow-step__title">{step.title}</p>
                    <p className="flow-step__desc">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="panel-footnote">
            <Sparkles size={16} />
            <span>
              {t(
                'howTo.flow.note',
                '각 단계는 3분 내외로 끝납니다. 정확한 시선 유지와 일정한 클릭 리듬을 신경 써 주세요.',
              )}
            </span>
          </div>
        </div>
      </header>

      <section className="howto-section">
        <div className="section-header">
          <h2>{t('howTo.steps.title', '사용 흐름 한눈에 보기')}</h2>
          <p className="section-subtitle">
            {t('howTo.steps.subtitle', '준비 - 캘리브레이션 - 트레이닝 - 결과 확인까지 필요한 포인트만 담았습니다.')}
          </p>
        </div>

        <div className="howto-grid">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.key} className="howto-card">
                <div className="card-header">
                  <div className="card-icon">
                    <Icon size={22} />
                  </div>
                  <div className="card-meta">
                    <span className="card-step">
                      {t('howTo.step.label', 'STEP')} {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3>{step.title}</h3>
                    <p className="card-description">{step.description}</p>
                  </div>
                </div>
                <ul className="card-list">
                  {step.bullets.map((bullet, idx) => (
                    <li key={idx}>
                      <CheckCircle2 size={16} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="howto-section tips-section">
        <div className="section-header">
          <h2>{t('howTo.tips.title', '좋은 결과를 위한 팁')}</h2>
          <p className="section-subtitle">
            {t('howTo.tips.subtitle', '작은 습관과 환경 조정이 정확도와 반응 속도를 크게 끌어올립니다.')}
          </p>
        </div>

        <div className="tips-grid">
          <div className="tip-card highlight">
            <div className="tip-label">
              <Camera size={16} />
              <span>{t('howTo.tip.environment', '환경 체크')}</span>
            </div>
            <ul>
              <li>{t('howTo.tip.distance', '눈과 화면 거리를 50~70cm로 유지하고, 화면 밝기는 70% 이상으로 설정하세요.')}</li>
              <li>{t('howTo.tip.light', '정면 조명을 유지하고 안경 반사가 있으면 조명을 살짝 옆으로 이동하세요.')}</li>
            </ul>
          </div>
          <div className="tip-card">
            <div className="tip-label">
              <Settings size={16} />
              <span>{t('howTo.tip.controls', '컨트롤')}</span>
            </div>
            <ul>
              <li>{t('howTo.tip.sensitivity', '감도는 평소 플레이 값과 동일하게 두고, 변동 시 다음 세션에서 결과를 비교하세요.')}</li>
              <li>{t('howTo.tip.breaks', '짧은 세션 후 1분 정도 눈 휴식을 취하면 집중력이 유지됩니다.')}</li>
            </ul>
          </div>
          <div className="tip-card">
            <div className="tip-label">
              <FileText size={16} />
              <span>{t('howTo.tip.reports', '데이터 활용')}</span>
            </div>
            <ul>
              <li>{t('howTo.tip.review', '세션별 리포트를 저장해 조명/자세/감도 변경 전후를 비교해 보세요.')}</li>
              <li>{t('howTo.tip.share', '협업이나 코칭이 필요하면 리포트 링크를 공유해 피드백을 받아보세요.')}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="howto-section faq-section">
        <div className="section-header">
          <h2>{t('howTo.faq.title', '자주 묻는 질문')}</h2>
          <p className="section-subtitle">
            {t('howTo.faq.subtitle', '간단한 해결 방법을 먼저 확인해 보세요. 문제가 지속되면 우리 팀에 문의해 주세요.')}
          </p>
        </div>

        <div className="faq-grid">
          {faqItems.map(item => (
            <div key={item.question} className="faq-card">
              <div className="faq-icon">
                <Sparkles size={16} />
              </div>
              <p className="faq-question">{item.question}</p>
              <p className="faq-answer">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HowToPage;
