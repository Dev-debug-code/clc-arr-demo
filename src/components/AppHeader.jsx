import PropTypes from 'prop-types';

const BASE_URL = import.meta.env.BASE_URL ?? '/';
const SUMPLEXITY_ICON_SRC = `${BASE_URL}assets/sumplexity_icon_logo.png`;
const CLC_LOGO_SRC = `${BASE_URL}assets/clc_logo.png`;

export default function AppHeader({
  currentUserEmail,
  onHome,
  onOpenAssistant,
  assistantOpen,
  centerLabel,
  showCenter,
  showCenterChevron,
  compact
}) {
  const currentUserLabel = currentUserEmail
    ? currentUserEmail.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Wayne Bradley';
  const currentUserInitials = currentUserLabel
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'WB';

  return (
    <header className="workspace-header">
      <div className={`workspace-header__top ${compact ? 'workspace-header__top--compact' : ''}`}>
        <button type="button" className="app-logo app-logo--pair app-logo-button" onClick={onHome} aria-label="Go to dashboard">
          <img src={SUMPLEXITY_ICON_SRC} alt="Sumplexity" className="app-logo-icon" />
          <img src={CLC_LOGO_SRC} alt="CLC" className="app-logo-clc" />
        </button>
        {showCenter ? (
          <div className="workspace-header__title">
            {centerLabel}
            {showCenterChevron ? <span className="workspace-header__title-chevron">▼</span> : null}
          </div>
        ) : null}
        {currentUserEmail ? (
          <div className="workspace-header__actions">
            {typeof onOpenAssistant === 'function' ? (
              <button
                type="button"
                className={`assistant-trigger ${assistantOpen ? 'active' : ''}`}
                onClick={onOpenAssistant}
                title="Open Reggie"
              >
                <span className="reggie-trigger-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2L3 5v5.5C3 15 6.2 18.2 10 19c3.8-.8 7-4 7-8.5V5L10 2z" />
                    <polyline points="6.5,10.5 8.75,12.75 13.5,7.5" />
                  </svg>
                </span>
                Reggie
              </button>
            ) : null}
            <div className="workspace-header__user" title={currentUserEmail || currentUserLabel}>
              <span className="workspace-header__user-avatar">{currentUserInitials}</span>
              <span className="workspace-header__user-name">{currentUserLabel}</span>
              <span className="workspace-header__user-chevron">▼</span>
            </div>
          </div>
        ) : (
          <div />
        )}
      </div>
    </header>
  );
}

AppHeader.propTypes = {
  currentUserEmail: PropTypes.string,
  onHome: PropTypes.func,
  onOpenAssistant: PropTypes.func,
  assistantOpen: PropTypes.bool,
  centerLabel: PropTypes.string,
  showCenter: PropTypes.bool,
  showCenterChevron: PropTypes.bool,
  compact: PropTypes.bool
};

AppHeader.defaultProps = {
  currentUserEmail: '',
  onHome: null,
  onOpenAssistant: null,
  assistantOpen: false,
  centerLabel: 'CLC Inspection Tool',
  showCenter: true,
  showCenterChevron: false,
  compact: false
};
