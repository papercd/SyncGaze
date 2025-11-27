import { Link } from 'react-router-dom';
import './PolicyPage.css';
import { TERMS_OF_SERVICE, type PolicySection } from '../assets/policies';

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

const TermsOfServicePage = () => {
  return (
    <div className="policy-page">
      <div className="policy-card">
        <p className="eyebrow">Research Consent</p>
        <h1>{TERMS_OF_SERVICE.title}</h1>
        <p className="policy-lead">{TERMS_OF_SERVICE.lead}</p>

        {TERMS_OF_SERVICE.sections.map(section => (
          <Section key={section.title} section={section} />
        ))}

        <div className="policy-actions">
          <Link to="/auth" className="primary-link">
            ← 로그인/회원가입으로 돌아가기
          </Link>
          <Link to="/privacy" className="secondary-link">
            개인정보 처리방침 보기
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;