import AppHeader from '../../../components/AppHeader.jsx';

export default function WorkspaceShell({
  currentUserEmail,
  onHome,
  onSignOut,
  onOpenAssistant,
  assistantOpen,
  headerTitle = 'CLC Inspection Tool',
  showHeaderTitle = true,
  showHeaderTitleChevron = false,
  compactHeader = false,
  children,
  afterMain = null
}) {
  return (
    <div className="arr-app-shell">
      <AppHeader
        currentUserEmail={currentUserEmail}
        onHome={onHome}
        onOpenAssistant={onOpenAssistant}
        assistantOpen={assistantOpen}
        centerLabel={headerTitle}
        showCenter={showHeaderTitle}
        showCenterChevron={showHeaderTitleChevron}
        compact={compactHeader}
      />
      <main className="workspace-main">
        {children}
      </main>
      {afterMain}
    </div>
  );
}
