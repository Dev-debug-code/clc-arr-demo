const parseCurrentTrendMetrics = (summary) => {
  const match = String(summary || '').match(/(\d+)\s*\/\s*(\d+)/);
  const met = match ? Number(match[1]) : 0;
  const total = match ? Number(match[2]) : 0;
  const percent = total > 0 ? Math.round((met / total) * 100) : 0;
  return { met, total, percent };
};

const getTrendBadgeLabel = (trendLabel) => {
  if (trendLabel === 'Stable') return '→ Stable';
  if (trendLabel === 'Monitoring') return '→ Monitoring';
  return '↓ Attention needed';
};

const getTrendBadgeClassName = (trendClass) => {
  if (trendClass === 'accepted') return 'trend-badge-stable';
  if (trendClass === 'dismissed') return 'trend-badge-monitoring';
  return 'trend-badge-declining';
};

const getOutcomeBadgeClassName = (outcome) => {
  const value = String(outcome || '').trim().toLowerCase();
  if (value === 'compliant') return 'accepted';
  if (value === 'generally_compliant') return 'dismissed';
  if (value === 'non_compliant') return 'rejected';
  return 'pending';
};

const getPreviousFindingStatus = (row) => {
  if (row.severity === 'Good Practice') {
    return {
      label: 'Good Practice',
      detail: '',
      className: 'finding-status-good'
    };
  }

  const isResolved = row.resolution === 'Accepted' || row.resolution === 'Dismissed';
  return {
    label: 'Attention',
    detail: isResolved ? 'Resolved' : 'Unresolved',
    className: isResolved ? 'finding-status-attention' : 'finding-status-unresolved'
  };
};

const renderCurrentFindingStatus = (row) => {
  if (row.recurring) {
    return (
      <span className="finding-current-recurring">
        <span className="badge-recurring">↻ Recurring</span>
      </span>
    );
  }

  if (row.severity === 'Good Practice') {
    return <span className="finding-current-strong">★ Still strong</span>;
  }

  return <span className="finding-current-none">—</span>;
};

