import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const BASE_URL = import.meta.env.BASE_URL ?? '/';
const SUMPLEXITY_ICON_SRC = `${BASE_URL}assets/sumplexity_icon_logo.png`;
const CLC_LOGO_SRC = `${BASE_URL}assets/clc_logo.png`;

export default function AppHeader({
  currentUserEmail,
  onSignOut,
  onHome,
  onOpenAssistant,
  assistantOpen,
  onToggleNavigation,
  showMenuButton,
  appTitle,
  centerLabel,
  showCenter,
  showCenterChevron,
  compact,
  pageHelpText
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const currentUserLabel = currentUserEmail
    ? currentUserEmail.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Alex Carter';
  const currentUserInitials = currentUserLabel
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'AC';

  useEffect(() => {
    if (!userMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [userMenuOpen]);

  return (
    <header className="workspace-header">
      <div className={`workspace-header__top ${compact ? 'workspace-header__top--compact' : ''}`}>
        <div className="workspace-header__brand">
          {showMenuButton ? (
            <button
              type="button"
              className="workspace-header__menu"
              onClick={onToggleNavigation}
              aria-label="Open navigation menu"
            >
              <span aria-hidden="true">☰</span>
            </button>
          ) : null}
          <button type="button" className="app-logo app-logo--pair app-logo-button" onClick={onHome} aria-label="Go to dashboard">
            <img src={SUMPLEXITY_ICON_SRC} alt="Sumplexity" className="app-logo-icon" />
            <img src={CLC_LOGO_SRC} alt="CLC" className="app-logo-clc" />
            <span className="app-logo-copy">
              <span className="app-logo-title">{appTitle}</span>
            </span>
          </button>
        </div>
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
            <div className="workspace-header__user-wrap" ref={userMenuRef}>
              <button
                type="button"
                className="workspace-header__user"
                title={currentUserEmail || currentUserLabel}
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <span className="workspace-header__user-avatar">{currentUserInitials}</span>
                <span className="workspace-header__user-name">{currentUserLabel}</span>
                <span className="workspace-header__user-chevron">{userMenuOpen ? '▲' : '▼'}</span>
              </button>
              {userMenuOpen ? (
                <div className="workspace-header__user-menu" role="menu">
                  <div className="workspace-header__user-menu-email">{currentUserEmail}</div>
                  {typeof onSignOut === 'function' ? (
                    <button
                      type="button"
                      className="workspace-header__user-menu-item"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSignOut();
                      }}
                    >
                      Log out
                    </button>
                  ) : null}
                </div>
              ) : null}
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
  onSignOut: PropTypes.func,
  onHome: PropTypes.func,
  onOpenAssistant: PropTypes.func,
  assistantOpen: PropTypes.bool,
  onToggleNavigation: PropTypes.func,
  showMenuButton: PropTypes.bool,
  appTitle: PropTypes.string,
  centerLabel: PropTypes.string,
  showCenter: PropTypes.bool,
  showCenterChevron: PropTypes.bool,
  compact: PropTypes.bool,
  pageHelpText: PropTypes.string
};

AppHeader.defaultProps = {
  currentUserEmail: '',
  onSignOut: null,
  onHome: null,
  onOpenAssistant: null,
  assistantOpen: false,
  onToggleNavigation: null,
  showMenuButton: false,
  appTitle: 'CLC Inspection Intelligence',
  centerLabel: '',
  showCenter: true,
  showCenterChevron: false,
  compact: false,
  pageHelpText: ''
};
