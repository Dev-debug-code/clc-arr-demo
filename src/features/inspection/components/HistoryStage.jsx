export default function HistoryStage({
  reportPendingChanges,
  pendingReprocessSummary,
  onReprocessNow,
  currentCaseMeta,
  hasInspectionHistory,
  historyTrendRows,
  historyFindingsRows,
  currentCaseOutcome,
  formatOutcomeLabel,
  reviewedCount,
  availableFindingsCount,
  recurringFindingCount,
  onBackToOverview,
  onOpenReport
}) {
  return (
    <div className="stage-card">
      {reportPendingChanges ? (
        <div className="reprocess-indicator">
          <span>
            ⚠ Unprocessed changes pending
            {pendingReprocessSummary ? ` — ${pendingReprocessSummary}` : ''}
          </span>
          <button type="button" className="btn btn-xs secondary" onClick={onReprocessNow}>
            Reprocess now
          </button>
        </div>
      ) : null}
      <h2>Inspection History — {currentCaseMeta.practiceName}</h2>
      <p className="panel-subtitle">
        Practice inspection history and recurring compliance signals across inspections.
      </p>
      {!hasInspectionHistory ? (
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon">📋</div>
          <h3>Building your inspection history.</h3>
          <p>This is the first recorded inspection for this practice in-system.</p>
          <p className="panel-subtitle">
            Previous inspection: {currentCaseMeta.previousInspection || 'Not recorded'}
          </p>
          <ul className="history-coming-list">
            <li>Side-by-side compliance trend comparison</li>
            <li>Recurring issue detection across inspections</li>
            <li>Resolution tracking for action plan items</li>
            <li>Cross-year timeline activity view</li>
          </ul>
        </div>
      ) : null}
      {hasInspectionHistory ? (
        <>
          <section className="panel history-trend-card">
            <h3>Compliance Trend by Code Area</h3>
            {historyTrendRows.length === 0 ? (
              <p className="panel-subtitle">No code area trends yet. Run processing to populate this view.</p>
            ) : (
              historyTrendRows.map((row) => (
                <div key={`history-trend-${row.id}`} className="history-trend-row">
                  <span>{row.name}</span>
                  <span className="panel-subtitle">{row.summary}</span>
                  <span className={`review-pill ${row.trendClass}`}>{row.trendLabel}</span>
                </div>
              ))
            )}
          </section>
          <section className="panel history-trend-card">
            <h3>Previous Findings</h3>
            <div className="docs-table">
              <div className="docs-table__row docs-table__row--head">
                <span>Finding</span>
                <span>Code Area</span>
                <span>Severity</span>
                <span>Resolution</span>
                <span>Pattern</span>
              </div>
              {historyFindingsRows.length === 0 ? (
                <div className="docs-table__row">
                  <span>No findings tracked yet</span>
                  <span>—</span>
                  <span>—</span>
                  <span>—</span>
                  <span>—</span>
                </div>
              ) : (
                historyFindingsRows.map((row) => (
                  <div key={`history-row-${row.id}`} className="docs-table__row">
                    <span>{row.title}</span>
                    <span>{row.codeArea}</span>
                    <span
                      className={`review-pill ${
                        row.severity === 'Critical'
                          ? 'rejected'
                          : row.severity === 'Guidance'
                            ? 'dismissed'
                            : 'accepted'
                      }`}
                    >
                      {row.severity}
                    </span>
                    <span
                      className={`review-pill ${
                        row.resolution === 'Accepted'
                          ? 'accepted'
                          : row.resolution === 'Rejected'
                            ? 'rejected'
                            : row.resolution === 'Dismissed'
                              ? 'dismissed'
                              : 'pending'
                      }`}
                    >
                      {row.resolution}
                    </span>
                    <span className={row.recurring ? 'recurring-badge' : 'panel-subtitle'}>
                      {row.recurring ? 'Recurring' : '—'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="panel history-trend-card">
            <h3>Last inspection summary</h3>
            <div className="history-summary-grid">
              <div>
                <span className="history-summary-label">Date</span>
                <strong>{currentCaseMeta.previousInspection || 'Not recorded'}</strong>
              </div>
              <div>
                <span className="history-summary-label">Outcome</span>
                <strong>{formatOutcomeLabel(currentCaseOutcome)}</strong>
              </div>
              <div>
                <span className="history-summary-label">Actions completed</span>
                <strong>{reviewedCount} / {Math.max(availableFindingsCount, 1)}</strong>
              </div>
              <div>
                <span className="history-summary-label">Recurring findings</span>
                <strong>{recurringFindingCount}</strong>
              </div>
            </div>
          </section>
          <p className="panel-subtitle">
            Case activity and audit actions are logged separately and are not surfaced in this
            workspace.
          </p>
        </>
      ) : null}
      <div className="action-bar">
        <button type="button" className="btn ghost" onClick={onBackToOverview}>
          ← Back to Overview
        </button>
        <button type="button" className="btn primary" onClick={onOpenReport}>
          Open Report →
        </button>
      </div>
    </div>
  );
}
