import { useState } from 'react';
import PropTypes from 'prop-types';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { applyAuthPersistence, getFirebaseAuth } from '../../config/firebase.js';

const DEFAULT_CONFIG = Object.freeze({
  heading: 'CLC Inspection Tool',
  supporting: ''
});

const withTrailingSlash = (value) => (value.endsWith('/') ? value : `${value}/`);
const publicBaseUrl = withTrailingSlash(import.meta.env.BASE_URL ?? '/');
const SUMPLEXITY_LOGO_SRC = `${publicBaseUrl}assets/sumplexity_icon_logo.png`;
const CLC_LOGO_SRC = `${publicBaseUrl}assets/clc_logo.png`;

export default function AccessGate({ config = DEFAULT_CONFIG, onUnlock }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState('');

  const handleAuthError = (firebaseError) => {
    const code = firebaseError?.code ?? '';
    if (code === 'auth/invalid-email' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
      setError('Email or password is incorrect.');
    } else if (code === 'auth/user-disabled' || code === 'auth/too-many-requests') {
      setError('Account temporarily locked. Contact your administrator.');
    } else if (code === 'auth/network-request-failed') {
      setError('Unable to connect. Check your internet connection and try again.');
    } else {
      setError('Unable to connect. Check your internet connection and try again.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Enter your email address and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await applyAuthPersistence(false);
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      onUnlock?.();
    } catch (firebaseError) {
      handleAuthError(firebaseError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const candidateEmail = resetEmail.trim() || email.trim();
    if (!candidateEmail) {
      setResetStatus('Enter your email address first.');
      return;
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), candidateEmail);
    } catch {
      // Keep response generic to avoid account enumeration.
    }
    setResetStatus('If an account exists for this email, a reset link has been sent.');
  };

  return (
    <div className="access-gate">
      <div className="login-wrapper">
        <div className="login-logos">
          <img src={SUMPLEXITY_LOGO_SRC} alt="Sumplexity" className="sumplexity-logo" />
          <img src={CLC_LOGO_SRC} alt="CLC" className="clc-logo" />
        </div>

        <div className="login-card">
          <h2>Sign in</h2>
          {config.supporting ? <p className="access-gate__supporting">{config.supporting}</p> : null}

          {error ? <div className="login-error show">{error}</div> : null}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="accessGateEmail" className="form-label">
                Email
              </label>
              <input
                id="accessGateEmail"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="form-control"
                placeholder="you@example.com"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="accessGatePassword" className="form-label">
                Password
              </label>
              <div className="password-wrapper">
                <input
                  id="accessGatePassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="form-control"
                  placeholder="Enter your password"
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                    {showPassword ? <line x1="3" y1="21" x2="21" y2="3" /> : null}
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" className="btn-sumplexity btn-primary w-100 btn-sign-in" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="forgot-link">
              <button
                type="button"
                className="access-gate__forgot-link"
                onClick={() => {
                  setForgotModalOpen(true);
                  setResetEmail(email);
                  setResetStatus('');
                }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>

        <div className="login-footer">
          <img src={SUMPLEXITY_LOGO_SRC} alt="Sumplexity" />
          <span>Powered by Sumplexity</span>
        </div>
      </div>

      {forgotModalOpen ? (
        <div className="access-gate-modal-backdrop" role="presentation">
          <div className="access-gate-modal" role="dialog" aria-modal="true" aria-label="Forgot password">
            <div className="access-gate-modal__header">
              <h3>Reset password</h3>
              <button
                type="button"
                className="access-gate-modal__close"
                aria-label="Close reset password dialog"
                onClick={() => {
                  setForgotModalOpen(false);
                  setResetStatus('');
                }}
              >
                ×
              </button>
            </div>
            <p>Enter your email address and we&apos;ll send you a link to reset your password.</p>
            <label htmlFor="resetEmail" className="access-gate__label">
              Email address
            </label>
            <input
              id="resetEmail"
              type="email"
              className="access-gate__input"
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              placeholder="you@company.com"
            />
            {resetStatus ? <p className="access-gate__reset-status">{resetStatus}</p> : null}
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setForgotModalOpen(false);
                  setResetStatus('');
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={handleForgotPassword}>
                Send reset link
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

AccessGate.propTypes = {
  config: PropTypes.shape({
    heading: PropTypes.string,
    supporting: PropTypes.string
  }),
  onUnlock: PropTypes.func
};
