export default function DashboardPage({
  dashboardScopeRoleLabel,
  dashboardScopeTitle,
  hasTeamCaseAccess,
  dashboardRoleNote,
  onOpenNewCase,
  teamView,
  setDashboardView,
  dashboardCases,
  scopedActiveCaseCount,
  dashboardScopeSummary,
  dashboardSearch,
  setDashboardSearch,
  dashboardDateFilter,
  setDashboardDateFilter,
  dashboardOutcomeFilter,
  setDashboardOutcomeFilter,
  dashboardInspectorFilter,
  setDashboardInspectorFilter,
  dashboardInspectorOptions,
  clearDashboardFilters,
  showCompletedCases,
  setShowCompletedCases,
  scopedUnreviewedCount,
  scopedIdleOver7DaysCount,
  dashboardAttentionItems,
  handleOpenCase,
  dashboardIsBusy,
  dashboardError,
  visibleDashboardCases,
  renderRiskDots,
  dashboardCompletedCases,
  showRecentlyCompleted,
  setShowRecentlyCompleted,
  formatOutcomeLabel
}) {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <div className="dashboard-header__eyebrow">
            <span className="dashboard-role-pill">{dashboardScopeRoleLabel}</span>
          </div>
          <h1>{dashboardScopeTitle}</h1>
          <p>
            {hasTeamCaseAccess
              ? 'Switch between your own caseload and the wider team view.'
              : 'Review your assigned cases and start new inspections.'}
          </p>
          {dashboardRoleNote ? <p className="dashboard-role-note">{dashboardRoleNote}</p> : null}
        </div>
        <div className="dashboard-header__actions">
          <button type="button" className="btn primary" onClick={onOpenNewCase}>
            + New Case
          </button>
        </div>
      </div>

      {hasTeamCaseAccess ? (
        <div className="dashboard-view-toggle">
          <button
            type="button"
            className={`dashboard-view-toggle__btn ${!teamView ? 'active' : ''}`}
            onClick={() => setDashboardView(false)}
          >
            My Cases
          </button>
          <button
            type="button"
            className={`dashboard-view-toggle__btn ${teamView ? 'active' : ''}`}
            onClick={() => setDashboardView(true)}
          >
            Team Cases <span className="tab-count-badge">({dashboardCases.length})</span>
          </button>
        </div>
      ) : (
        <div className="dashboard-inspector-heading">My Cases</div>
      )}

      <div className="dashboard-active-indicator">
        <strong>{scopedActiveCaseCount}</strong>
        <span>{dashboardScopeSummary}</span>
      </div>

      <div className="dashboard-filters">
        <input
          type="text"
          placeholder="Search by practice name..."
          value={dashboardSearch}
          onChange={(event) => setDashboardSearch(event.target.value)}
        />
        <select value={dashboardDateFilter} onChange={(event) => setDashboardDateFilter(event.target.value)}>
          <option>All</option>
          <option>This week</option>
          <option>This month</option>
          <option>Last 3 months</option>
        </select>
        <select value={dashboardOutcomeFilter} onChange={(event) => setDashboardOutcomeFilter(event.target.value)}>
          <option>All</option>
          <option>In progress</option>
          <option>Compliant</option>
          <option>Generally compliant</option>
          <option>Non-compliant</option>
        </select>
        {hasTeamCaseAccess && teamView ? (
          <select
            value={dashboardInspectorFilter}
            onChange={(event) => setDashboardInspectorFilter(event.target.value)}
          >
            <option>All inspectors</option>
            {dashboardInspectorOptions.map((name) => (
              <option key={`inspector-${name}`} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : null}
        <button type="button" className="btn ghost" onClick={clearDashboardFilters}>
          Clear all
        </button>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showCompletedCases}
            onChange={(event) => setShowCompletedCases(event.target.checked)}
          />
          <span>Show completed</span>
        </label>
      </div>

      {hasTeamCaseAccess && teamView ? (
        <>
          <div className="team-quick-stats">
            <div>
              <span className="history-summary-label">Team active cases</span>
              <strong>{scopedActiveCaseCount}</strong>
            </div>
            <div>
              <span className="history-summary-label">Unreviewed findings</span>
              <strong>{scopedUnreviewedCount}</strong>
            </div>
            <div>
              <span className="history-summary-label">Cases idle &gt; 7 days</span>
              <strong>{scopedIdleOver7DaysCount}</strong>
            </div>
          </div>
          <div className="dashboard-attention">
            <strong>Attention Needed</strong>
            {dashboardAttentionItems.length === 0 ? (
              <p>No current cases match the attention rules.</p>
            ) : (
              dashboardAttentionItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="dashboard-attention-link"
                  onClick={() => {
                    const targetCase = dashboardCases.find((entry) => entry.id === item.caseId);
                    if (targetCase) {
                      handleOpenCase(targetCase);
                    }
                  }}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        </>
      ) : null}

      <div className="dashboard-cases">
        {dashboardIsBusy ? (
          <div className="alert alert-warning small">Loading cases from data provider...</div>
        ) : null}
        {dashboardError ? <div className="alert alert-warning small">{dashboardError}</div> : null}
        {!dashboardIsBusy && visibleDashboardCases.length === 0 ? (
          <div className="edge-empty-card dashboard-empty-card">
            <div className="edge-empty-card__icon">📂</div>
            <h3>No cases match your filters.</h3>
            <p>Try broadening search criteria or clearing filters.</p>
            <button type="button" className="btn btn-xs secondary" onClick={clearDashboardFilters}>
              Clear all filters
            </button>
          </div>
        ) : null}
        {visibleDashboardCases.map((item) => (
          <button key={item.id} type="button" className="dashboard-case-card" onClick={() => handleOpenCase(item)}>
            <div className="dashboard-case-card__top">
              <h3>{item.practice}</h3>
              <span>{item.id}</span>
            </div>
            <p className="dashboard-case-card__meta">Started: {item.started}</p>
            <div className="dashboard-progress">
              <div className="dashboard-progress__track">
                <div className="dashboard-progress__fill" style={{ width: `${item.progress}%` }} />
              </div>
              <span>{item.progressLabel}</span>
            </div>
            <p className="dashboard-case-card__meta">
              {item.unreviewed} unreviewed · {item.leads} leads · {item.goodPractice} good practice
            </p>
            <p className="dashboard-case-card__meta">
              Risk: {renderRiskDots(item.risk)} {item.risk} · Last activity: {item.lastActivity}
              {teamView ? ` · Inspector: ${item.inspector}` : ''}
            </p>
          </button>
        ))}
      </div>
      {dashboardCompletedCases.length > 0 ? (
        <div className="dashboard-recently-completed">
          <button
            type="button"
            className="dashboard-recently-completed__toggle"
            onClick={() => setShowRecentlyCompleted((prev) => !prev)}
          >
            {showRecentlyCompleted ? '▾' : '▸'} Recently Completed ({dashboardCompletedCases.length})
          </button>
          {showRecentlyCompleted ? (
            <div className="dashboard-completed-list">
              {dashboardCompletedCases.map((item) => (
                <button
                  key={`completed-${item.id}`}
                  type="button"
                  className="dashboard-case-card completed"
                  onClick={() => handleOpenCase(item)}
                >
                  <div className="dashboard-case-card__top">
                    <h3>{item.practice}</h3>
                    <span>{item.id}</span>
                  </div>
                  <p className="dashboard-case-card__meta">
                    Outcome:{' '}
                    <span className="completed-outcome-badge">
                      {formatOutcomeLabel(item.outcome)}
                    </span>{' '}
                    · Last activity: {item.lastActivity}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
