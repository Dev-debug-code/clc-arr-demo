import PropTypes from 'prop-types';
import { NAV_TABS } from '../data/mockData.js';

const LOGO_SRC = 'assets/sumplexity_horizontal_logo.png';

export default function AppHeader({
  currentStep,
  onNavigate,
  maxStepUnlocked,
  currentUserEmail,
  onSignOut
}) {
  const resolveActiveTab = () => {
    return NAV_TABS.find((tab) => currentStep >= tab.stepRange[0] && currentStep <= tab.stepRange[1])?.id;
  };

  const activeTab = resolveActiveTab();

  return (
    <header className="workspace-header">
      <div className="app-logo">
        <img src={LOGO_SRC} alt="Sumplexity logo" />
        <p className="app-logo-tagline">Regulatory Audit Assistant</p>
      </div>
      <nav className="workspace-nav" aria-label="Primary">
        {NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const isUnlocked = tab.stepRange[0] <= maxStepUnlocked;
          return (
            <button
              key={tab.id}
              type="button"
              className={`nav-tab ${isActive ? 'active' : ''} ${!isUnlocked ? 'disabled' : ''}`}
              onClick={() => isUnlocked && onNavigate(tab.stepRange[0])}
              aria-pressed={isActive}
              aria-disabled={!isUnlocked}
              disabled={!isUnlocked}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
      {currentUserEmail || onSignOut ? (
        <div className="workspace-header__actions">
          {currentUserEmail ? (
            <span className="workspace-header__user" title={currentUserEmail}>
              {currentUserEmail}
            </span>
          ) : null}
          {onSignOut ? (
            <button type="button" className="btn-sumplexity btn-secondary" onClick={onSignOut}>
              Sign out
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

AppHeader.propTypes = {
  currentStep: PropTypes.number.isRequired,
  onNavigate: PropTypes.func.isRequired,
  maxStepUnlocked: PropTypes.number.isRequired,
  currentUserEmail: PropTypes.string,
  onSignOut: PropTypes.func
};

AppHeader.defaultProps = {
  currentUserEmail: '',
  onSignOut: null
};
