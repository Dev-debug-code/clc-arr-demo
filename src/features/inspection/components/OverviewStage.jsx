export default function OverviewStage({
  caseDocumentsLength,
  onGoToDocuments,
  onGoToReport,
  canGoToReport,
  reportBlockedMessage,
  overviewSummaryCards,
  complianceContent,
  allRequirementsMet,
  allRequirementsMetDetail,
  showHighRejectionPrompt,
  onOpenContextNote,
  onDismissHighRejectionPrompt
}) {
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
      {caseDocumentsLength > 0 && allRequirementsMet ? (
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon overview-all-met-icon">✓</div>
          <h3>All assessed requirements met</h3>
          <p>{allRequirementsMetDetail}</p>
          <button type="button" className="btn primary" onClick={onGoToReport}>
            Generate report
          </button>
          {reportBlockedMessage ? <p className="empty-state-helper">{reportBlockedMessage}</p> : null}
        </div>
      ) : null}
      {caseDocumentsLength > 0 && !allRequirementsMet ? (
        <>
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
              <div
                key={`overview-${item.id}`}
                className={`overview-stat-card ${item.tone}`}
              >
                <strong className="overview-stat-card__value">{item.value}</strong>
                <span className="overview-stat-card__label">{item.label}</span>
                <span className="overview-stat-card__detail">{item.detail}</span>
              </div>
            ))}
          </div>
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
