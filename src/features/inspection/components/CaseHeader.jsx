import { CASE_TABS } from '../config.js';

export default function CaseHeader({
  currentStep,
  currentCaseMeta,
  renderRiskDots,
  openFindings,
  dataSourceLabel,
  isViewerStep,
  onOpenSearch,
  pendingReprocessSummary,
  reprocessBannerDismissed,
  onReprocessNow,
  activeCaseTabId,
  maxStepUnlocked,
  handleCaseTabNavigate,
  caseTabCounts,
  reportStale
}) {
  if (currentStep < 1) return null;

  return (
    <section className="case-header">
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
        <div className="case-header__stats">
          <span>{openFindings} unreviewed findings</span>
          <span className="panel-subtitle">Data: {dataSourceLabel}</span>
          {isViewerStep ? (
            <button type="button" className="btn btn-xs ghost" onClick={onOpenSearch}>
              🔍 Search
            </button>
          ) : null}
        </div>
      </div>
      {pendingReprocessSummary && !reprocessBannerDismissed ? (
        <div className="reprocess-indicator">
          <span>
            Unprocessed changes pending: {pendingReprocessSummary}. Reprocess when ready.
          </span>
          <button type="button" className="btn btn-xs secondary" onClick={onReprocessNow}>
            Reprocess now
          </button>
        </div>
      ) : null}
      <div className="case-header__tabs" role="tablist" aria-label="Case views">
        {CASE_TABS.map((tab) => {
          const isActive = activeCaseTabId === tab.id;
          const isUnlocked = tab.step <= maxStepUnlocked;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className={`case-tab${isActive ? ' active' : ''}`}
              aria-selected={isActive}
              disabled={!isUnlocked}
              onClick={() => handleCaseTabNavigate(tab.step)}
            >
              {tab.label}
              {Object.prototype.hasOwnProperty.call(caseTabCounts, tab.id) ? (
                <span className="case-tab-count">({caseTabCounts[tab.id]})</span>
              ) : null}
              {tab.id === 'report' && reportStale && !isActive ? <span className="stale-dot" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
