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
  findingViewFilter,
  setViewerTypeFilterOpen,
  viewerTypeFilterOpen,
  findingFilterLabelMap,
  setFindingViewFilter,
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
  findingNotes,
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
  handleOpenAddNote,
  setDeleteFindingTargetId,
  formatReferenceText,
  openLeadConfirmModal,
  noteTargetFindingId,
  noteDraft,
  setNoteDraft,
  setNoteTargetFindingId,
  handleSaveFindingNote,
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
              Filter findings {filterSeverity.length > 0 ? `(${filterSeverity.length})` : ''}
              <span className="dropdown-chevron">{severityFilterOpen ? '▲' : '▼'}</span>
            </button>
            <div className={`filter-dropdown-panel ${severityFilterOpen ? 'open' : ''}`}>
              {severityCounts.map((item) => (
                <label key={`severity-filter-${item.id}`} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filterSeverity.includes(item.id)}
                    onChange={() => handleToggleFilter(item.id)}
                  />
                  <span>{severityLabelMap[item.id] ?? item.label}</span>
                </label>
              ))}
              <div className="filter-dropdown-divider" />
              <button
                type="button"
                className="btn btn-xs ghost"
                onClick={() => setFilterSeverity([])}
                disabled={filterSeverity.length === 0}
              >
                Clear severity filter
              </button>
            </div>
          </div>
          <div className="filter-dropdown-wrap" ref={viewerTypeFilterRef}>
            <button
              type="button"
              className={`filter-dropdown-btn ${findingViewFilter !== 'all' ? 'has-filter' : ''}`}
              onClick={() => setViewerTypeFilterOpen((prev) => !prev)}
              aria-expanded={viewerTypeFilterOpen}
              aria-haspopup="menu"
            >
              Type: {findingFilterLabelMap[findingViewFilter] ?? 'All'}
              <span className="dropdown-chevron">{viewerTypeFilterOpen ? '▲' : '▼'}</span>
            </button>
            <div className={`filter-dropdown-panel ${viewerTypeFilterOpen ? 'open' : ''}`} role="menu">
              {['all'].map((filterKey) => (
                <label key={`viewer-filter-option-${filterKey}`} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={findingViewFilter === filterKey}
                    onChange={() => {
                      setFindingViewFilter(filterKey);
                      setViewerTypeFilterOpen(false);
                    }}
                  />
                  <span>{findingFilterLabelMap[filterKey]}</span>
                </label>
              ))}
              <div className="filter-dropdown-divider" />
              {['unreviewed', 'reviewed', 'leads', 'non_compliant', 'compliant', 'good_practice', 'inspector_added'].map(
                (filterKey) => (
                  <label key={`viewer-filter-option-${filterKey}`} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={findingViewFilter === filterKey}
                      onChange={() => {
                        setFindingViewFilter(filterKey);
                        setViewerTypeFilterOpen(false);
                      }}
                    />
                    <span>{findingFilterLabelMap[filterKey]}</span>
                  </label>
                )
              )}
              <div className="filter-dropdown-divider" />
              {['strong', 'supported', 'indicative'].map((filterKey) => (
                <label key={`viewer-filter-option-${filterKey}`} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={findingViewFilter === filterKey}
                    onChange={() => {
                      setFindingViewFilter(filterKey);
                      setViewerTypeFilterOpen(false);
                    }}
                  />
                  <span>{findingFilterLabelMap[filterKey]}</span>
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
              {VIEWER_CODE_AREA_FILTERS.find((entry) => entry.id === viewerCodeAreaFilter)?.label ?? 'All code areas'}
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
      {filterSeverity.length > 0 ? (
        <div className="filter-clear visible">
          <span>Active filter: {activeSeverityLabels.join(', ')}</span>
          <button type="button" className="btn btn-xs ghost" onClick={() => setFilterSeverity([])}>
            Clear filters
          </button>
        </div>
      ) : null}
      {findingViewFilter !== 'all' ? (
        <div className="filter-clear visible">
          <span>Type filter: {findingFilterLabelMap[findingViewFilter] ?? findingViewFilter}</span>
          <button type="button" className="btn btn-xs ghost" onClick={() => setFindingViewFilter('all')}>
            Clear
          </button>
        </div>
      ) : null}
      {viewerCodeAreaFilter !== 'all' ? (
        <div className="filter-clear visible">
          <span>
            Code area:{' '}
            {VIEWER_CODE_AREA_FILTERS.find((entry) => entry.id === viewerCodeAreaFilter)?.label ?? viewerCodeAreaFilter}
          </span>
          <button type="button" className="btn btn-xs ghost" onClick={() => setViewerCodeAreaFilter('all')}>
            Clear
          </button>
        </div>
      ) : null}
      {hiddenForActiveDocument > 0 ? (
        <div className="filter-hint">{hiddenForActiveDocument} findings hidden by filter.</div>
      ) : null}
      <div className="findings-list">
        {findingsForActiveDocument.length === 0 ? (
          <div className="empty-state-inline">
            <h4>
              {findingViewFilter === 'all'
                ? 'No findings currently mapped'
                : `No ${findingFilterLabelMap[findingViewFilter] ?? 'matching'} findings in this section`}
            </h4>
            <p>
              {findingViewFilter === 'all'
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
          const noteEntry = findingNotes[finding.id];
          const noteText = typeof noteEntry === 'string' ? noteEntry : noteEntry?.text;
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
          const severityLabel = findingSeverityBadgeMap[findingBucket] ?? 'FINDING';
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
                    <span className={`finding-severity-label severity-${findingBucket}`}>{severityLabel}</span>{' '}
                    {safeText(finding.title, 'Finding')}
                    <span className="finding-expand-chev">{isViewerFindingExpanded ? '▾' : '▸'}</span>
                  </div>
                  <div className="finding-meta">
                    <span className="badge">{finding.id}</span>
                    {finding.reference ? <code>{formatReferenceText(finding.reference)}</code> : null}
                    <span className={`evidence-badge ${evidenceStrength.key}`}>{evidenceStrength.label}</span>
                    <span className={`source-tag ${isInspectorAdded ? 'inspector' : 'system'}`}>
                      {finding.reference ? '⚙ System' : '👤 Inspector-added'}
                    </span>
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
                  {activeMenuFindingId === finding.id ? (
                    <div className="finding-menu" ref={findingMenuRef}>
                      {reviewState === 'dismissed' ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, null);
                          }}
                        >
                          Reopen lead
                        </button>
                      ) : null}
                      {reviewState === 'accepted' ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'rejected');
                          }}
                        >
                          Change decision
                        </button>
                      ) : null}
                      {reviewState === 'rejected' ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'accepted');
                          }}
                        >
                          Change decision
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenAddNote(finding.id);
                        }}
                      >
                        📝 Add note
                      </button>
                      {reviewState !== 'dismissed' ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'dismissed');
                          }}
                        >
                          Dismiss lead
                        </button>
                      ) : null}
                      {!finding.reference ? (
                        <button
                          type="button"
                          className="danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteFindingTargetId(finding.id);
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
                      <div className="finding-section-label">Regulatory requirement</div>
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
                          <div className="finding-extra-meta">
                            <span className={`source-tag ${isInspectorAdded ? 'inspector' : 'system'}`}>
                              {finding.reference ? 'System-generated' : 'Inspector-added'} ·{' '}
                              {safeText(passage.section, 'Case-level')}
                            </span>
                          </div>
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
                  {isLeadFinding && reviewState === 'unreviewed' ? (
                    <div className="lead-sections-inline">
                      <p>
                        <strong>Potential lead:</strong> Evidence may indicate a gap and requires inspector confirmation.
                      </p>
                      <button
                        type="button"
                        className="btn btn-xs primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          openLeadConfirmModal(finding.id, STEP_VIEWER);
                        }}
                      >
                        Open Evidence Highlighter
                      </button>
                    </div>
                  ) : null}
                  {noteText ? (
                    <p className="finding-note">
                      Note: {noteText}
                      {typeof noteEntry === 'object' && noteEntry?.ts ? (
                        <span className="finding-note-meta"> ({noteEntry.ts} - {noteEntry.actor ?? 'Inspector'})</span>
                      ) : null}
                    </p>
                  ) : null}
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
                    <button
                      type="button"
                      className="btn btn-xs ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenAddNote(finding.id);
                      }}
                    >
                      📝 Add note
                    </button>
                  </div>
                  {inlineRejectFindingId === finding.id ? (
                    <div className="inline-decision-form">
                      <label className="modal-label" htmlFor={`inline-reject-reason-${finding.id}`}>
                        Reason category (required)
                      </label>
                      <select
                        id={`inline-reject-reason-${finding.id}`}
                        className="modal-select"
                        value={inlineRejectReason}
                        onChange={(event) => setInlineRejectReason(event.target.value)}
                      >
                        {REVIEW_REASON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <label className="modal-label" htmlFor={`inline-reject-note-${finding.id}`}>
                        Note {inlineRejectReason === 'other' ? '(required)' : '(optional)'}
                      </label>
                      <textarea
                        id={`inline-reject-note-${finding.id}`}
                        className="modal-textarea"
                        value={inlineRejectNote}
                        onChange={(event) => setInlineRejectNote(event.target.value)}
                        placeholder="Add detail for this decision..."
                      />
                      <div className="modal-actions">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setInlineRejectFindingId(null);
                            setInlineRejectReason(REVIEW_REASON_OPTIONS[0].value);
                            setInlineRejectNote('');
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn primary"
                          disabled={inlineRejectReason === 'other' && !inlineRejectNote.trim()}
                          onClick={() => handleConfirmInlineReject(finding.id)}
                        >
                          Confirm rejection
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
                          Select a dismissal reason
                        </option>
                        {DISMISS_REASON_OPTIONS.map((option) => (
                          <option key={`dismiss-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <label className="modal-label" htmlFor={`inline-dismiss-note-${finding.id}`}>
                        Details {inlineDismissReason === 'other' ? '(required)' : '(optional)'}
                      </label>
                      <textarea
                        id={`inline-dismiss-note-${finding.id}`}
                        className="modal-textarea"
                        value={inlineDismissNote}
                        onChange={(event) => setInlineDismissNote(event.target.value)}
                        placeholder="Add detail for this dismissal..."
                      />
                      <div className="modal-actions">
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
                        <button
                          type="button"
                          className="btn primary"
                          disabled={!inlineDismissReason || (inlineDismissReason === 'other' && !inlineDismissNote.trim())}
                          onClick={() => handleConfirmInlineDismiss(finding.id)}
                        >
                          Confirm dismissal
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {noteTargetFindingId === finding.id ? (
                    <div className="inline-note-form">
                      <label className="modal-label" htmlFor={`inline-note-${finding.id}`}>
                        Add note
                      </label>
                      <textarea
                        id={`inline-note-${finding.id}`}
                        className="modal-textarea"
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        placeholder="Enter observation..."
                      />
                      <div className="modal-actions">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setNoteTargetFindingId(null);
                            setNoteDraft('');
                          }}
                        >
                          Cancel
                        </button>
                        <button type="button" className="btn primary" onClick={handleSaveFindingNote}>
                          Save note
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
