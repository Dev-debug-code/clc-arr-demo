import AppHeader from '../../../components/AppHeader.jsx';
import StepTimeline from '../../../components/StepTimeline.jsx';

export default function WorkspaceShell({
  darkMode,
  currentUserEmail,
  onSignOut,
  onToggleDarkMode,
  onOpenAssistant,
  assistantOpen,
  workflowTimelineStep,
  workflowSteps,
  children,
  afterMain = null
}) {
  return (
    <div className={`arr-app-shell ${darkMode ? 'dark-mode' : ''}`}>
      <AppHeader
        currentUserEmail={currentUserEmail}
        onSignOut={onSignOut}
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        onOpenAssistant={onOpenAssistant}
        assistantOpen={assistantOpen}
      />
      <main className="workspace-main">
        <StepTimeline steps={workflowSteps} currentStep={workflowTimelineStep} />
        {children}
      </main>
      {afterMain}
    </div>
  );
}
