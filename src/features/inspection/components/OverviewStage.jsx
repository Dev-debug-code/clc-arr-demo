export default function OverviewStage({
  caseDocumentsLength,
  onGoToDocuments,
  onGoToReport,
  onClearFindingFilters,
  reportBlockedMessage,
  overviewSummaryCards,
  complianceContent,
  allRequirementsMet,
  allRequirementsMetDetail,
  showHighRejectionPrompt,
  onOpenContextNote,
  onDismissHighRejectionPrompt
}) {
  const hasActiveFindingFilter = overviewSummaryCards.some((item) => item.active);

  return (
    <div className="stage-card">
      {caseDocumentsLength === 0 ? (
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon">🗂️</div>
          <h3>Upload documents to begin your inspection</h3>
          <p>No documents have been uploaded for this case yet.</p>
          <button type="button" className="btn primary" onClick={onGoToDocuments}>
            Go to Documents tab
          </button>
        </div>
      ) : null}
      {caseDocumentsLength > 0 ? (
        <>
          {allRequirementsMet ? (
            <div className="alert-banner success findings-summary-banner">
              <div className="findings-summary-banner__copy">
                <strong>All assessed requirements met</strong>
                <span>{allRequirementsMetDetail}</span>
              </div>
              <button type="button" className="btn primary btn-sm" onClick={onGoToReport}>
                Generate report
              </button>
            </div>
          ) : null}
          {showHighRejectionPrompt ? (
            <div className="alert-banner info">
              <span>
                You&apos;ve rejected a significant number of findings. Adding a case context note may
                help improve accuracy.
              </span>
              <div className="alert-inline-actions">
                <button type="button" className="btn btn-tertiary btn-sm" onClick={onOpenContextNote}>
                  Add context note
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onDismissHighRejectionPrompt}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
          <div className="summary-grid overview-summary-grid">
            {overviewSummaryCards.map((item) => (
              <button
                type="button"
                key={`overview-${item.id}`}
                className={`overview-stat-card ${item.tone}${item.active ? ' active' : ''}`}
                onClick={item.onClick}
                aria-pressed={item.active}
              >
                <strong className="overview-stat-card__value">{item.value}</strong>
                <span className="overview-stat-card__label">{item.label}</span>
                <span className="overview-stat-card__detail">{item.detail}</span>
              </button>
            ))}
          </div>
          {hasActiveFindingFilter ? (
            <button type="button" className="btn btn-xs ghost overview-filter-clear-btn" onClick={onClearFindingFilters}>
              Show all findings
            </button>
          ) : null}
          {complianceContent}
          <div className="bottom-actions">
            <button type="button" className="btn primary" onClick={onGoToReport}>
              Generate report
            </button>
          </div>
          {reportBlockedMessage ? <p className="empty-state-helper">{reportBlockedMessage}</p> : null}
        </>
      ) : null}
    </div>
  );
}
