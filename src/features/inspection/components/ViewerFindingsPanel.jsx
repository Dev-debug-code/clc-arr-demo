import { useMemo } from 'react';
import {
  DISMISS_REASON_OPTIONS,
  RECURRING_FINDING_IDS,
  REVIEW_REASON_OPTIONS,
  STEP_OVERVIEW,
  VIEWER_CODE_AREA_FILTERS
} from '../config.js';
import { getFindingDisplayDecisionState, isFindingOverturned } from '../helpers.js';

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
  hiddenForActiveDocument,
  documentsById,
  requirementsByCodeArea,
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
  formatReferenceText,
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
  activeDocId,
  getFindingPreferredBoxIdForDocument,
  handleSelectDocBox,
  handleViewDocument,
  handleShowGuidance
}) {
  const requirementLookup = useMemo(() => {
    const lookup = new Map();
    Object.entries(requirementsByCodeArea ?? {}).forEach(([codeAreaId, rows]) => {
      (Array.isArray(rows) ? rows : []).forEach((entry) => {
        if (!entry?.id) return;
        lookup.set(entry.id, {
          ...entry,
          codeAreaId: entry.codeAreaId || codeAreaId
        });
      });
    });
    return lookup;
  }, [requirementsByCodeArea]);

  const hasActiveTypeFilters = findingViewFilters.length > 0;
  const activeTypeLabels = findingViewFilters.map((filterKey) => {
    return (
      {
        non_compliant: 'Non-compliant',
        compliant: 'Compliant',
        good_practice: 'Good Practice',
        leads: 'Inconclusive',
        inspector_added: 'Inspector-added',
        reviewed: 'Reviewed',
        unreviewed: 'Unreviewed'
      }[filterKey] ?? findingFilterLabelMap[filterKey] ?? filterKey
    );
  });
  const viewerSeverityLabels = filterSeverity.map((key) => {
    if (key === 'critical') return 'Non-compliant';
    if (key === 'warning') return 'Inconclusive';
    return severityLabelMap[key] ?? key;
  });
  const activeViewerFilterLabels = [...activeTypeLabels, ...viewerSeverityLabels];
  const viewerFilterButtonLabel =
    activeViewerFilterLabels.length === 0
      ? 'All'
      : activeViewerFilterLabels.length <= 2
        ? activeViewerFilterLabels.join(', ')
        : `${activeViewerFilterLabels.length} filters`;

  const activeRejectFinding = useMemo(
    () => findingsForActiveDocument.find((finding) => finding.id === inlineRejectFindingId) ?? null,
    [findingsForActiveDocument, inlineRejectFindingId]
  );
  const activeDismissFinding = useMemo(
    () => findingsForActiveDocument.find((finding) => finding.id === inlineDismissFindingId) ?? null,
    [findingsForActiveDocument, inlineDismissFindingId]
  );

  const buildFindingEvidenceTargets = (finding) => {
    const resolvedDocumentId = activeDocId || finding.documentId;
    const relatedDocument = documentsById.get(resolvedDocumentId);
    const overlayBoxes = Array.isArray(relatedDocument?.overlay?.boxes) ? relatedDocument.overlay.boxes : [];
    const passages = buildEvidencePassages(finding, relatedDocument?.filename || relatedDocument?.label || 'Case document');
    const targets = [];
    const seen = new Set();

    const pushTarget = ({ boxId, page, label }) => {
      const cleanBoxId = safeText(boxId, '');
      const key = `${resolvedDocumentId}:${cleanBoxId || page || label}`;
      if (seen.has(key)) return;
      seen.add(key);
      targets.push({
        documentId: resolvedDocumentId,
        boxId: cleanBoxId || null,
        page,
        label: safeText(label, '') || 'Evidence'
      });
    };

    passages
      .filter((passage) => {
        const passageDocumentId = safeText(passage.documentId, resolvedDocumentId);
        return !resolvedDocumentId || !passageDocumentId || passageDocumentId === resolvedDocumentId;
      })
      .forEach((passage, index) => {
        pushTarget({
          boxId: passage.boxId,
          page: passage.page,
          label: passage.section || passage.excerpt || `Evidence ${index + 1}`
        });
      });

    const candidatePrefixes = new Set([safeText(finding.boxId, ''), safeText(finding.id, '')].filter(Boolean));

    overlayBoxes.forEach((box, index) => {
      const boxId = safeText(box?.id, '');
      if (!boxId) return;
      const matchesPrefix = [...candidatePrefixes].some(
        (prefix) => boxId === prefix || boxId.startsWith(`${prefix}-p`)
      );
      if (!matchesPrefix) return;
      pushTarget({
        boxId,
        page: box?.page ?? box?.pageno ?? null,
        label: box?.category || box?.title || `Evidence ${index + 1}`
      });
    });

    if (targets.length === 0) {
      pushTarget({
        boxId: getFindingPreferredBoxIdForDocument(finding, resolvedDocumentId),
        page: finding?.source?.page ?? null,
        label: finding?.source?.section || finding?.title || 'Evidence'
      });
    }

    return targets.sort((left, right) => {
      const leftPage = Number.isFinite(left?.page) ? left.page : 0;
      const rightPage = Number.isFinite(right?.page) ? right.page : 0;
      return leftPage - rightPage;
    });
  };

  const closeRejectModal = () => {
    setInlineRejectFindingId(null);
    setInlineRejectReason('');
    setInlineRejectNote('');
  };

  const closeDismissModal = () => {
    setInlineDismissFindingId(null);
    setInlineDismissReason('');
    setInlineDismissNote('');
  };

  return (
    <div className="panel findings-panel">
      <div className="panel-header">
        <div>
          <h3>Findings for this document</h3>
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
                ['leads', 'Inconclusive'],
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
                    <span>{item.id === 'warning' ? 'Inconclusive' : 'Non-compliant'}</span>
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
                ? 'As processing evolves, this panel will populate with findings from the assessed evidence.'
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
          const displayReviewState = getFindingDisplayDecisionState(finding, reviewState);
          const overturnedFinding = isFindingOverturned(finding, reviewState);
          const isLeadFinding = isLeadFindingByTaxonomy(finding);
          const isInspectorAdded = isInspectorAddedFinding(finding);
          const reviewStatusLabel =
            displayReviewState === 'accepted'
              ? 'Accepted'
              : displayReviewState === 'overturned'
                ? 'Overturned'
                : displayReviewState === 'rejected'
                  ? 'Rejected'
                  : displayReviewState === 'dismissed'
                  ? 'Dismissed'
                  : 'Unreviewed';
          const reviewStatusSymbol =
            displayReviewState === 'accepted'
              ? '✓'
              : displayReviewState === 'overturned'
                ? '↺'
                : displayReviewState === 'rejected'
                  ? '✕'
                  : displayReviewState === 'dismissed'
                  ? '◌'
                  : '○';
          const severityLabel = findingSeverityBadgeMap[findingBucket] ?? 'Finding';
          const canDeleteFinding = !finding.reference;
          const evidencePassages = buildEvidencePassages(finding, relatedDoc?.label ?? 'Case document');
          const evidenceTargets = buildFindingEvidenceTargets(finding);
          const linkedRequirementId = safeText(finding?.requirementId || finding?.requirement_id, '');
          const linkedRequirement = linkedRequirementId ? requirementLookup.get(linkedRequirementId) ?? null : null;
          const requirementHeading = safeText(
            linkedRequirement?.codeAreaLabel,
            safeText(finding.reference, safeText(finding?.codeAreaLabel, ''))
          );
          const requirementContent = safeText(
            linkedRequirement?.content,
            safeText(linkedRequirement?.label, formatReferenceText(finding.reference))
          );

          return (
            <article
              key={finding.id}
              ref={(node) => {
                findingRefs.current[finding.id] = node || null;
              }}
              className={`finding-item severity-${findingBucket} ${isActive ? 'active' : ''} ${
                isViewerFindingExpanded ? 'expanded' : ''
              } ${isInspectorAdded ? 'inspector-added' : ''} ${
                displayReviewState === 'rejected' || displayReviewState === 'dismissed' ? 'is-muted' : ''
              }`}
            >
              <div
                className="finding-card-header viewer"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveFindingId(finding.id);
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
                    <span className="finding-expand-chev">{isViewerFindingExpanded ? '▾' : '▸'}</span>
                  </div>
                  <div className="review-status-wrap">
                    <span className={`review-status ${displayReviewState}`}>
                      {reviewStatusSymbol} {reviewStatusLabel}
                    </span>
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
                  {overturnedFinding ? (
                    <span className="finding-state-pill finding-state-pill--overturned">↺ Overturned</span>
                  ) : null}
                  {canDeleteFinding ? (
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
                  {activeMenuFindingId === finding.id && canDeleteFinding ? (
                    <div className="finding-menu" ref={findingMenuRef}>
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
                  {linkedRequirement || finding.reference ? (
                    <div className="finding-section">
                      <div className="finding-section-head">
                        <div className="finding-section-label">Associated requirement</div>
                      </div>
                      <div className="viewer-requirement-card">
                        {requirementHeading ? <strong>{requirementHeading}</strong> : null}
                        {requirementContent ? (
                          <>
                            <div className="finding-section-label">Content</div>
                            <div className="finding-quote">{requirementContent}</div>
                          </>
                        ) : null}
                        <div className="viewer-requirement-card__actions">
                          <button
                            type="button"
                            className="jump-link-btn jump-link-btn--secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleShowGuidance(finding);
                            }}
                          >
                            <span className="jump-link">Show guidance text</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="finding-section">
                    <div className="finding-section-label">What was found</div>
                    <p>{safeText(finding.detail, 'See linked document for further detail.')}</p>
                  </div>
                  <div className="finding-section">
                    <div className="finding-section-label">Evidence</div>
                    {evidencePassages.length === 0 ? (
                      <div className="case-level-evidence">Case-level — no document evidence.</div>
                    ) : (
                      <>
                        {evidenceTargets.length > 0 ? (
                          <div className="finding-evidence-targets">
                            {evidenceTargets.map((target, targetIndex) => (
                              <button
                                key={`${finding.id}-${target.boxId || targetIndex}`}
                                type="button"
                                className="btn btn-sm secondary finding-evidence-target"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveFindingId(finding.id);
                                  if (target.documentId === activeDocId) {
                                    handleSelectDocBox(target.boxId, {
                                      documentId: target.documentId,
                                      scrollFinding: false
                                    });
                                  } else {
                                    handleViewDocument(target.documentId, target.boxId, finding.id, STEP_OVERVIEW);
                                  }
                                }}
                              >
                                {evidenceTargets.length > 1
                                  ? `Highlight evidence ${targetIndex + 1}`
                                  : 'Highlight evidence'}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {evidencePassages
                          .filter((passage) => !passage.documentId)
                          .map((passage) => (
                            <div key={`viewer-evidence-${finding.id}-${passage.id}`} className="evidence-block">
                              {!passage.documentId ? (
                                <div className="finding-extra-meta">
                                  <span className="source-tag">Case-level evidence</span>
                                </div>
                              ) : null}
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                  <div className="finding-actions viewer-finding-actions">
                    {isLeadFinding && reviewState === 'unreviewed' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-xs primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'accepted');
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
                            setActiveFindingId(finding.id);
                            handleRequestFindingDecision(finding.id, 'accepted');
                          }}
                        >
                          {reviewState === 'accepted' ? '✓ Accepted' : '✓ Accept'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-danger"
                          disabled={reviewState === 'rejected'}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveFindingId(finding.id);
                            handleRequestFindingDecision(finding.id, 'rejected');
                          }}
                        >
                          {reviewState === 'rejected'
                            ? overturnedFinding
                              ? '↺ Overturned'
                              : '✕ Rejected'
                            : findingBucket === 'pass'
                              ? '↺ Overturn'
                              : '✕ Reject'}
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </article>
          );
        })}
      </div>
      {inlineRejectFindingId ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Reject finding">
            <div className="modal-card__header">
              <h3>Reject finding</h3>
              <button type="button" className="modal-card__close" aria-label="Close" onClick={closeRejectModal}>
                ×
              </button>
            </div>
            {activeRejectFinding ? <p><strong>{activeRejectFinding.title}</strong></p> : null}
            <label className="modal-label" htmlFor={`viewer-reject-reason-${inlineRejectFindingId}`}>
              Reason for rejection (required)
            </label>
            <select
              id={`viewer-reject-reason-${inlineRejectFindingId}`}
              className="modal-select"
              value={inlineRejectReason}
              onChange={(event) => setInlineRejectReason(event.target.value)}
            >
              <option value="" disabled>
                Select reason...
              </option>
              {REVIEW_REASON_OPTIONS.map((option) => (
                <option key={`viewer-reject-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="modal-label" htmlFor={`viewer-reject-note-${inlineRejectFindingId}`}>
              Additional detail (optional)
            </label>
            <input
              id={`viewer-reject-note-${inlineRejectFindingId}`}
              type="text"
              className="form-control modal-text-input"
              value={inlineRejectNote}
              onChange={(event) => setInlineRejectNote(event.target.value)}
              placeholder="Add context..."
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-danger"
                disabled={!inlineRejectReason}
                onClick={() => handleConfirmInlineReject(inlineRejectFindingId, false)}
              >
                Confirm rejection
              </button>
              <button type="button" className="btn ghost" onClick={closeRejectModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {inlineDismissFindingId ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Dismiss finding">
            <div className="modal-card__header">
              <h3>Dismiss finding</h3>
              <button type="button" className="modal-card__close" aria-label="Close" onClick={closeDismissModal}>
                ×
              </button>
            </div>
            {activeDismissFinding ? <p><strong>{activeDismissFinding.title}</strong></p> : null}
            <label className="modal-label" htmlFor={`viewer-dismiss-reason-${inlineDismissFindingId}`}>
              Reason for dismissal (required)
            </label>
            <select
              id={`viewer-dismiss-reason-${inlineDismissFindingId}`}
              className="modal-select"
              value={inlineDismissReason}
              onChange={(event) => setInlineDismissReason(event.target.value)}
            >
              <option value="" disabled>
                Select reason...
              </option>
              {DISMISS_REASON_OPTIONS.map((option) => (
                <option key={`viewer-dismiss-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="modal-label" htmlFor={`viewer-dismiss-note-${inlineDismissFindingId}`}>
              Additional detail (optional)
            </label>
            <input
              id={`viewer-dismiss-note-${inlineDismissFindingId}`}
              type="text"
              className="form-control modal-text-input"
              value={inlineDismissNote}
              onChange={(event) => setInlineDismissNote(event.target.value)}
              placeholder="Add context..."
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-danger"
                disabled={!inlineDismissReason}
                onClick={() => handleConfirmInlineDismiss(inlineDismissFindingId, false)}
              >
                Confirm dismissal
              </button>
              <button type="button" className="btn ghost" onClick={closeDismissModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
