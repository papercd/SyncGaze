import { Link } from 'react-router-dom';
import './PolicyPage.css';
import { PRIVACY_POLICY, type PolicySection } from '../assets/policies';
import { useTranslation } from '../state/languageContext';

const Section = ({ section }: { section: PolicySection }) => (
  <section className="policy-section">
    <h2>{section.title}</h2>
    {section.paragraphs?.map((paragraph, index) => (
      <p key={index}>{paragraph}</p>
    ))}
    {section.bullets && (
      <ul>
        {section.bullets.map((bullet, index) => (
          <li key={index}>{bullet}</li>
        ))}
      </ul>
    )}
  </section>
);

const PrivacyPolicyPage = () => {
  const { t } = useTranslation();
  return (
    <div className="policy-page">
      <div className="policy-card">
        <p className="eyebrow">{t('policy.eyebrow', 'Privacy & Legal')}</p>
        <h1>{PRIVACY_POLICY.title}</h1>
        <p className="policy-lead">{PRIVACY_POLICY.lead}</p>

        {PRIVACY_POLICY.sections.map(section => (
          <Section key={section.title} section={section} />
        ))}

        <div className="policy-actions">
          <Link to="/auth" className="primary-link">
            ← {t('policy.backToAuth', '로그인/회원가입으로 돌아가기')}
          </Link>
          <Link to="/terms" className="secondary-link">
            {t('policy.viewTerms', '연구 참여 이용약관 보기')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
