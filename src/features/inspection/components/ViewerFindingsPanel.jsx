import {
  DISMISS_REASON_OPTIONS,
  RECURRING_FINDING_IDS,
  REVIEW_REASON_OPTIONS,
  STEP_OVERVIEW,
  STEP_VIEWER,
  VIEWER_CODE_AREA_FILTERS
} from '../config.js';

export default function ViewerFindingsPanel({
  findingsForActiveDocument,
  totalFindingsForActiveDocument,
  severityFilterRef,
  filterSeverity,
  setSeverityFilterOpen,
  severityFilterOpen,
  severityCounts,
  severityLabelMap,
  handleToggleFilter,
  setFilterSeverity,
  viewerTypeFilterRef,
  findingViewFilters,
  setViewerTypeFilterOpen,
  viewerTypeFilterOpen,
  findingFilterLabelMap,
  toggleFindingViewFilter,
  clearFindingViewFilters,
  viewerCodeAreaFilterRef,
  viewerCodeAreaFilter,
  setViewerCodeAreaFilterOpen,
  viewerCodeAreaFilterOpen,
  setViewerCodeAreaFilter,
  activeSeverityLabels,
  hiddenForActiveDocument,
  documentsById,
  getFindingBucketId,
  activeFindingId,
  setActiveFindingId,
  expandedViewerFindingIds,
  setExpandedViewerFindingIds,
  findingDecisions,
  isLeadFindingByTaxonomy,
  isInspectorAddedFinding,
  findingSeverityBadgeMap,
  findingEvidenceStrengthMap,
  buildEvidencePassages,
  findingRefs,
  currentCaseMeta,
  activeMenuFindingId,
  setActiveMenuFindingId,
  findingMenuRef,
  handleRequestFindingDecision,
  handleDeleteFinding,
  handleJumpToRequirement,
  formatReferenceText,
  openLeadConfirmModal,
  inlineRejectFindingId,
  inlineRejectReason,
  setInlineRejectReason,
  inlineRejectNote,
  setInlineRejectNote,
  handleConfirmInlineReject,
  setInlineRejectFindingId,
  inlineDismissFindingId,
  inlineDismissReason,
  setInlineDismissReason,
  inlineDismissNote,
  setInlineDismissNote,
  handleConfirmInlineDismiss,
  setInlineDismissFindingId,
  safeText,
  findingReferencesDocument,
  activeDocId,
  getFindingPreferredBoxIdForDocument,
  handleSelectDocBox,
  handleViewDocument
}) {
  const hasActiveTypeFilters = findingViewFilters.length > 0;
  const activeTypeLabels = findingViewFilters.map((filterKey) => {
    return (
      {
        non_compliant: 'Non-compliant',
        compliant: 'Compliant',
        good_practice: 'Good Practice',
        leads: 'Leads',
        inspector_added: 'Inspector-added',
        reviewed: 'Reviewed',
        unreviewed: 'Unreviewed'
      }[filterKey] ?? findingFilterLabelMap[filterKey] ?? filterKey
    );
  });
  const viewerSeverityLabels = filterSeverity.map((key) => {
    if (key === 'critical') return 'Critical';
    if (key === 'warning') return 'Guidance';
    return severityLabelMap[key] ?? key;
  });
  const activeViewerFilterLabels = [...activeTypeLabels, ...viewerSeverityLabels];
  const viewerFilterButtonLabel =
    activeViewerFilterLabels.length === 0
      ? 'All'
      : activeViewerFilterLabels.length <= 2
        ? activeViewerFilterLabels.join(', ')
        : `${activeViewerFilterLabels.length} filters`;

  return (
    <div className="panel findings-panel">
      <div className="panel-header">
        <div>
          <h3>Findings for this document</h3>
          <p className="panel-subtitle">
            Findings and leads · {findingsForActiveDocument.length} shown / {totalFindingsForActiveDocument} total
          </p>
        </div>
      </div>
      <div className="filter-row">
        <div className="viewer-filter-row">
          <div className="filter-dropdown-wrap" ref={severityFilterRef}>
            <button
              type="button"
              className={`filter-dropdown-btn ${filterSeverity.length > 0 ? 'has-filter' : ''}`}
              onClick={() => setSeverityFilterOpen((prev) => !prev)}
            >
              Filter: {viewerFilterButtonLabel}
              <span className="dropdown-chevron">{severityFilterOpen ? '▲' : '▼'}</span>
            </button>
            <div className={`filter-dropdown-panel ${severityFilterOpen ? 'open' : ''}`}>
              <div className="filter-section-label">Type</div>
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={!hasActiveTypeFilters && filterSeverity.length === 0}
                  onChange={() => {
                    clearFindingViewFilters();
                    setFilterSeverity([]);
                  }}
                />
                <span>All</span>
              </label>
              <div className="filter-dropdown-divider" />
              {[
                ['non_compliant', 'Non-compliant'],
                ['compliant', 'Compliant'],
                ['good_practice', 'Good Practice'],
                ['leads', 'Leads'],
                ['inspector_added', 'Inspector-added'],
                ['reviewed', 'Reviewed'],
                ['unreviewed', 'Unreviewed']
              ].map(([filterKey, label]) => (
                <label key={`viewer-filter-option-${filterKey}`} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={findingViewFilters.includes(filterKey)}
                    onChange={() => toggleFindingViewFilter(filterKey)}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <div className="filter-dropdown-divider" />
              <div className="filter-section-label">Severity</div>
              {severityCounts
                .filter((item) => item.id === 'critical' || item.id === 'warning')
                .map((item) => (
                  <label key={`severity-filter-${item.id}`} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filterSeverity.includes(item.id)}
                      onChange={() => handleToggleFilter(item.id)}
                    />
                    <span>{item.id === 'warning' ? 'Guidance' : 'Critical'}</span>
                  </label>
                ))}
            </div>
          </div>
          <div className="filter-dropdown-wrap" ref={viewerCodeAreaFilterRef}>
            <button
              type="button"
              className={`filter-dropdown-btn ${viewerCodeAreaFilter !== 'all' ? 'has-filter' : ''}`}
              onClick={() => setViewerCodeAreaFilterOpen((prev) => !prev)}
              aria-expanded={viewerCodeAreaFilterOpen}
              aria-haspopup="menu"
            >
              Code area:{' '}
              {VIEWER_CODE_AREA_FILTERS.find((entry) => entry.id === viewerCodeAreaFilter)?.label ?? 'All'}
              <span className="dropdown-chevron">{viewerCodeAreaFilterOpen ? '▲' : '▼'}</span>
            </button>
            <div className={`filter-dropdown-panel ${viewerCodeAreaFilterOpen ? 'open' : ''}`} role="menu">
              {VIEWER_CODE_AREA_FILTERS.map((option, index) => (
                <div key={`viewer-code-area-option-${option.id}`}>
                  {index === 1 ? <div className="filter-dropdown-divider" /> : null}
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={viewerCodeAreaFilter === option.id}
                      onChange={() => {
                        setViewerCodeAreaFilter(option.id);
                        setViewerCodeAreaFilterOpen(false);
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {hiddenForActiveDocument > 0 ? (
        <div className="filter-hint">{hiddenForActiveDocument} findings hidden by filter.</div>
      ) : null}
      <div className="findings-list">
        {findingsForActiveDocument.length === 0 ? (
          <div className="empty-state-inline">
            <h4>
              {!hasActiveTypeFilters && filterSeverity.length === 0
                ? 'No findings currently mapped'
                : 'No findings match the selected filter'}
            </h4>
            <p>
              {!hasActiveTypeFilters && filterSeverity.length === 0
                ? 'As processing evolves, this panel will populate with linked findings.'
                : 'Change finding or code-area filters, or clear severity filters to restore the full list.'}
            </p>
          </div>
        ) : null}
        {findingsForActiveDocument.map((finding) => {
          const relatedDoc = documentsById.get(finding.documentId);
          const findingBucket = getFindingBucketId(finding);
          const isActive = activeFindingId === finding.id;
          const isViewerFindingExpanded =
            expandedViewerFindingIds[finding.id] ??
            (findingBucket === 'critical' || finding.id === findingsForActiveDocument[0]?.id);
          const reviewState = findingDecisions[finding.id] ?? 'unreviewed';
          const isLeadFinding = isLeadFindingByTaxonomy(finding);
          const isInspectorAdded = isInspectorAddedFinding(finding);
          const reviewStatusLabel =
            reviewState === 'accepted'
              ? 'Accepted'
              : reviewState === 'rejected'
                ? 'Rejected'
                : reviewState === 'dismissed'
                  ? 'Dismissed'
                  : 'Unreviewed';
          const reviewStatusSymbol =
            reviewState === 'accepted'
              ? '✓'
              : reviewState === 'rejected'
                ? '✕'
                : reviewState === 'dismissed'
                  ? '◌'
                  : '○';
          const severityLabel = findingSeverityBadgeMap[findingBucket] ?? 'Finding';
          const canDeleteFinding = !finding.reference;
          const canResetDecision = !isLeadFinding && reviewState !== 'unreviewed';
          const showInlineReset = canResetDecision && !canDeleteFinding;
          const evidenceStrength = findingEvidenceStrengthMap[findingBucket] ?? {
            key: 'supported',
            label: 'Supported'
          };
          const evidencePassages = buildEvidencePassages(finding, relatedDoc?.label ?? 'Case document');

          return (
            <article
              key={finding.id}
              ref={(node) => {
                findingRefs.current[finding.id] = node || null;
              }}
              className={`finding-item severity-${findingBucket} ${isActive ? 'active' : ''} ${
                isViewerFindingExpanded ? 'expanded' : ''
              } ${isInspectorAdded ? 'inspector-added' : ''}`}
              onClick={() => {
                const preferredDocumentId = findingReferencesDocument(finding, activeDocId) ? activeDocId : finding.documentId;
                const preferredBoxId = getFindingPreferredBoxIdForDocument(finding, preferredDocumentId);
                setActiveFindingId(finding.id);
                if (preferredDocumentId === activeDocId) {
                  handleSelectDocBox(preferredBoxId, { documentId: preferredDocumentId });
                } else {
                  handleViewDocument(preferredDocumentId, preferredBoxId, finding.id, STEP_OVERVIEW);
                }
              }}
            >
              <div
                className="finding-card-header viewer"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  setExpandedViewerFindingIds((prev) => ({
                    ...prev,
                    [finding.id]: !isViewerFindingExpanded
                  }));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    setExpandedViewerFindingIds((prev) => ({
                      ...prev,
                      [finding.id]: !isViewerFindingExpanded
                    }));
                  }
                }}
              >
                <div className="finding-card-content">
                  <div className="finding-title">
                    <span className={`finding-severity-label severity-${findingBucket}`}>{severityLabel}</span>
                    <span className="finding-title-text">{safeText(finding.title, 'Finding')}</span>
                    <span className="finding-title-meta">
                      <span className={`evidence-badge ${evidenceStrength.key}`}>{evidenceStrength.label}</span>
                      <span className={`source-tag ${isInspectorAdded ? 'inspector' : 'system'}`}>
                        {finding.reference ? '⚙ System' : '👤 Inspector-added'}
                      </span>
                    </span>
                    <span className="finding-expand-chev">{isViewerFindingExpanded ? '▾' : '▸'}</span>
                  </div>
                  <div className="review-status-wrap">
                    <span className={`review-status ${reviewState}`}>
                      {reviewStatusSymbol} {reviewStatusLabel}
                    </span>
                    {reviewState === 'unreviewed' ? <span className="new-badge">New</span> : null}
                    {RECURRING_FINDING_IDS.has(finding.id) ? (
                      <span
                        className="recurring-badge"
                        title={`Previously flagged on ${currentCaseMeta.previousInspection || 'prior inspection'}. Previous status: Open.`}
                      >
                        Previously flagged
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="finding-header-actions">
                  {showInlineReset ? (
                    <button
                      type="button"
                      className="finding-reset-btn"
                      aria-label="Reset finding decision"
                      title="Reset decision"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRequestFindingDecision(finding.id, null);
                      }}
                    >
                      ↺
                    </button>
                  ) : canDeleteFinding || canResetDecision ? (
                    <button
                      type="button"
                      className="finding-more"
                      aria-label="More finding actions"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveMenuFindingId((prev) => (prev === finding.id ? null : finding.id));
                      }}
                    >
                      ⋮
                    </button>
                  ) : null}
                  {activeMenuFindingId === finding.id && (canDeleteFinding || canResetDecision) ? (
                    <div className="finding-menu" ref={findingMenuRef}>
                      {canResetDecision ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, null);
                          }}
                        >
                          Reset
                        </button>
                      ) : null}
                      {canDeleteFinding ? (
                        <button
                          type="button"
                          className="danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!window.confirm('Are you sure you want to delete this finding?')) return;
                            handleDeleteFinding(finding.id);
                            setActiveMenuFindingId(null);
                          }}
                        >
                          Delete finding
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              {isViewerFindingExpanded ? (
                <>
                  {finding.reference ? (
                    <div className="finding-section">
                      <div className="finding-section-head">
                        <div className="finding-section-label">Regulatory requirement</div>
                        <span className="tooltip-wrap">
                          <button
                            type="button"
                            className="jump-link-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleJumpToRequirement(finding);
                            }}
                          >
                            <span className="jump-link">Jump to requirement</span>
                          </button>
                          <span className="tooltip-text">Opens the linked requirement in overview</span>
                        </span>
                      </div>
                      <div className="finding-quote">{formatReferenceText(finding.reference)}</div>
                    </div>
                  ) : null}
                  {isLeadFinding ? (
                    <div className="lead-sections">
                      <div className="lead-section">
                        <div className="lead-section-title">What was noticed</div>
                        <p>{safeText(finding.detail, 'Potential issue identified in current evidence.')}</p>
                      </div>
                      <div className="lead-section">
                        <div className="lead-section-title">Why this could not be confirmed</div>
                        <p>
                          Current uploaded material does not provide enough certainty to classify this as a confirmed
                          finding.
                        </p>
                      </div>
                      <div className="lead-section">
                        <div className="lead-section-title">Suggested action</div>
                        <p>Request supporting documents or clarification from the practice and then confirm or dismiss.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="finding-section">
                      <div className="finding-section-label">What was found</div>
                      <p>{safeText(finding.detail, 'See linked document for further detail.')}</p>
                    </div>
                  )}
                  <div className="finding-section">
                    <div className="finding-section-label">Evidence</div>
                    {evidencePassages.length === 0 ? (
                      <div className="case-level-evidence">Case-level — no document evidence.</div>
                    ) : (
                      evidencePassages.map((passage) => (
                        <div key={`viewer-evidence-${finding.id}-${passage.id}`} className="evidence-block">
                          <div className="doc-ref">
                            📄 {passage.file}
                            {passage.page ? ` — page ${passage.page}` : ''}
                          </div>
                          {passage.excerpt ? <div className="excerpt">"{passage.excerpt}"</div> : null}
                          {passage.documentId ? (
                            <span className="tooltip-wrap">
                              <button
                                type="button"
                                className="jump-link-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleViewDocument(passage.documentId, passage.boxId || finding.boxId, finding.id);
                                }}
                              >
                                <span className="jump-link">Jump to evidence</span>
                              </button>
                              <span className="tooltip-text">Jumps to highlighted passage</span>
                            </span>
                          ) : (
                            <div className="finding-extra-meta">
                              <span className="source-tag">Case-level evidence</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="finding-actions">
                    {isLeadFinding && reviewState === 'unreviewed' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-xs primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            openLeadConfirmModal(finding.id, STEP_VIEWER);
                          }}
                        >
                          Confirm as finding
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'dismissed');
                          }}
                        >
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-xs success"
                          disabled={reviewState === 'accepted'}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'accepted');
                          }}
                        >
                          {reviewState === 'accepted' ? '✓ Accepted' : '✓ Accept'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs ghost"
                          disabled={reviewState === 'rejected'}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'rejected');
                          }}
                        >
                          {reviewState === 'rejected' ? '✕ Rejected' : '✕ Reject'}
                        </button>
                      </>
                    )}
                  </div>
                  {inlineRejectFindingId === finding.id ? (
                    <div className="inline-decision-form">
                      <label className="modal-label" htmlFor={`inline-reject-reason-${finding.id}`}>
                        Reason for rejection (required)
                      </label>
                      <select
                        id={`inline-reject-reason-${finding.id}`}
                        className="modal-select"
                        value={inlineRejectReason}
                        onChange={(event) => setInlineRejectReason(event.target.value)}
                      >
                        <option value="" disabled>
                          Select reason...
                        </option>
                        {REVIEW_REASON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <label className="modal-label" htmlFor={`inline-reject-note-${finding.id}`}>
                        Additional detail (optional)
                      </label>
                      <input
                        id={`inline-reject-note-${finding.id}`}
                        type="text"
                        className="form-control"
                        value={inlineRejectNote}
                        onChange={(event) => setInlineRejectNote(event.target.value)}
                        placeholder="Add context..."
                      />
                      <button type="button" className="btn btn-icon btn-sm" title="Dictate" aria-label="Dictate">
                        🎤
                      </button>
                      <div className="modal-actions">
                        <button
                          type="button"
                          className="btn danger"
                          disabled={!inlineRejectReason}
                          onClick={() => handleConfirmInlineReject(finding.id, false)}
                        >
                          Confirm rejection
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setInlineRejectFindingId(null);
                            setInlineRejectReason('');
                            setInlineRejectNote('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {inlineDismissFindingId === finding.id ? (
                    <div className="inline-decision-form">
                      <label className="modal-label" htmlFor={`inline-dismiss-reason-${finding.id}`}>
                        Reason for dismissal (required)
                      </label>
                      <select
                        id={`inline-dismiss-reason-${finding.id}`}
                        className="modal-select"
                        value={inlineDismissReason}
                        onChange={(event) => setInlineDismissReason(event.target.value)}
                      >
                        <option value="" disabled>
                          Select reason...
                        </option>
                        {DISMISS_REASON_OPTIONS.map((option) => (
                          <option key={`dismiss-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <label className="modal-label" htmlFor={`inline-dismiss-note-${finding.id}`}>
                        Additional detail (optional)
                      </label>
                      <input
                        id={`inline-dismiss-note-${finding.id}`}
                        type="text"
                        className="form-control"
                        value={inlineDismissNote}
                        onChange={(event) => setInlineDismissNote(event.target.value)}
                        placeholder="Add context..."
                      />
                      <button type="button" className="btn btn-icon btn-sm" title="Dictate" aria-label="Dictate">
                        🎤
                      </button>
                      <div className="modal-actions">
                        <button
                          type="button"
                          className="btn danger"
                          disabled={!inlineDismissReason}
                          onClick={() => handleConfirmInlineDismiss(finding.id, false)}
                        >
                          Confirm dismissal
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setInlineDismissFindingId(null);
                            setInlineDismissReason('');
                            setInlineDismissNote('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
