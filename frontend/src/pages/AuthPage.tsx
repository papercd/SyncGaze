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
import { SIGNUP_NOTICE } from '../assets/policies';

const AuthPage = () => {
  const navigate = useNavigate();
  const { setAnonymousSession } = useTrackingSession();
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
      setError('Passwords do not match.');
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
      const message = authError instanceof Error ? authError.message : 'Unable to authenticate. Please try again.';
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
      const message =
        anonError instanceof Error
          ? anonError.message
          : 'Unable to start anonymous session. Please try again.';
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
      const message =
        googleError instanceof Error
          ? googleError.message
          : 'Unable to sign in with Google right now. Please try again.';
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
        message: 'Please enter the email associated with your account.',
      });
      return;
    }

    setResetLoading(true);
    setResetFeedback(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetFeedback({
        type: 'success',
        message: 'Password reset email sent. Please check your inbox.',
      });
      setResetEmail('');
      setShowResetForm(false);
    } catch (resetError) {
      let message = 'Unable to send reset email. Please try again.';

      if (resetError instanceof FirebaseError) {
        switch (resetError.code) {
          case 'auth/user-not-found':
            message = 'No account found with that email address.';
            break;
          case 'auth/invalid-email':
            message = 'Please enter a valid email address.';
            break;
          case 'auth/missing-email':
            message = 'Please enter your email before requesting a reset.';
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
            <p className="brand-tagline">
              Elevate your aim with AI-powered eye tracking technology
            </p>
            <div className="brand-features">
              <div className="brand-feature">
                <span className="feature-icon">✓</span>
                <span>Advanced Eye Tracking</span>
              </div>
              <div className="brand-feature">
                <span className="feature-icon">✓</span>
                <span>Detailed Analytics</span>
              </div>
              <div className="brand-feature">
                <span className="feature-icon">✓</span>
                <span>Performance Insights</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="auth-form-container">
          <div className="auth-form-wrapper">
            <div className="form-header">
              <h2>{isLogin ? 'Welcome!' : 'Create Account'}</h2>
              <p>
                {isLogin 
                  ? 'Sign in to start training with SyncGaze' 
                  : 'Start your journey to better aim'}
              </p>
            </div>

            {!isLogin && (
              <div className="signup-notice" aria-label="회원가입 안내문">
                <h3>{SIGNUP_NOTICE.title}</h3>
                {SIGNUP_NOTICE.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
                <ul>
                  {SIGNUP_NOTICE.bullets?.map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Enter your username"
                    required={!isLogin}
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
                    required={!isLogin}
                  />
                </div>
              )}

              {isLogin && (
                <div className="form-extras">
                  <label className="remember-me">
                    <input type="checkbox" />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="forgot-password-button"
                    onClick={() => {
                      setResetFeedback(null);
                      setShowResetForm(true);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
            </button>

            <p className="policy-disclaimer">
              로그인 시 <Link to="/terms">이용약관</Link> 및 <Link to="/privacy">개인정보 처리방침</Link>에 동의하는 것으로 간주합니다.
            </p>

            <div className="oauth-divider">
              <span />
              <p>or</p>
              <span />
            </div>

            {socialError && <div className="form-error social-error">{socialError}</div>}

            <button
              type="button"
              className="google-button"
              onClick={handleGoogleSignIn}
              disabled={socialLoading}
            >
              {socialLoading ? 'Connecting to Google…' : 'Continue with Google'}
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
                {anonymousLoading ? 'Starting secure guest session…' : 'Continue as Guest for Data Collection'}
              </button>
              <p className="guest-copy">
                Anonymous mode is only for controlled research tests. We temporarily hide account-only actions while we
                capture calibration and tracking data without saving a profile.
              </p>
            </div>
          )}

          {isLogin && (
            <div className="password-reset-area">
                {showResetForm && (
                  <form className="password-reset-form" onSubmit={handlePasswordReset}>
                    <label htmlFor="resetEmail">Enter your email</label>
                    <input
                      type="email"
                      id="resetEmail"
                      name="resetEmail"
                      placeholder="you@example.com"
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
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="reset-submit-button"
                        disabled={resetLoading}
                      >
                        {resetLoading ? 'Sending…' : 'Send reset link'}
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
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="switch-button"
                >
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>

            <button 
              className="back-home-button"
              onClick={() => navigate('/')}
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
