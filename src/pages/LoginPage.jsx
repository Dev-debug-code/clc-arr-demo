import { useEffect } from 'react';
import PropTypes from 'prop-types';
import AccessGate from '../components/security/AccessGate.jsx';

export default function LoginPage({ gateConfig, onUnlock }) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const { body } = document;
    if (!body) return undefined;
    body.classList.add('access-gate-active');
    return () => body.classList.remove('access-gate-active');
  }, []);

  return (
    <div className="login-page">
      <div className="login-page__backdrop" aria-hidden="true" />
      <AccessGate config={gateConfig} onUnlock={onUnlock} />
    </div>
  );
}

LoginPage.propTypes = {
  gateConfig: PropTypes.shape({
    heading: PropTypes.string.isRequired,
    supporting: PropTypes.string.isRequired
  }).isRequired,
  onUnlock: PropTypes.func
};
