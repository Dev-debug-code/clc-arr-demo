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
  findingViewFilters,
  setOverviewFilterOpen,
  overviewFilterOpen,
  findingFilterLabelMap,
  toggleFindingViewFilter,
  clearFindingViewFilters,
  findingDecisions,
  expandedOverviewFindingIds,
  setExpandedOverviewFindingIds,
  findingSeverityBadgeMap,
  findingEvidenceStrengthMap,
  isLeadFindingByTaxonomy,
  isInspectorAddedFinding,
  buildEvidencePassages,
  safeText,
  formatReferenceText,
  activeMenuFindingId,
  setActiveMenuFindingId,
  findingMenuRef,
  handleRequestFindingDecision,
  handleDeleteFinding,
  handleJumpToRequirement,
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
  leadConfirmOpen,
  leadConfirmFindingId,
  leadConfirmOriginStep,
  closeLeadConfirmModal,
  launchLeadEvidenceHighlighter,
  openComposerModal
}) {
  const hasActiveFindingFilters = findingViewFilters.length > 0;
  const activeFindingFilterLabels = findingViewFilters
    .map((filterKey) => findingFilterLabelMap[filterKey] ?? filterKey)
    .filter(Boolean);
  const findingFilterButtonLabel = !hasActiveFindingFilters
    ? 'All'
    : activeFindingFilterLabels.length <= 2
      ? activeFindingFilterLabels.join(', ')
      : `${activeFindingFilterLabels.length} filters`;
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
                <div className="filter-dropdown-wrap" ref={overviewFilterRef}>
                  <button
                    type="button"
                    className={`filter-dropdown-btn ${hasActiveFindingFilters ? 'has-filter' : ''}`}
                    onClick={() => setOverviewFilterOpen((prev) => !prev)}
                    aria-expanded={overviewFilterOpen}
                    aria-haspopup="menu"
                  >
                    Filter: {findingFilterButtonLabel}
                    <span className="dropdown-chevron">▼</span>
                  </button>
                  <div className={`filter-dropdown-panel ${overviewFilterOpen ? 'open' : ''}`} role="menu">
                    {['all'].map((filterKey) => (
                      <label key={`overview-filter-option-${filterKey}`} className="filter-checkbox">
                        <input
                          type="checkbox"
                          checked={!hasActiveFindingFilters}
                          onChange={() => clearFindingViewFilters()}
                        />
                        <span>{findingFilterLabelMap[filterKey]}</span>
                      </label>
                    ))}
                    <div className="filter-dropdown-divider" />
                    {['unreviewed', 'leads', 'non_compliant', 'good_practice', 'inspector_added'].map(
                      (filterKey) => (
                        <label key={`overview-filter-option-${filterKey}`} className="filter-checkbox">
                          <input
                            type="checkbox"
                            checked={findingViewFilters.includes(filterKey)}
                            onChange={() => toggleFindingViewFilter(filterKey)}
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
                          checked={findingViewFilters.includes(filterKey)}
                          onChange={() => toggleFindingViewFilter(filterKey)}
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
                    Filtering by:{' '}
                    <strong>{requirementRows.find((entry) => entry.id === activeRequirementId)?.label ?? activeRequirementId}</strong>
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs ghost"
                    onClick={() => setOverviewRequirementFilter({ areaId: '', requirementId: '' })}
                  >
                    ✕ Clear
                  </button>
                </div>
              ) : null}
              {areaFindingsFilteredByRequirement.length === 0 ? (
                <div className="empty-state-inline">
                  <h4>
                    {!hasActiveFindingFilters ? 'No findings currently mapped' : 'No findings match the selected filter'}
                  </h4>
                  <p>
                    {!hasActiveFindingFilters
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
                    const severityLabel = findingSeverityBadgeMap[findingBucket] ?? 'Finding';
                    const evidenceStrength = findingEvidenceStrengthMap[findingBucket] ?? {
                      key: 'supported',
                      label: 'Supported'
                    };
                    const isLeadFinding = isLeadFindingByTaxonomy(finding);
                    const isInspectorAdded = isInspectorAddedFinding(finding);
                    const showInlineLeadConfirm =
                      leadConfirmOpen &&
                      leadConfirmOriginStep === STEP_OVERVIEW &&
                      leadConfirmFindingId === finding.id;
                    const evidencePassages = buildEvidencePassages(finding);
                    const canDeleteFinding = !finding.reference;
                    const canResetDecision = !isLeadFinding && reviewState !== 'unreviewed';
                    const showInlineReset = canResetDecision && !canDeleteFinding;

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
                              <span className={`finding-severity-label severity-${findingBucket}`}>{severityLabel}</span>
                              <span className="finding-title-text">{safeText(finding.title, 'Finding')}</span>
                              <span className="finding-title-meta">
                                <span className={`evidence-badge ${evidenceStrength.key}`}>{evidenceStrength.label}</span>
                                <span className={`source-tag ${isInspectorAdded ? 'inspector' : 'system'}`}>
                                  {finding.reference ? '⚙ System' : '👤 Inspector-added'}
                                </span>
                              </span>
                              {reviewState === 'unreviewed' ? <span className="new-badge">New</span> : null}
                              {RECURRING_FINDING_IDS.has(finding.id) ? (
                                <span className="recurring-badge">Previously flagged</span>
                              ) : null}
                              <span className="finding-expand-chev">{isFindingExpanded ? '▾' : '▸'}</span>
                            </div>
                            <div className="review-status-wrap">
                              <span className={`review-status ${reviewState}`}>
                                {reviewStatusSymbol} {reviewStatusLabel}
                              </span>
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
                        {isFindingExpanded ? (
                          <div className="finding-card-body">
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
                                    <span className="tooltip-text">Highlights the linked requirement</span>
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
                                    Confirm as finding
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary overview-action-btn"
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
                                    className="btn btn-sm btn-success overview-action-btn"
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
                                    className="btn btn-sm btn-secondary overview-action-btn"
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
                            {showInlineLeadConfirm ? (
                              <div className="confirm-lead-modal">
                                <p>
                                  <strong>Evidence Highlighting Flow (Screen 8)</strong>
                                </p>
                                <p>Confirming this lead will open the Evidence Highlighting view where you:</p>
                                <ul>
                                  <li>Select the severity level for the finding</li>
                                  <li>Link evidence to specific document passage(s)</li>
                                  <li>The finding will then appear as a confirmed, evidence-anchored finding</li>
                                </ul>
                                <div className="modal-actions">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      closeLeadConfirmModal();
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      launchLeadEvidenceHighlighter();
                                    }}
                                  >
                                    Open Evidence Highlighter
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            {inlineRejectFindingId === finding.id ? (
                              <div className="inline-decision-form">
                                <label className="modal-label" htmlFor={`overview-inline-reject-reason-${finding.id}`}>
                                  Reason for rejection (required)
                                </label>
                                <select
                                  id={`overview-inline-reject-reason-${finding.id}`}
                                  className="modal-select"
                                  value={inlineRejectReason}
                                  onChange={(event) => setInlineRejectReason(event.target.value)}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <option value="" disabled>
                                    Select reason...
                                  </option>
                                  {REVIEW_REASON_OPTIONS.map((option) => (
                                    <option key={`overview-reject-${finding.id}-${option.value}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <label className="modal-label" htmlFor={`overview-inline-reject-note-${finding.id}`}>
                                  Additional detail (required for Other)
                                </label>
                                <textarea
                                  id={`overview-inline-reject-note-${finding.id}`}
                                  className="modal-textarea"
                                  value={inlineRejectNote}
                                  onChange={(event) => setInlineRejectNote(event.target.value)}
                                  placeholder="Provide additional detail..."
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div className="modal-actions">
                                  <button
                                    type="button"
                                    className="btn danger"
                                    disabled={inlineRejectReason === 'other' && !inlineRejectNote.trim()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleConfirmInlineReject(finding.id, true);
                                    }}
                                  >
                                    Confirm rejection
                                  </button>
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
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
                                    Select reason...
                                  </option>
                                  {DISMISS_REASON_OPTIONS.map((option) => (
                                    <option key={`overview-dismiss-${finding.id}-${option.value}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <label className="modal-label" htmlFor={`overview-inline-dismiss-note-${finding.id}`}>
                                  Additional detail (required for Other)
                                </label>
                                <textarea
                                  id={`overview-inline-dismiss-note-${finding.id}`}
                                  className="modal-textarea"
                                  value={inlineDismissNote}
                                  onChange={(event) => setInlineDismissNote(event.target.value)}
                                  placeholder="Provide additional detail..."
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div className="modal-actions">
                                  <button
                                    type="button"
                                    className="btn danger"
                                    disabled={!inlineDismissReason || (inlineDismissReason === 'other' && !inlineDismissNote.trim())}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleConfirmInlineDismiss(finding.id, true);
                                    }}
                                  >
                                    Dismiss
                                  </button>
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
                                </div>
                              </div>
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
