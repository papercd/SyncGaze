// src/pages/AuthPage.tsx
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './AuthPage.css';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
  googleProvider,
  signInWithPopup,
} from '../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { useTrackingSession } from '../state/trackingSessionContext';
import { useTranslation } from '../state/languageContext';

const AuthPage = () => {
  const navigate = useNavigate();
  const { setAnonymousSession } = useTrackingSession();
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anonymousLoading, setAnonymousLoading] = useState(false);
  const [anonymousError, setAnonymousError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSocialError(null);

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError(t('auth.error.passwordMismatch'));
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

        if (formData.username.trim()) {
          await updateProfile(userCredential.user, {
            displayName: formData.username.trim(),
          });
        }
      }

      setAnonymousSession(false);
      navigate('/dashboard');
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : t('auth.form.error.general');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setAnonymousError(null);
    setAnonymousLoading(true);
    try {
      await signInAnonymously(auth);
      setAnonymousSession(true);
      navigate('/dashboard');
    } catch (anonError) {
      const message = anonError instanceof Error ? anonError.message : t('auth.guest.error');
      setAnonymousError(message);
    } finally {
      setAnonymousLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSocialError(null);
    setSocialLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setAnonymousSession(false);
      navigate('/dashboard');
    } catch (googleError) {
      const message = googleError instanceof Error ? googleError.message : t('auth.oauth.error');
      setSocialError(message);
    } finally {
      setSocialLoading(false);
    }
  };

  const handlePasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = resetEmail.trim();

    if (!email) {
      setResetFeedback({
        type: 'error',
        message: t('auth.reset.required'),
      });
      return;
    }

    setResetLoading(true);
    setResetFeedback(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetFeedback({
        type: 'success',
        message: t('auth.reset.success'),
      });
      setResetEmail('');
      setShowResetForm(false);
    } catch (resetError) {
      let message = t('auth.reset.error');

      if (resetError instanceof FirebaseError) {
        switch (resetError.code) {
          case 'auth/user-not-found':
            message = t('auth.reset.notFound');
            break;
          case 'auth/invalid-email':
            message = t('auth.reset.invalid');
            break;
          case 'auth/missing-email':
            message = t('auth.reset.missing');
            break;
          default:
            message = resetError.message || message;
            break;
        }
      }

      setResetFeedback({
        type: 'error',
        message,
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Left side - Branding */}
        <div className="auth-branding">
            <div className="branding-content">
              <h1 className="brand-logo">SyncGaze</h1>
            <p className="brand-tagline">{t('auth.brand.tagline')}</p>
            <div className="brand-features">
              <div className="brand-feature">
                <span className="feature-icon">✓</span>
                <span>{t('auth.brand.feature.eyeTracking')}</span>
              </div>
              <div className="brand-feature">
                <span className="feature-icon">✓</span>
                <span>{t('auth.brand.feature.analytics')}</span>
              </div>
              <div className="brand-feature">
                <span className="feature-icon">✓</span>
                <span>{t('auth.brand.feature.insights')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="auth-form-container">
            <div className="auth-form-wrapper">
              <div className="form-header">
              <h2>{isLogin ? t('auth.header.login') : t('auth.header.signup')}</h2>
              <p>{isLogin ? t('auth.subheader.login') : t('auth.subheader.signup')}</p>
              </div>

            {!isLogin && (
              <div className="signup-notice" aria-label="회원가입 안내문">
                <h3>{t('auth.signup.notice.title')}</h3>
                {[t('auth.signup.notice.p1'), t('auth.signup.notice.p2')].map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
                <ul>
                  {[t('auth.signup.notice.bullet1'), t('auth.signup.notice.bullet2'), t('auth.signup.notice.bullet3')].map(
                    (bullet, index) => (
                      <li key={index}>{bullet}</li>
                    ),
                  )}
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="username">{t('auth.label.username')}</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder={t('auth.placeholder.username')}
                    required={!isLogin}
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">{t('auth.label.email')}</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder={t('auth.placeholder.email')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">{t('auth.label.password')}</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={t('auth.placeholder.password')}
                  required
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">{t('auth.label.confirmPassword')}</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder={t('auth.placeholder.confirmPassword')}
                    required={!isLogin}
                  />
                </div>
              )}

              {isLogin && (
                <div className="form-extras">
                  <label className="remember-me">
                    <input type="checkbox" />
                    <span>{t('auth.form.remember')}</span>
                  </label>
                  <button
                    type="button"
                    className="forgot-password-button"
                    onClick={() => {
                      setResetFeedback(null);
                      setShowResetForm(true);
                    }}
                  >
                    {t('auth.form.forgot')}
                  </button>
                </div>
              )}

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? t('auth.button.loading') : isLogin ? t('auth.button.login') : t('auth.button.signup')}
            </button>

            <p className="policy-disclaimer">
              {t('auth.disclaimer')}{' '}
              <Link to="/terms">이용약관</Link> 및 <Link to="/privacy">개인정보 처리방침</Link>
            </p>

            <div className="oauth-divider">
              <span />
              <p>{t('auth.divider.or')}</p>
              <span />
            </div>

            {socialError && <div className="form-error social-error">{socialError}</div>}

            <button
              type="button"
              className="google-button"
              onClick={handleGoogleSignIn}
              disabled={socialLoading}
            >
              {socialLoading ? t('auth.button.google.loading') : t('auth.button.google')}
            </button>
          </form>

            {isLogin && (
              <div className="guest-access" title="Guest mode is limited to supervised data-collection tests">
                {anonymousError && <div className="form-error guest-error">{anonymousError}</div>}
                <button
                  type="button"
                  className="guest-button"
                  onClick={handleAnonymousSignIn}
                  disabled={anonymousLoading}
                >
                {anonymousLoading ? t('auth.guest.loading') : t('auth.guest.start')}
                </button>
                <p className="guest-copy">
                {t('auth.guest.copy')}
                </p>
              </div>
            )}

            {isLogin && (
              <div className="password-reset-area">
                {showResetForm && (
                  <form className="password-reset-form" onSubmit={handlePasswordReset}>
                    <label htmlFor="resetEmail">{t('auth.reset.label')}</label>
                    <input
                      type="email"
                      id="resetEmail"
                      name="resetEmail"
                      placeholder={t('auth.reset.placeholder')}
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      disabled={resetLoading}
                      required
                    />
                    <div className="reset-actions">
                      <button
                        type="button"
                        className="reset-cancel-button"
                        onClick={() => setShowResetForm(false)}
                        disabled={resetLoading}
                      >
                        {t('auth.reset.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="reset-submit-button"
                        disabled={resetLoading}
                      >
                        {resetLoading ? t('auth.reset.sending') : t('auth.reset.submit')}
                      </button>
                    </div>
                  </form>
                )}

                {resetFeedback && (
                  <p className={`reset-feedback ${resetFeedback.type}`}>
                    {resetFeedback.message}
                  </p>
                )}
              </div>
            )}

            <div className="form-switch">
              <p>
                {isLogin ? `${t('auth.switch.signup')} ` : `${t('auth.switch.login')} `}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="switch-button"
                >
                  {isLogin ? t('auth.button.toSignup') : t('auth.button.toLogin')}
                </button>
              </p>
            </div>

            <button
              className="back-home-button"
              onClick={() => navigate('/')}
            >
              {t('auth.back.home')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;