export default function HistoryStage({
  reportPendingChanges,
  pendingReprocessSummary,
  onReprocessNow,
  onOpenHistoryFinding,
  currentCaseMeta,
  hasInspectionHistory,
  historyTrendRows,
  historyFindingsRows,
  currentCaseOutcome,
  formatOutcomeLabel,
  reviewedCount,
  availableFindingsCount
}) {
  const previousInspectionLabel = currentCaseMeta.previousInspection
    ? `${currentCaseMeta.previousInspection} (pre-system)`
    : 'Not recorded';
  void reportPendingChanges;
  void pendingReprocessSummary;
  void onReprocessNow;
  const attentionFindingCount = historyFindingsRows.filter((row) => row.severity !== 'Good Practice').length;
  const goodPracticeCount = historyFindingsRows.filter((row) => row.severity === 'Good Practice').length;
  const actionPlanTotal = Math.max(availableFindingsCount, 0);
  const actionPlanPercent = actionPlanTotal > 0 ? Math.round((reviewedCount / actionPlanTotal) * 100) : 0;

  return (
    <div className="stage-card">
      {!hasInspectionHistory ? (
        <div className="empty-state-wrapper">
          <div className="panel empty-state-card">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">Building your inspection history.</div>
            <div className="empty-state-body">
              The data from this inspection will power trend analysis, recurring issue detection, and resolution
              tracking from your next inspection of this practice onwards.
            </div>
            <div className="empty-state-previous">Previous inspection: {previousInspectionLabel}</div>
            <div className="empty-state-list-title">What's coming:</div>
            <ul className="empty-state-list compact">
              <li>Side-by-side compliance trends across inspections</li>
              <li>Automatic flagging of recurring issues</li>
              <li>Resolution tracking for action plan items</li>
              <li>Full case timeline across inspection years</li>
            </ul>
          </div>
        </div>
      ) : null}
      {hasInspectionHistory ? (
        <div className="history-content">
          <div className="page-title">Inspection History — {currentCaseMeta.practiceName}</div>

          <div className="section-heading">
            <h3>Compliance Trend by Code Area</h3>
          </div>
          <section className="panel history-trend-card history-trend-card--detailed">
            {historyTrendRows.length === 0 ? (
              <p className="panel-subtitle">No code area trends yet. Run processing to populate this view.</p>
            ) : (
              historyTrendRows.map((row) => {
                const metrics = parseCurrentTrendMetrics(row.summary);
                return (
                  <div key={`history-trend-${row.id}`} className="trend-row">
                    <div className="trend-label">{row.name}</div>
                    <div className="trend-bars">
                      <div className="trend-bar-group">
                        <div className="trend-bar-label">Previous</div>
                        <div className="trend-bar-track">
                          <div className="trend-bar-fill previous" style={{ width: '0%' }} />
                        </div>
                        <div className="trend-bar-count">Not recorded</div>
                      </div>
                      <div className="trend-arrow">→</div>
                      <div className="trend-bar-group">
                        <div className="trend-bar-label">Current</div>
                        <div className="trend-bar-track">
                          <div
                            className={`trend-bar-fill ${
                              row.trendClass === 'rejected' ? 'current-bad' : 'current-good'
                            }`}
                            style={{ width: `${metrics.percent}%` }}
                          />
                        </div>
                        <div className="trend-bar-count">
                          {metrics.met}/{Math.max(metrics.total, 1)} ({metrics.percent}%)
                        </div>
                      </div>
                    </div>
                    <div className="trend-badge">
                      <span className={getTrendBadgeClassName(row.trendClass)}>
                        {getTrendBadgeLabel(row.trendLabel)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <div className="section-heading">
            <h3>Last Inspection Summary</h3>
          </div>
          <section className="panel history-summary-card">
            <div className="summary-row">
              <div className="summary-item">
                <div className="summary-item-label">Last Inspection</div>
                <div className="summary-item-value">{currentCaseMeta.previousInspection || 'Not recorded'}</div>
              </div>
              <div className="summary-item">
                <div className="summary-item-label">Outcome</div>
                <div className="summary-item-value">
                  <span className={`review-pill ${getOutcomeBadgeClassName(currentCaseOutcome)}`}>
                    {formatOutcomeLabel(currentCaseOutcome)}
                  </span>
                </div>
              </div>
              <div className="summary-item">
                <div className="summary-item-label">Key Findings</div>
                <div className="summary-item-value">
                  {attentionFindingCount} attention areas, {goodPracticeCount} good practice
                </div>
              </div>
              <div className="summary-item">
                <div className="summary-item-label">Action Plan</div>
                <div className="summary-item-value">
                  <div className="action-progress">
                    <span>
                      {reviewedCount} of {actionPlanTotal} actions completed
                    </span>
                    <span className="text-small">({actionPlanPercent}%)</span>
                  </div>
                  <div className="action-progress-bar">
                    <div className="progress-track">
                      <div className="progress-bar" style={{ width: `${actionPlanPercent}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="section-heading">
            <h3>Previous Findings</h3>
          </div>
          <section className="panel history-findings-card">
            <div className="history-findings-table-wrap">
              <table className="history-findings-table">
                <thead>
                  <tr>
                    <th>Finding</th>
                    <th>Previous Status</th>
                    <th>Current</th>
                  </tr>
                </thead>
                <tbody>
                  {historyFindingsRows.length === 0 ? (
                    <tr>
                      <td>No findings tracked yet</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  ) : (
                    historyFindingsRows.map((row) => {
                      const previousStatus = getPreviousFindingStatus(row);
                      const isClickable = row.recurring || row.severity === 'Good Practice';
                      return (
                        <tr
                          key={`history-row-${row.id}`}
                          className={isClickable ? 'clickable-row' : ''}
                          onClick={isClickable ? () => onOpenHistoryFinding(row.id) : undefined}
                        >
                          <td className="finding-name">{row.title}</td>
                          <td>
                            <span className={previousStatus.className}>{previousStatus.label}</span>
                            {previousStatus.detail ? (
                              <span className="finding-status-detail"> — {previousStatus.detail}</span>
                            ) : null}
                          </td>
                          <td>{renderCurrentFindingStatus(row)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
