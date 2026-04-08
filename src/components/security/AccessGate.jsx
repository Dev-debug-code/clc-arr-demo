import { useState } from 'react';
import PropTypes from 'prop-types';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { applyAuthPersistence, getFirebaseAuth } from '../../config/firebase.js';

const DEFAULT_CONFIG = Object.freeze({
  heading: 'CLC Inspection Intelligence',
  supporting: 'Evidence-led oversight for CLC inspection workflows.'
});

const withTrailingSlash = (value) => (value.endsWith('/') ? value : `${value}/`);
const publicBaseUrl = withTrailingSlash(import.meta.env.BASE_URL ?? '/');
const SUMPLEXITY_WORDMARK_SRC = `${publicBaseUrl}assets/sumplexity_horizontal_logo.png`;
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
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('bug');
  const [feedbackText, setFeedbackText] = useState('');

  const handleAuthError = (firebaseError) => {
    const code = firebaseError?.code ?? '';
    if (code === 'auth/invalid-email' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
      setError('Invalid email or password.');
    } else if (code === 'auth/user-disabled' || code === 'auth/too-many-requests') {
      setError('Account locked. Contact your administrator.');
    } else if (code === 'auth/network-request-failed') {
      setError('Unable to connect. Check your network.');
    } else {
      setError('Unable to connect. Check your network.');
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

  const heading = config.heading || DEFAULT_CONFIG.heading;
  const supporting = config.supporting || DEFAULT_CONFIG.supporting;

  return (
    <div className="access-gate">
      <div className="login-wrapper">
        <div className="access-gate__brand-lockup">
          <img src={SUMPLEXITY_WORDMARK_SRC} alt="Sumplexity" className="access-gate__wordmark" />
          <img src={CLC_LOGO_SRC} alt="CLC" className="access-gate__clc-logo" />
          <div className="access-gate__brand-copy">
            <p className="access-gate__eyebrow">CLC regulatory workspace</p>
            <h1>{heading}</h1>
            <p className="access-gate__tagline">{supporting}</p>
          </div>
        </div>

        <div className="login-card">
          <h2>Sign in</h2>
          <p className="access-gate__supporting">Use your workspace credentials to continue.</p>

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
              <a
                href="#"
                className="access-gate__forgot-link"
                onClick={(event) => {
                  event.preventDefault();
                  setForgotModalOpen(true);
                  setResetEmail(email);
                  setResetStatus('');
                }}
              >
                Forgot password?
              </a>
            </div>
          </form>
        </div>

        <div className="login-footer">
          <img src={SUMPLEXITY_WORDMARK_SRC} alt="Sumplexity" />
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
              Email
            </label>
            <input
              id="resetEmail"
              type="email"
              className="access-gate__input"
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              placeholder="you@example.com"
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
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

      {feedbackModalOpen ? (
        <div className="access-gate-modal-backdrop" role="presentation">
          <div className="access-gate-modal" role="dialog" aria-modal="true" aria-label="Send feedback">
            <div className="access-gate-modal__header">
              <h3>Send Feedback</h3>
              <button
                type="button"
                className="access-gate-modal__close"
                aria-label="Close feedback dialog"
                onClick={() => setFeedbackModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
              <label className="form-label" htmlFor="feedbackCategory">
                Category
              </label>
              <select
                id="feedbackCategory"
                className="form-control"
                value={feedbackCategory}
                onChange={(event) => setFeedbackCategory(event.target.value)}
              >
                <option value="bug">Bug</option>
                <option value="suggestion">Suggestion</option>
                <option value="question">Question</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="feedbackText">
                Your feedback
              </label>
              <textarea
                id="feedbackText"
                className="form-control"
                rows="4"
                placeholder="Tell us what you think..."
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setFeedbackModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setFeedbackModalOpen(false);
                  setFeedbackText('');
                  setFeedbackCategory('bug');
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="feedback-tab">
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setFeedbackModalOpen(true);
          }}
        >
          Feedback
        </a>
      </div>
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
