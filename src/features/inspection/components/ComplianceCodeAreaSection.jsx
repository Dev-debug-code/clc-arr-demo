import {
  DISMISS_REASON_OPTIONS,
  RECURRING_FINDING_IDS,
  REQUIREMENT_KEYWORDS,
  REVIEW_REASON_OPTIONS,
  STEP_OVERVIEW
} from '../config.js';
import { isRequirementExcluded, isRequirementMet } from '../helpers.js';

export default function ComplianceCodeAreaSection({
  area,
  requirementsByCodeArea,
  availableFindings,
  filteredFindings,
  findingMatchesCodeArea,
  getFindingBucketId,
  expandedCodeAreaId,
  setExpandedCodeAreaId,
  overviewRequirementFilter,
  setOverviewRequirementFilter,
  overviewFilterRef,
  findingViewFilter,
  setOverviewFilterOpen,
  overviewFilterOpen,
  findingFilterLabelMap,
  setFindingViewFilter,
  findingDecisions,
  expandedOverviewFindingIds,
  setExpandedOverviewFindingIds,
  findingSeverityBadgeMap,
  findingEvidenceStrengthMap,
  isLeadFindingByTaxonomy,
  isInspectorAddedFinding,
  buildEvidencePassages,
  findingNotes,
  safeText,
  formatReferenceText,
  activeMenuFindingId,
  setActiveMenuFindingId,
  findingMenuRef,
  handleRequestFindingDecision,
  handleOpenAddNote,
  setDeleteFindingTargetId,
  handleViewDocument,
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
  noteTargetFindingId,
  noteDraft,
  setNoteDraft,
  setNoteTargetFindingId,
  handleSaveFindingNote,
  openComposerModal
}) {
  const isExpanded = expandedCodeAreaId === area.id;
  const requirementRows = requirementsByCodeArea[area.id] ?? [];
  const assessableRequirementRows = requirementRows.filter((entry) => !isRequirementExcluded(entry.status));
  const mappedAreaFindings = availableFindings.filter((finding) => findingMatchesCodeArea(finding, area.id));
  const areaFindings = filteredFindings.filter((finding) => findingMatchesCodeArea(finding, area.id));
  const attentionCount = mappedAreaFindings.filter((entry) => getFindingBucketId(entry) === 'critical').length;
  const leadCount = mappedAreaFindings.filter((entry) => getFindingBucketId(entry) === 'warning').length;
  const goodPracticeCount = mappedAreaFindings.filter((entry) => getFindingBucketId(entry) === 'best_practice').length;
  const metRequirements = assessableRequirementRows.filter((entry) => isRequirementMet(entry.status)).length;
  const totalRequirements = assessableRequirementRows.length;
  const metLabel = totalRequirements === 0 ? 'N/A' : `${metRequirements}/${totalRequirements}`;
  const isFullyCompliant =
    attentionCount === 0 && leadCount === 0 && (totalRequirements === 0 || metRequirements === totalRequirements);
  const countParts = [];
  if (attentionCount > 0) {
    countParts.push({ key: 'attention', label: `${attentionCount} attention`, cls: 'count-attention' });
  }
  if (goodPracticeCount > 0) {
    countParts.push({ key: 'good-practice', label: `${goodPracticeCount} good practice`, cls: 'count-gp' });
  }
  if (leadCount > 0) countParts.push({ key: 'lead', label: `${leadCount} lead`, cls: 'count-lead' });
  const activeRequirementId = overviewRequirementFilter.areaId === area.id ? overviewRequirementFilter.requirementId : '';
  const areaFindingsFilteredByRequirement = activeRequirementId
    ? areaFindings.filter((finding) => {
        const keywords = REQUIREMENT_KEYWORDS[activeRequirementId] ?? [];
        if (keywords.length === 0) return true;
        const haystack = [
          finding?.reference,
          finding?.title,
          finding?.detail,
          finding?.source?.section,
          finding?.source?.file,
          finding?.source?.text
        ]
          .filter((value) => value !== null && value !== undefined)
          .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
          .join(' ')
          .toLowerCase();
        return keywords.some((keyword) => haystack.includes(keyword));
      })
    : areaFindings;

  return (
    <div key={area.id}>
      <div className={`code-area-row ${isExpanded ? 'expanded' : ''}`} onClick={() => setExpandedCodeAreaId((prev) => (prev === area.id ? '' : area.id))}>
        <div className="code-area-chevron">▶</div>
        <div className="code-area-info">
          <div className="code-area-name">{area.name}</div>
          <div className="code-area-meta">
            <div className="code-area-progress" style={{ flex: 1 }}>
              <div className="progress-track">
                <div
                  className="progress-bar"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, totalRequirements === 0 ? 0 : (metRequirements / totalRequirements) * 100)
                    )}%`
                  }}
                />
              </div>
            </div>
            <div className="code-area-met">{metLabel} met</div>
            <div className="code-area-counts">
              {countParts.map((part, index) => (
                <span key={`${area.id}-${part.key}`} className={part.cls}>
                  {index > 0 ? <span className="sep">·</span> : null}
                  {part.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        {isFullyCompliant ? <span className="fully-compliant">✓</span> : null}
      </div>

      {isExpanded ? (
        <div className="expanded-area">
          <div className="expanded-inner">
            <div className="requirements-col">
              <h4>Requirements</h4>
              {requirementRows.map((req) => (
                <div
                  key={req.id}
                  className={`req-item ${activeRequirementId === req.id ? 'active-filter' : ''}`}
                  onClick={() =>
                    setOverviewRequirementFilter((prev) =>
                      prev.areaId === area.id && prev.requirementId === req.id
                        ? { areaId: '', requirementId: '' }
                        : { areaId: area.id, requirementId: req.id }
                    )
                  }
                  >
                  <span className={`req-icon ${req.status}`}>
                    {isRequirementMet(req.status)
                      ? '✓'
                      : req.status === 'non_compliant'
                        ? '✕'
                        : req.status === 'not_applicable'
                          ? '–'
                          : req.status === 'not_assessed'
                            ? '○'
                            : '●'}
                  </span>
                  {req.label}
                </div>
              ))}
            </div>
            <div className="findings-col">
              <div className="filter-row">
                <span className="panel-subtitle">Findings for {area.name}</span>
                <div className="filter-dropdown-wrap" ref={overviewFilterRef}>
                  <button
                    type="button"
                    className={`filter-dropdown-btn ${findingViewFilter !== 'all' ? 'has-filter' : ''}`}
                    onClick={() => setOverviewFilterOpen((prev) => !prev)}
                    aria-expanded={overviewFilterOpen}
                    aria-haspopup="menu"
                  >
                    Filter: {findingFilterLabelMap[findingViewFilter] ?? 'All'}
                    <span className="dropdown-chevron">▼</span>
                  </button>
                  <div className={`filter-dropdown-panel ${overviewFilterOpen ? 'open' : ''}`} role="menu">
                    {['all'].map((filterKey) => (
                      <label key={`overview-filter-option-${filterKey}`} className="filter-checkbox">
                        <input
                          type="checkbox"
                          checked={findingViewFilter === filterKey}
                          onChange={() => {
                            setFindingViewFilter(filterKey);
                            setOverviewFilterOpen(false);
                          }}
                        />
                        <span>{findingFilterLabelMap[filterKey]}</span>
                      </label>
                    ))}
                    <div className="filter-dropdown-divider" />
                    {['unreviewed', 'reviewed', 'leads', 'non_compliant', 'compliant', 'good_practice', 'inspector_added'].map(
                      (filterKey) => (
                        <label key={`overview-filter-option-${filterKey}`} className="filter-checkbox">
                          <input
                            type="checkbox"
                            checked={findingViewFilter === filterKey}
                            onChange={() => {
                              setFindingViewFilter(filterKey);
                              setOverviewFilterOpen(false);
                            }}
                          />
                          <span>{findingFilterLabelMap[filterKey]}</span>
                        </label>
                      )
                    )}
                    <div className="filter-dropdown-divider" />
                    {['strong', 'supported', 'indicative'].map((filterKey) => (
                      <label key={`overview-filter-option-${filterKey}`} className="filter-checkbox">
                        <input
                          type="checkbox"
                          checked={findingViewFilter === filterKey}
                          onChange={() => {
                            setFindingViewFilter(filterKey);
                            setOverviewFilterOpen(false);
                          }}
                        />
                        <span>{findingFilterLabelMap[filterKey]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {activeRequirementId ? (
                <div className="filter-clear visible">
                  <span>
                    Filtering by requirement:{' '}
                    {requirementRows.find((entry) => entry.id === activeRequirementId)?.label ?? activeRequirementId}
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs ghost"
                    onClick={() => setOverviewRequirementFilter({ areaId: '', requirementId: '' })}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
              {areaFindingsFilteredByRequirement.length === 0 ? (
                <div className="empty-state-inline">
                  <h4>
                    {findingViewFilter === 'all' ? 'No findings currently mapped' : 'No findings match the selected filter'}
                  </h4>
                  <p>
                    {findingViewFilter === 'all'
                      ? 'As processing evolves, this panel will populate with linked findings.'
                      : 'Try switching filter back to All to see every mapped finding.'}
                  </p>
                </div>
              ) : (
                <div className="overview-findings-column">
                  {areaFindingsFilteredByRequirement.map((finding) => (() => {
                    const findingBucket = getFindingBucketId(finding);
                    const reviewState = findingDecisions[finding.id] ?? 'unreviewed';
                    const isFindingExpanded = expandedOverviewFindingIds[finding.id] ?? findingBucket === 'critical';
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
                    const isLeadFinding = isLeadFindingByTaxonomy(finding);
                    const isInspectorAdded = isInspectorAddedFinding(finding);
                    const evidencePassages = buildEvidencePassages(finding);
                    const noteEntry = findingNotes[finding.id];
                    const noteText = typeof noteEntry === 'string' ? noteEntry : noteEntry?.text;

                    return (
                      <article
                        key={`code-area-finding-${area.id}-${finding.id}`}
                        className={`finding-card ${
                          findingBucket === 'warning'
                            ? 'lead'
                            : findingBucket === 'best_practice'
                              ? 'compliant'
                              : 'noncompliant'
                        } ${isInspectorAdded ? 'inspector-added' : ''} ${isFindingExpanded ? 'expanded' : ''}`}
                      >
                        <div
                          className="finding-card-header"
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setExpandedOverviewFindingIds((prev) => ({
                              ...prev,
                              [finding.id]: !isFindingExpanded
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setExpandedOverviewFindingIds((prev) => ({
                                ...prev,
                                [finding.id]: !isFindingExpanded
                              }));
                            }
                          }}
                        >
                          <div className="finding-card-content">
                            <div className="finding-title">
                              <span className={`finding-severity-label severity-${findingBucket}`}>{severityLabel}</span>{' '}
                              {safeText(finding.title, 'Finding')}
                              {reviewState === 'unreviewed' ? <span className="new-badge">New</span> : null}
                              {RECURRING_FINDING_IDS.has(finding.id) ? (
                                <span className="recurring-badge">Previously flagged</span>
                              ) : null}
                              <span className="finding-expand-chev">{isFindingExpanded ? '▾' : '▸'}</span>
                            </div>
                            <div className="finding-meta">
                              <code>{formatReferenceText(finding.reference) || finding.id}</code>
                              <span className="sep">·</span>
                              <span className={`evidence-badge ${evidenceStrength.key}`}>{evidenceStrength.label}</span>
                              <span className="sep">·</span>
                              <span className={`source-tag ${isInspectorAdded ? 'inspector' : 'system'}`}>
                                {finding.reference ? '⚙ System' : '👤 Inspector-added'}
                              </span>
                            </div>
                            <div className="review-status-wrap">
                              <span className={`review-status ${reviewState}`}>
                                {reviewStatusSymbol} {reviewStatusLabel}
                              </span>
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
                                    handleOpenAddNote(finding.id, safeText(finding.detail, ''));
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
                        {isFindingExpanded ? (
                          <div className="finding-card-body">
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
                                    Current uploaded material does not provide enough certainty to classify this as a
                                    confirmed finding.
                                  </p>
                                </div>
                                <div className="lead-section">
                                  <div className="lead-section-title">Suggested action</div>
                                  <p>
                                    Use &quot;Jump to evidence&quot; and request missing context from the practice before
                                    confirming or dismissing.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="finding-section">
                                <div className="finding-section-label">What was found</div>
                                <p>{safeText(finding.detail, 'No detailed description available yet.')}</p>
                              </div>
                            )}
                            <div className="finding-section">
                              <div className="finding-section-label">Evidence</div>
                              {evidencePassages.length === 0 ? (
                                <div className="case-level-evidence">Case-level — no document evidence.</div>
                              ) : (
                                evidencePassages.map((passage) => (
                                  <div key={`overview-evidence-${finding.id}-${passage.id}`} className="evidence-block">
                                    <div className="evidence-head-row">
                                      <div className="doc-ref">
                                        📄 {passage.file}
                                        {passage.page ? ` — page ${passage.page}` : ''}
                                      </div>
                                      {passage.documentId ? (
                                        <span className="tooltip-wrap">
                                          <button
                                            type="button"
                                            className="jump-link-btn"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleViewDocument(
                                                passage.documentId,
                                                passage.boxId || finding.boxId,
                                                finding.id,
                                                STEP_OVERVIEW
                                              );
                                            }}
                                          >
                                            <span className="jump-link">Jump to evidence</span>
                                          </button>
                                          <span className="tooltip-text">Opens Document Viewer</span>
                                        </span>
                                      ) : null}
                                    </div>
                                    {passage.excerpt ? <div className="excerpt">"{passage.excerpt}"</div> : null}
                                    {passage.section ? (
                                      <div className="finding-extra-meta">
                                        <span className="source-tag">{safeText(passage.section, '')}</span>
                                      </div>
                                    ) : null}
                                    {!passage.documentId ? (
                                      <div className="finding-extra-meta">
                                        <span className="source-tag">Case-level evidence</span>
                                      </div>
                                    ) : null}
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="finding-section">
                              <div className="finding-section-label">Evidence strength</div>
                              <p>
                                <span className={`evidence-badge ${evidenceStrength.key}`}>{evidenceStrength.label}</span>
                              </p>
                            </div>
                            <div className="action-row finding-actions">
                              {isLeadFinding && reviewState === 'unreviewed' ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary overview-action-btn"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openLeadConfirmModal(finding.id, STEP_OVERVIEW);
                                    }}
                                  >
                                    ✓ Confirm as finding
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary overview-action-btn"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleRequestFindingDecision(finding.id, 'dismissed');
                                    }}
                                  >
                                    ✕ Dismiss
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-success overview-action-btn"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleRequestFindingDecision(finding.id, 'accepted');
                                    }}
                                  >
                                    ✓ Accept
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary overview-action-btn"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleRequestFindingDecision(finding.id, 'rejected');
                                    }}
                                  >
                                    ✕ Reject
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary overview-action-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenAddNote(finding.id, safeText(finding.detail, ''));
                                }}
                              >
                                📝 Add note
                              </button>
                            </div>
                            {inlineRejectFindingId === finding.id ? (
                              <div className="inline-decision-form">
                                <label className="modal-label" htmlFor={`overview-inline-reject-reason-${finding.id}`}>
                                  Reason category (required)
                                </label>
                                <select
                                  id={`overview-inline-reject-reason-${finding.id}`}
                                  className="modal-select"
                                  value={inlineRejectReason}
                                  onChange={(event) => setInlineRejectReason(event.target.value)}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {REVIEW_REASON_OPTIONS.map((option) => (
                                    <option key={`overview-reject-${finding.id}-${option.value}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <label className="modal-label" htmlFor={`overview-inline-reject-note-${finding.id}`}>
                                  Note {inlineRejectReason === 'other' ? '(required)' : '(optional)'}
                                </label>
                                <textarea
                                  id={`overview-inline-reject-note-${finding.id}`}
                                  className="modal-textarea"
                                  value={inlineRejectNote}
                                  onChange={(event) => setInlineRejectNote(event.target.value)}
                                  placeholder="Add detail for this decision..."
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div className="modal-actions">
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
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
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleConfirmInlineReject(finding.id);
                                    }}
                                  >
                                    Confirm rejection
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            {inlineDismissFindingId === finding.id ? (
                              <div className="inline-decision-form">
                                <label className="modal-label" htmlFor={`overview-inline-dismiss-reason-${finding.id}`}>
                                  Reason for dismissal (required)
                                </label>
                                <select
                                  id={`overview-inline-dismiss-reason-${finding.id}`}
                                  className="modal-select"
                                  value={inlineDismissReason}
                                  onChange={(event) => setInlineDismissReason(event.target.value)}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <option value="" disabled>
                                    Select a dismissal reason
                                  </option>
                                  {DISMISS_REASON_OPTIONS.map((option) => (
                                    <option key={`overview-dismiss-${finding.id}-${option.value}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <label className="modal-label" htmlFor={`overview-inline-dismiss-note-${finding.id}`}>
                                  Details {inlineDismissReason === 'other' ? '(required)' : '(optional)'}
                                </label>
                                <textarea
                                  id={`overview-inline-dismiss-note-${finding.id}`}
                                  className="modal-textarea"
                                  value={inlineDismissNote}
                                  onChange={(event) => setInlineDismissNote(event.target.value)}
                                  placeholder="Add detail for this dismissal..."
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div className="modal-actions">
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
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
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleConfirmInlineDismiss(finding.id);
                                    }}
                                  >
                                    Confirm dismissal
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            {noteTargetFindingId === finding.id ? (
                              <div className="inline-note-form">
                                <label className="modal-label" htmlFor={`overview-inline-note-${finding.id}`}>
                                  Add note
                                </label>
                                <textarea
                                  id={`overview-inline-note-${finding.id}`}
                                  className="modal-textarea"
                                  value={noteDraft}
                                  onChange={(event) => setNoteDraft(event.target.value)}
                                  placeholder="Add context for this finding..."
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div className="modal-actions">
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setNoteTargetFindingId(null);
                                      setNoteDraft('');
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="btn primary"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleSaveFindingNote();
                                    }}
                                  >
                                    Save note
                                  </button>
                                </div>
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
                          </div>
                        ) : null}
                      </article>
                    );
                  })())}
                </div>
              )}
              <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => openComposerModal('manual')}>
                  + Add manual finding
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
