import { CASE_TABS } from '../config.js';

export default function CaseHeader({
  currentStep,
  currentCaseMeta,
  renderRiskDots,
  pendingReprocessSummary,
  reprocessBannerDismissed,
  onReprocessNow,
  activeCaseTabId,
  maxStepUnlocked,
  handleCaseTabNavigate,
  caseTabCounts,
  reportStale
}) {
  return (
    <section className="case-header">
      {currentCaseMeta?.caseId ? (
        <div className="case-header__top">
          <div>
            <h2 className="case-header__title">{currentCaseMeta.practiceName}</h2>
            <p className="case-header__meta">
              <code>{currentCaseMeta.caseId}</code> • Risk: {renderRiskDots(currentCaseMeta.riskLevel)} {currentCaseMeta.riskLevel} • Previous:{' '}
              {currentCaseMeta.previousInspection}
            </p>
            <p className="case-header__meta">
              HoLP: {currentCaseMeta.holp} • HoFA: {currentCaseMeta.hofa} • Inspector: {currentCaseMeta.owner}
            </p>
          </div>
        </div>
      ) : (
        <div className="case-header__top">
          <div>
            <h2 className="case-header__title">New Inspection Case</h2>
            <p className="case-header__meta">
              Complete the setup form below to create a new inspection case. Select a practice, configure risk and scope, then click Create Case when ready.
            </p>
          </div>
        </div>
      )}
      <div className="case-header__tabs" role="tablist" aria-label="Case views">
        {CASE_TABS.filter((tab) => tab.step <= maxStepUnlocked).map((tab) => {
          const isActive = activeCaseTabId === tab.id;
          return (
            <div
              key={tab.id}
              role="tab"
              className={`case-tab${isActive ? ' active' : ''}`}
              aria-selected={isActive}
              aria-disabled={false}
              tabIndex={0}
              onClick={() => {
                handleCaseTabNavigate(tab.step);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleCaseTabNavigate(tab.step);
                }
              }}
            >
              {tab.label}
              {Object.prototype.hasOwnProperty.call(caseTabCounts, tab.id) ? (
                <span className="case-tab-count">({caseTabCounts[tab.id]})</span>
              ) : null}
              {tab.id === 'report' && reportStale && !isActive ? <span className="stale-dot" /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
