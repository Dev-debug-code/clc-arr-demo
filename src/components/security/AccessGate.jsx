import { useState } from 'react';
import PropTypes from 'prop-types';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { applyAuthPersistence, getFirebaseAuth } from '../../config/firebase.js';

const DEFAULT_CONFIG = Object.freeze({
  heading: 'Restricted access',
  supporting: 'Sign in with your work email to continue.'
});

const FORM_LABELS = {
  signIn: {
    title: 'Sign in',
    submit: 'Unlock workspace',
    togglePrompt: "Don't have an account?",
    toggleAction: 'Create one'
  },
  signUp: {
    title: 'Create account',
    submit: 'Create account',
    togglePrompt: 'Already have an account?',
    toggleAction: 'Sign in'
  }
};

const LOGO_SRC = `${import.meta.env.BASE_URL ?? '/'}assets/sumplexity_icon_logo.png`;

export default function AccessGate({ config = DEFAULT_CONFIG, onUnlock }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('signIn');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const labels = FORM_LABELS[mode];

  const resetFormState = () => {
    setError('');
    setIsSubmitting(false);
  };

  const handleAuthError = (firebaseError) => {
    const code = firebaseError?.code ?? '';
    if (code === 'auth/invalid-email') {
      setError('That email address is not valid.');
    } else if (code === 'auth/email-already-in-use') {
      setError('That email is already registered. Try signing in instead.');
    } else if (code === 'auth/user-disabled') {
      setError('This account has been disabled. Contact support for help.');
    } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password') {
      setError('Email or password is incorrect. Please try again.');
    } else if (code === 'auth/weak-password') {
      setError('Choose a stronger password (minimum 6 characters).');
    } else if (code === 'auth/too-many-requests') {
      setError('Too many failed attempts. Please wait and try again later.');
    } else {
      setError('We could not process your request right now. Please try again.');
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

    if (mode === 'signUp') {
      if (trimmedPassword.length < 6) {
        setError('Passwords must be at least 6 characters long.');
        return;
      }
      if (trimmedPassword !== confirmPassword.trim()) {
        setError('Passwords do not match.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await applyAuthPersistence(remember);
      const auth = getFirebaseAuth();

      if (mode === 'signUp') {
        await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      }

      onUnlock?.();
    } catch (firebaseError) {
      handleAuthError(firebaseError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((current) => (current === 'signIn' ? 'signUp' : 'signIn'));
    setPassword('');
    setConfirmPassword('');
    resetFormState();
  };

  return (
    <div className="access-gate">
      <div className="access-gate__panel-wrapper">
        <div className="access-gate__panel">
          <div className="access-gate__header">
            <img src={LOGO_SRC} alt="Sumplexity" className="access-gate__logo" />
            <h1 className="access-gate__title">{config.heading}</h1>
            <p className="access-gate__supporting">{config.supporting}</p>
          </div>

          <form onSubmit={handleSubmit} className="access-gate__form">
            <h2 className="access-gate__form-title">{labels.title}</h2>

            <label htmlFor="accessGateEmail" className="access-gate__label">
              Work email
            </label>
            <input
              id="accessGateEmail"
              type="email"
              autoComplete={mode === 'signUp' ? 'email' : 'username'}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="access-gate__input"
              placeholder="you@company.com"
              required
              disabled={isSubmitting}
            />

            <label htmlFor="accessGatePassword" className="access-gate__label">
              Password
            </label>
            <input
              id="accessGatePassword"
              type="password"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="access-gate__input"
              placeholder={mode === 'signUp' ? 'Create a password' : 'Enter password'}
              required
              disabled={isSubmitting}
            />

            {mode === 'signUp' ? (
              <>
                <label htmlFor="accessGateConfirmPassword" className="access-gate__label">
                  Confirm password
                </label>
                <input
                  id="accessGateConfirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="access-gate__input"
                  placeholder="Re-enter password"
                  required
                  disabled={isSubmitting}
                />
              </>
            ) : null}

            <label className="access-gate__remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                disabled={isSubmitting}
              />
              Keep me signed in on this device
            </label>

            {error ? <p className="access-gate__error">{error}</p> : null}

            <button type="submit" className="btn-sumplexity btn-primary w-100" disabled={isSubmitting}>
              {isSubmitting ? (mode === 'signUp' ? 'Creating account...' : 'Signing in...') : labels.submit}
            </button>
          </form>

          <p className="access-gate__toggle">
            {labels.togglePrompt}{' '}
            <button type="button" className="access-gate__toggle-button" onClick={toggleMode} disabled={isSubmitting}>
              {labels.toggleAction}
            </button>
          </p>
        </div>
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
