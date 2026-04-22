import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../../../components/AppHeader.jsx';

const BASE_URL = import.meta.env.BASE_URL ?? '/';
const SUMPLEXITY_ICON_SRC = `${BASE_URL}assets/sumplexity_icon_logo.png`;
const CLC_LOGO_SRC = `${BASE_URL}assets/clc_logo.png`;

export default function WorkspaceShell({
  currentUserEmail,
  onHome,
  onSignOut,
  onOpenAssistant,
  assistantOpen,
  appTitle = 'CLC Inspection Intelligence',
  headerContext = '',
  showHeaderContext = true,
  showHeaderContextChevron = false,
  compactHeader = false,
  showNavigationMenu = false,
  navigationCaption = '',
  navigationItems = [],
  activeNavigationId = '',
  pageHelpText = '',
  children,
  afterMain = null
}) {
  const [navOpen, setNavOpen] = useState(false);

  const visibleNavigationItems = useMemo(
    () => (Array.isArray(navigationItems) ? navigationItems.filter(Boolean) : []),
    [navigationItems]
  );

  useEffect(() => {
    if (!showNavigationMenu) {
      setNavOpen(false);
    }
  }, [showNavigationMenu]);

  useEffect(() => {
    if (!navOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setNavOpen(false);
      }
    };

    document.body.classList.add('nav-open');
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('nav-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navOpen]);

  const handleSelectNavigationItem = (item) => {
    if (!item || item.disabled) return;
    item.onSelect?.();
    setNavOpen(false);
  };

  return (
    <div className="arr-app-shell">
      {showNavigationMenu ? (
        <>
          <div
            className={`workspace-drawer-backdrop ${navOpen ? 'open' : ''}`}
            onClick={() => setNavOpen(false)}
            aria-hidden={!navOpen}
          />
          <aside className={`workspace-drawer ${navOpen ? 'open' : ''}`} aria-hidden={!navOpen}>
            <div className="workspace-drawer__header">
              <div className="workspace-drawer__brand">
                <img src={SUMPLEXITY_ICON_SRC} alt="Sumplexity" className="workspace-drawer__logo-icon" />
                <img src={CLC_LOGO_SRC} alt="CLC" className="workspace-drawer__logo-clc" />
              </div>
              <button
                type="button"
                className="workspace-drawer__close"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation menu"
              >
                ×
              </button>
            </div>
            <div className="workspace-drawer__title">{appTitle}</div>
            {navigationCaption ? <div className="workspace-drawer__caption">{navigationCaption}</div> : null}
            {visibleNavigationItems.length > 0 ? (
              <nav className="workspace-drawer__nav" aria-label="Workspace navigation">
                {visibleNavigationItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`workspace-drawer__item ${item.id === activeNavigationId ? 'active' : ''}`}
                    onClick={() => handleSelectNavigationItem(item)}
                    disabled={item.disabled}
                  >
                    <span className="workspace-drawer__item-copy">
                      <span className="workspace-drawer__item-label">{item.label}</span>
                      {item.detail ? <span className="workspace-drawer__item-detail">{item.detail}</span> : null}
                    </span>
                    <span className="workspace-drawer__item-meta">
                      {typeof item.count === 'number' ? <span className="workspace-drawer__item-count">{item.count}</span> : null}
                      {item.showAlert ? <span className="workspace-drawer__item-alert" /> : null}
                    </span>
                  </button>
                ))}
              </nav>
            ) : null}
            {typeof onSignOut === 'function' ? (
              <button type="button" className="workspace-drawer__signout" onClick={onSignOut}>
                Sign out
              </button>
            ) : null}
          </aside>
        </>
      ) : null}
      <AppHeader
        currentUserEmail={currentUserEmail}
        onSignOut={onSignOut}
        onHome={() => {
          setNavOpen(false);
          onHome?.();
        }}
        onOpenAssistant={onOpenAssistant}
        assistantOpen={assistantOpen}
        onToggleNavigation={() => setNavOpen((prev) => !prev)}
        showMenuButton={showNavigationMenu}
        appTitle={appTitle}
        centerLabel={headerContext}
        showCenter={showHeaderContext}
        showCenterChevron={showHeaderContextChevron}
        compact={compactHeader}
        pageHelpText={pageHelpText}
      />
      <main className="workspace-main">
        {children}
      </main>
      {afterMain}
    </div>
  );
}
