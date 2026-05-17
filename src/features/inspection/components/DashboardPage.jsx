export default function DashboardPage({
  hasTeamCaseAccess,
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
  dashboardAttentionItems,
  handleOpenCase,
  handleOpenCompletedCase,
  dashboardIsBusy,
  dashboardError,
  visibleDashboardCases,
  renderRiskDots,
  dashboardCompletedCases,
  showRecentlyCompleted,
  setShowRecentlyCompleted,
  formatOutcomeLabel
}) {
  const hasActiveFilters =
    dashboardSearch.trim().length > 0 ||
    dashboardDateFilter !== 'All' ||
    dashboardOutcomeFilter !== 'All' ||
    (hasTeamCaseAccess && teamView && dashboardInspectorFilter !== 'All inspectors');

  return (
    <div className="dashboard-shell">
      {hasTeamCaseAccess ? (
        <div className="dashboard-view-toggle">
          <div
            className={`dashboard-view-toggle__btn ${!teamView ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => setDashboardView(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setDashboardView(false);
              }
            }}
          >
            My Cases
          </div>
          <div
            className={`dashboard-view-toggle__btn ${teamView ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => setDashboardView(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setDashboardView(true);
              }
            }}
          >
            Team Cases <span className="tab-count-badge">({dashboardCases.length})</span>
          </div>
        </div>
      ) : (
        <h1 className="dashboard-page-title">My Cases</h1>
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
        {hasTeamCaseAccess && teamView ? (
          <select
            value={dashboardInspectorFilter}
            onChange={(event) => setDashboardInspectorFilter(event.target.value)}
          >
            <option value="All inspectors">All inspectors</option>
            {dashboardInspectorOptions.map((name) => (
              <option key={`inspector-${name}`} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : null}
        <select value={dashboardDateFilter} onChange={(event) => setDashboardDateFilter(event.target.value)}>
          <option value="All">All dates</option>
          <option value="This week">This week</option>
          <option value="This month">This month</option>
          <option value="Last 3 months">Last 3 months</option>
        </select>
        <select value={dashboardOutcomeFilter} onChange={(event) => setDashboardOutcomeFilter(event.target.value)}>
          <option value="All">All outcomes</option>
          <option value="In progress">In progress</option>
          <option value="Compliant">Compliant</option>
          <option value="Generally compliant">Generally compliant</option>
          <option value="Non-compliant">Non-compliant</option>
        </select>
        <button
          type="button"
          className="btn ghost"
          onClick={clearDashboardFilters}
          disabled={!hasActiveFilters}
          style={!hasActiveFilters ? { opacity: 0.4 } : undefined}
        >
          Clear all
        </button>
      </div>

      {hasTeamCaseAccess && teamView ? (
        <div className="dashboard-attention">
          <strong>Attention Needed</strong>
          {dashboardAttentionItems.length === 0 ? (
            <p>No current cases match the attention rules.</p>
          ) : (
            dashboardAttentionItems.map((item) => (
              <div
                key={item.id}
                className="alert alert-warning attention-card"
              >
                <div className="attention-card-text">
                  <strong>{item.practice}</strong>: {item.message}
                </div>
                <div className="attention-card-assigned">Assigned to: {item.assignedTo || 'Unassigned'}</div>
              </div>
            ))
          )}
        </div>
      ) : null}

      <div className="section-heading">
        <h2>Active Cases</h2>
        <button type="button" className="btn primary" onClick={onOpenNewCase}>
          + New Case
        </button>
      </div>

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
          <div
            key={item.id}
            className="dashboard-case-card"
            role="button"
            tabIndex={0}
            onClick={() => handleOpenCase(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleOpenCase(item);
              }
            }}
          >
            <div className="dashboard-case-card__top">
              <div>
                <h3>{item.practice}</h3>
                <span>{item.id}</span>
              </div>
              <div className="dashboard-case-card__top-meta">
                <span>Started {item.started}</span>
              </div>
            </div>
            <div className="dashboard-progress">
              <div className="dashboard-progress__track">
                <div className="dashboard-progress__fill" style={{ width: `${item.progress}%` }} />
              </div>
              <span>{item.progressLabel}</span>
            </div>
            <p className="dashboard-case-card__meta">
              {item.unreviewed > 0 || item.leads > 0
                ? `(${item.unreviewed}) unreviewed · (${item.leads}) requires review · ${item.goodPractice} good practice`
                : 'All reviewed ✓'}
            </p>
            <p className="dashboard-case-card__meta">
              Risk: {renderRiskDots(item.risk)} {item.risk} · Last activity: {item.lastActivity}
              {teamView ? ` · Assigned to: ${item.inspector}` : ''}
            </p>
          </div>
        ))}
      </div>

      {dashboardCompletedCases.length > 0 ? (
        <div className="dashboard-recently-completed">
          <div
            className="dashboard-recently-completed__toggle"
            role="button"
            tabIndex={0}
            onClick={() => setShowRecentlyCompleted((prev) => !prev)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setShowRecentlyCompleted((prev) => !prev);
              }
            }}
          >
            {showRecentlyCompleted ? '▾' : '▸'} Recently Completed ({dashboardCompletedCases.length})
          </div>
          {showRecentlyCompleted ? (
            <div className="dashboard-completed-list">
              {dashboardCompletedCases.map((item) => (
                <div
                  key={`completed-${item.id}`}
                  className="dashboard-case-card completed"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenCompletedCase(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleOpenCompletedCase(item);
                    }
                  }}
                >
                  <div className="dashboard-case-card__top">
                    <div>
                      <h3>{item.practice}</h3>
                      <span>{item.id}</span>
                    </div>
                    <div className="dashboard-case-card__top-meta">
                      <span>Completed {item.lastActivity}</span>
                    </div>
                  </div>
                  <p className="dashboard-case-card__meta">
                    Outcome: <span className="completed-outcome-badge">{formatOutcomeLabel(item.outcome)}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
