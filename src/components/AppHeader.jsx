import PropTypes from 'prop-types';
import { NAV_TABS } from '../data/mockData.js';

const LOGO_SRC = '/assets/sumplexity_horizontal_logo.png';

export default function AppHeader({ currentStep, onNavigate, maxStepUnlocked }) {
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
    </header>
  );
}

AppHeader.propTypes = {
  currentStep: PropTypes.number.isRequired,
  onNavigate: PropTypes.func.isRequired,
  maxStepUnlocked: PropTypes.number.isRequired
};
