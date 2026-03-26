export default function OverviewStage({
  caseDocumentsLength,
  onGoToDocuments,
  overviewSummaryCards,
  complianceContent,
  onGoToReport,
  canGoToReport
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
      {caseDocumentsLength > 0 ? (
        <>
          <div className="summary-grid overview-summary-grid">
            {overviewSummaryCards.map((item) => (
              <button
                key={`overview-${item.id}`}
                type="button"
                className={`overview-stat-card ${item.tone}${item.active ? ' active' : ''}`}
                onClick={item.onClick ?? onGoToDocuments}
              >
                <strong className="overview-stat-card__value">{item.value}</strong>
                <span className="overview-stat-card__label">{item.label}</span>
                <span className="overview-stat-card__detail">{item.detail}</span>
              </button>
            ))}
          </div>
          {complianceContent}
          <div className="action-bar">
            <button type="button" className="btn ghost" onClick={onGoToDocuments}>
              ← Back to Documents
            </button>
            <button type="button" className="btn primary" onClick={onGoToReport} disabled={!canGoToReport}>
              Go to Report →
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
