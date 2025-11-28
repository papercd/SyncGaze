// src/pages/LandingPage.tsx
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import './LandingPage.css';
import DarkVeilBackground from '../components/DarkVeil';
import Crosshair from '../components/ScreenCrosshair';
import { useAuth } from '../state/authContext';
import { useTranslation } from '../state/languageContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const ctaSectionRef = useRef<HTMLElement>(null);
  const { user, signOut } = useAuth();
  const { t } = useTranslation();

  const handleNavClick = async () => {
    if (user) {
      await signOut();
      navigate('/');
      return;
    }
    navigate('/auth');
  };

  const handlePrimaryCta = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="landing-page">
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
        <nav className="navbar">
          <div className="logo">SyncGaze</div>
          <button className="nav-button" onClick={handleNavClick}>
            {user ? t('landing.nav.signOut') : t('landing.nav.signIn')}
          </button>
        </nav>

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
        <Crosshair containerRef={ctaSectionRef} color='#ffffff'  circleRadius={50}/>
        <h2>{t('landing.cta.section.title')}</h2>
        <p>{t('landing.cta.section.desc')}</p>
        <button className="primary-button large" onClick={handlePrimaryCta}>
          {user ? t('landing.cta.section.primary.dashboard') : t('landing.cta.section.primary.auth')}
        </button>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>{t('landing.footer.copyright')}</p>
        {/* 깃허브 연결 */}
        <a
          href="https://github.com/papercd/syncgaze"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
          style={{ marginLeft: '1rem', color: 'inherit', textDecoration: 'none', opacity: 0.8 }}
        >
          {t('landing.footer.github')}
        </a>
      </footer>
    </div>

      
    </div>
  );
};

export default LandingPage;