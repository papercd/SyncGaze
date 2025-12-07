// src/pages/LandingPage.tsx
import { useNavigate } from 'react-router-dom';
import { useRef, KeyboardEvent } from 'react';
import './LandingPage.css';
import DarkVeilBackground from '../components/DarkVeil';
import Crosshair from '../components/ScreenCrosshair';
import LanguageToggle from '../components/LanguageToggle';
import Navbar from '../components/TopNavBar';
import { useAuth } from '../state/authContext';
import { useTranslation } from '../state/languageContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const ctaSectionRef = useRef<HTMLElement>(null);
  const { user } = useAuth();
  const { t } = useTranslation();

  const handlePrimaryCta = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  const handleAboutNavigate = () => navigate('/about');

  const handleAboutLinkKeyDown = (event: KeyboardEvent<HTMLParagraphElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleAboutNavigate();
    }
  };

  return (
    <div className="landing-page">
      {/* Language Toggle - Landing variant */}
      <LanguageToggle variant="landing" />
      
      <div className="dark-veil-container">
        <DarkVeilBackground 
          hueShift={0}
          noiseIntensity={0.02}
          scanlineIntensity={0.1}
          speed={0.5}
          scanlineFrequency={2}
          warpAmount={0.3}
          resolutionScale={1}
        />
      </div>
      <div className="landing-content">
        {/* Hero Section */}
        <header className="hero">
          <Navbar showAuthButton={true} />

          <div className="hero-content">
            <h1>{t('landing.hero.title')}</h1>
            <p className="hero-subtitle">{t('landing.hero.subtitle')}</p>
            <div className="cta-buttons">
              <button className="primary-button" onClick={handlePrimaryCta}>
                {user ? t('landing.cta.primary.dashboard') : t('landing.cta.primary.auth')}
              </button>
              <button className="secondary-button" onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                {t('landing.cta.learnMore')}
              </button>
            </div>
            <p
              className="cta-about-link"
              role="link"
              tabIndex={0}
              onClick={handleAboutNavigate}
              onKeyDown={handleAboutLinkKeyDown}
            >
              <span className="cta-about-text">
                {t('landing.cta.aboutUsDetail.intro')}
              </span>{' '}
              <span className="cta-about-highlight">
                {t('landing.cta.aboutUsDetail.highlight')}
              </span>
            </p>
          </div>
        </header>

        {/* Features Section */}
        <section id="features" className="features">
          <h2>{t('landing.section.features.title')}</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <h3>{t('landing.feature.eyeTracking.title')}</h3>
              <p>{t('landing.feature.eyeTracking.desc')}</p>
            </div>

            <div className="feature-card">
              <h3>{t('landing.feature.insights.title')}</h3>
              <p>{t('landing.feature.insights.desc')}</p>
            </div>

            <div className="feature-card">
              <h3>{t('landing.feature.calibrated.title')}</h3>
              <p>{t('landing.feature.calibrated.desc')}</p>
            </div>

            <div className="feature-card">
              <h3>{t('landing.feature.realtime.title')}</h3>
              <p>{t('landing.feature.realtime.desc')}</p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="how-it-works">
          <h2>{t('landing.section.how.title')}</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>{t('landing.step.1.title')}</h3>
              <p>{t('landing.step.1.desc')}</p>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <h3>{t('landing.step.2.title')}</h3>
              <p>{t('landing.step.2.desc')}</p>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <h3>{t('landing.step.3.title')}</h3>
              <p>{t('landing.step.3.desc')}</p>
            </div>

            <div className="step">
              <div className="step-number">4</div>
              <h3>{t('landing.step.4.title')}</h3>
              <p>{t('landing.step.4.desc')}</p>
            </div>
          </div>
        </section>

        {/* CTA Section with Crosshair */}
        <section ref={ctaSectionRef} className="cta-section">
          <Crosshair containerRef={ctaSectionRef} color='#ffffff' circleRadius={50}/>
          <h2>{t('landing.cta.section.title')}</h2>
          <p>{t('landing.cta.section.desc')}</p>
          <button className="primary-button large" onClick={handlePrimaryCta}>
            {user ? t('landing.cta.primary.dashboard') : t('landing.cta.primary.auth')}
          </button>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;
