import { useMemo, useRef } from 'react';
import {
  DISMISS_REASON_OPTIONS,
  RECURRING_FINDING_IDS,
  REVIEW_REASON_OPTIONS,
  STEP_OVERVIEW
} from '../config.js';
import { isRequirementExcluded, isRequirementMet } from '../helpers.js';

export default function ComplianceCodeAreaSection({
  area,
  requirementsByCodeArea,
  requirementsById,
  availableFindings,
  filteredFindings,
  findingMatchesCodeArea,
  getFindingBucketId,
  expandedCodeAreaIds,
  setExpandedCodeAreaIds,
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
  handleShowGuidance,
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
  const codeAreaRowRef = useRef(null);

  const hasActiveFindingFilters = findingViewFilters.length > 0;
  const activeFindingFilterLabels = findingViewFilters
    .map((filterKey) => findingFilterLabelMap[filterKey] ?? filterKey)
    .filter(Boolean);
  const findingFilterButtonLabel = !hasActiveFindingFilters
    ? 'All findings'
    : activeFindingFilterLabels.length <= 2
      ? activeFindingFilterLabels.join(', ')
      : `${activeFindingFilterLabels.length} filters`;
  const isExpanded = Boolean(expandedCodeAreaIds?.[area.id]);
  const requirementRows = requirementsByCodeArea[area.id] ?? [];
  const assessableRequirementRows = requirementRows.filter((entry) => !isRequirementExcluded(entry.status));
  const mappedAreaFindings = availableFindings.filter((finding) => findingMatchesCodeArea(finding, area.id));
  const areaFindings = filteredFindings.filter((finding) => findingMatchesCodeArea(finding, area.id));
  const activeMappedAreaFindings = mappedAreaFindings.filter((finding) => {
    const reviewState = findingDecisions[finding.id] ?? 'unreviewed';
    return reviewState !== 'rejected' && reviewState !== 'dismissed';
  });
  const attentionCount = activeMappedAreaFindings.filter((entry) => getFindingBucketId(entry) === 'critical').length;
  const guidanceCount = activeMappedAreaFindings.filter((entry) => getFindingBucketId(entry) === 'warning').length;
  const goodPracticeCount = activeMappedAreaFindings.filter((entry) => getFindingBucketId(entry) === 'best_practice').length;
  const reviewRequiredCount = mappedAreaFindings.filter(
    (finding) => (findingDecisions[finding.id] ?? 'unreviewed') === 'unreviewed'
  ).length;
  const totalRequirements = assessableRequirementRows.length;
  const isFullyCompliant =
    reviewRequiredCount === 0 &&
    attentionCount === 0 &&
    guidanceCount === 0 &&
    (totalRequirements === 0 || assessableRequirementRows.filter((entry) => isRequirementMet(entry.status)).length === totalRequirements);
  const countParts = [];

  if (attentionCount > 0) {
    countParts.push({ key: 'non_compliant', label: `${attentionCount} non-compliant`, cls: 'count-non-compliant' });
  }
  if (goodPracticeCount > 0) {
    countParts.push({ key: 'good-practice', label: `${goodPracticeCount} good practice`, cls: 'count-gp' });
  }
  if (guidanceCount > 0) {
    countParts.push({ key: 'lead', label: `${guidanceCount} requires review`, cls: 'count-lead' });
  }

  const findingsByRequirement = useMemo(() => {
    const grouped = new Map();
    mappedAreaFindings.forEach((finding) => {
      const requirementId = safeText(finding?.requirementId || finding?.requirement_id, '');
      if (!requirementId) return;
      const rows = grouped.get(requirementId) ?? [];
      rows.push(finding);
      grouped.set(requirementId, rows);
    });
    return grouped;
  }, [mappedAreaFindings, safeText]);

  const reviewedFindingsCount = mappedAreaFindings.reduce(
    (count, finding) => ((findingDecisions[finding.id] ?? 'unreviewed') !== 'unreviewed' ? count + 1 : count),
    0
  );
  const progressTotal = mappedAreaFindings.length > 0 ? mappedAreaFindings.length : totalRequirements;
  const progressReviewed =
    mappedAreaFindings.length > 0
      ? reviewedFindingsCount
      : assessableRequirementRows.reduce((count, requirement) => {
          const relatedFindings = findingsByRequirement.get(requirement.id) ?? [];
          if (relatedFindings.length === 0) return count;
          return relatedFindings.every((finding) => (findingDecisions[finding.id] ?? 'unreviewed') !== 'unreviewed')
            ? count + 1
            : count;
        }, 0);
  const requirementProgressWidth =
    progressTotal === 0 ? 100 : Math.min(100, Math.max(0, (progressReviewed / progressTotal) * 100));
  const requirementProgressLabel =
    progressTotal === 0 ? 'Complete' : `${progressReviewed}/${progressTotal} reviewed`;

  const renderFindingCard = (finding) => {
    const findingBucket = getFindingBucketId(finding);
    const reviewState = findingDecisions[finding.id] ?? 'unreviewed';
    const isFindingExpanded = expandedOverviewFindingIds[finding.id] ?? false;
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
            ? '–'
            : '!';
    const severityLabel = findingSeverityBadgeMap[findingBucket] ?? 'Finding';
    const evidenceStrength = findingEvidenceStrengthMap[findingBucket] ?? {
      key: 'supported',
      label: 'Supported'
    };
    const isLeadFinding = isLeadFindingByTaxonomy(finding);
    const isInspectorAdded = isInspectorAddedFinding(finding);
    const showInlineLeadConfirm =
      leadConfirmOpen && leadConfirmOriginStep === STEP_OVERVIEW && leadConfirmFindingId === finding.id;
    const evidencePassages = buildEvidencePassages(finding);
    const canDeleteFinding = !finding.reference;
    const requirementId = safeText(finding?.requirementId || finding?.requirement_id, '');
    const linkedRequirement = requirementId ? requirementsById.get(requirementId) ?? null : null;
    const requirementHeading = safeText(
      linkedRequirement?.codeAreaLabel,
      safeText(formatReferenceText(finding.reference), area.label)
    );
    const requirementContent = safeText(
      linkedRequirement?.content,
      safeText(linkedRequirement?.label, formatReferenceText(finding.reference))
    );

    return (
      <article
        key={`code-area-finding-${area.id}-${finding.id}`}
        className={`finding-card ${
          findingBucket === 'warning' ? 'lead' : findingBucket === 'best_practice' ? 'compliant' : 'noncompliant'
        } ${isInspectorAdded ? 'inspector-added' : ''} ${isFindingExpanded ? 'expanded' : ''} ${
          reviewState === 'rejected' || reviewState === 'dismissed' ? 'is-muted' : ''
        }`}
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
              {RECURRING_FINDING_IDS.has(finding.id) ? <span className="recurring-badge">Previously flagged</span> : null}
              <span className={`finding-expand-chev${isFindingExpanded ? ' is-expanded' : ''}`}>▾</span>
            </div>
          </div>
          <div className="finding-header-actions">
            <span className={`evidence-badge ${evidenceStrength.key}`}>{evidenceStrength.label}</span>
            <span
              className={`finding-review-indicator ${reviewState}`}
              aria-label={reviewStatusLabel}
              title={reviewStatusLabel}
            >
              {reviewStatusSymbol}
            </span>
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
        <div className={`finding-card-body-wrap${isFindingExpanded ? ' is-expanded' : ''}`} aria-hidden={!isFindingExpanded}>
          <div className="finding-card-body">
            {linkedRequirement || finding.reference ? (
              <div className="finding-section">
                <div className="finding-section-head">
                  <div className="finding-section-label">Associated requirement</div>
                </div>
                <div className="finding-requirement-summary">
                  {requirementHeading ? <strong>{requirementHeading}</strong> : null}
                  {requirementContent ? (
                    <>
                      <div className="finding-section-label">Content</div>
                      <div className="finding-quote">{requirementContent}</div>
                    </>
                  ) : null}
                  <div className="finding-requirement-summary__actions">
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
              <p>{safeText(finding.detail, 'No detailed description available yet.')}</p>
            </div>
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
                        <div className="evidence-actions">
                          <span className="tooltip-wrap">
                            <button
                              type="button"
                              className="jump-link-btn"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleViewDocument(passage.documentId, passage.boxId || finding.boxId, finding.id, STEP_OVERVIEW);
                              }}
                            >
                              <span className="jump-link">Jump to evidence</span>
                            </button>
                            <span className="tooltip-text">Opens Document Viewer</span>
                          </span>
                        </div>
                      ) : null}
                    </div>
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
                      handleRequestFindingDecision(finding.id, 'accepted');
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
                    className="btn btn-sm btn-danger overview-action-btn"
                    disabled={reviewState === 'rejected'}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRequestFindingDecision(finding.id, 'rejected');
                    }}
                  >
                    {reviewState === 'rejected' ? '✕ Rejected' : '✕ Reject'}
                  </button>
                  {reviewState !== 'unreviewed' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary overview-action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRequestFindingDecision(finding.id, 'unreviewed');
                      }}
                    >
                      Revert
                    </button>
                  ) : null}
                </>
              )}
            </div>
            {showInlineLeadConfirm ? (
              <div className="confirm-lead-modal">
                <p>
                  <strong>Evidence Highlighting Flow (Screen 8)</strong>
                </p>
                <p>Confirming this review item will open the Evidence Highlighting view where you:</p>
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
                    className="btn btn-danger"
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
                    className="btn btn-danger"
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
        </div>
      </article>
    );
  };

  return (
    <div key={area.id}>
      <div
        ref={codeAreaRowRef}
        className={`code-area-row ${isExpanded ? 'expanded' : ''}${reviewRequiredCount > 0 ? ' has-pending-review' : ''}${
          reviewRequiredCount === 0 && isFullyCompliant ? ' is-complete' : ''
        }`}
        onClick={() => {
          const previousTop = codeAreaRowRef.current?.getBoundingClientRect().top ?? null;
          const nextExpanded = !isExpanded;
          setExpandedCodeAreaIds((prev) => ({
            ...prev,
            [area.id]: nextExpanded
          }));
          if (!nextExpanded) {
            const areaFindingIds = new Set(areaFindings.map((finding) => finding.id));
            setExpandedOverviewFindingIds((prev) => {
              const next = { ...prev };
              areaFindingIds.forEach((findingId) => {
                delete next[findingId];
              });
              return next;
            });
          }
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const nextTop = codeAreaRowRef.current?.getBoundingClientRect().top ?? null;
              if (previousTop === null || nextTop === null) return;
              const delta = nextTop - previousTop;
              if (Math.abs(delta) < 1) return;
              window.scrollBy({ top: delta, behavior: 'auto' });
            });
          });
        }}
      >
        <div className="code-area-chevron">▶</div>
        <div className="code-area-info">
          <div className="code-area-name">
            <span>{area.name}</span>
          </div>
          <div className="code-area-meta">
            <div className="code-area-progress" style={{ flex: 1 }}>
              <div className="progress-track">
                <div
                  className="progress-bar"
                  style={{
                    width: `${requirementProgressWidth}%`
                  }}
                />
              </div>
            </div>
            <div className="code-area-met">{requirementProgressLabel}</div>
            <div className="code-area-counts">
              {countParts.map((part, index) => (
                <span key={`${area.id}-${part.key}`} className={part.cls}>
                  {index > 0 ? <span className="sep">·</span> : null}
                  {part.label}
                </span>
              ))}
            </div>
            {reviewRequiredCount > 0 ? <span className="code-area-review-pill">{reviewRequiredCount} to review</span> : null}
          </div>
        </div>
      </div>

      <div
        className={`expanded-area overview-requirements-area${isExpanded ? ' is-expanded' : ''}`}
        aria-hidden={!isExpanded}
      >
          <div className="overview-requirements-area__content">
            <div className="overview-requirement-toolbar">
              <div className="filter-dropdown-wrap" ref={overviewFilterRef}>
                <button
                  type="button"
                  className={`filter-dropdown-btn ${hasActiveFindingFilters ? 'has-filter' : ''}`}
                  onClick={() => setOverviewFilterOpen((prev) => !prev)}
                  aria-expanded={overviewFilterOpen}
                  aria-haspopup="menu"
                >
                  Findings: {findingFilterButtonLabel}
                  <span className="dropdown-chevron">▼</span>
                </button>
                <div className={`filter-dropdown-panel ${overviewFilterOpen ? 'open' : ''}`} role="menu">
                  <label className="filter-checkbox">
                    <input type="checkbox" checked={!hasActiveFindingFilters} onChange={() => clearFindingViewFilters()} />
                    <span>{findingFilterLabelMap.all}</span>
                  </label>
                  <div className="filter-dropdown-divider" />
                  {['unreviewed', 'leads', 'non_compliant', 'compliant', 'good_practice', 'inspector_added'].map((filterKey) => (
                    <label key={`overview-filter-option-${filterKey}`} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={findingViewFilters.includes(filterKey)}
                        onChange={() => toggleFindingViewFilter(filterKey)}
                      />
                      <span>{findingFilterLabelMap[filterKey]}</span>
                    </label>
                  ))}
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

            {areaFindings.length === 0 ? (
              <div className="empty-state-inline">
                <h4>
                  {!hasActiveFindingFilters
                    ? 'No findings are currently mapped in this code area'
                    : 'No findings match the selected filter'}
                </h4>
                <p>
                  {!hasActiveFindingFilters
                    ? 'As processing evolves, this panel will populate with findings from the assessed evidence.'
                    : 'Try switching the finding filter back to All to restore the full view.'}
                </p>
              </div>
            ) : (
              <div className="overview-findings-column overview-findings-column--flat">
                {areaFindings.map((finding) => renderFindingCard(finding))}
              </div>
            )}

            <div className="manual-finding-hover-area" style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
              <button type="button" className="btn btn-sm btn-secondary manual-finding-btn" onClick={() => openComposerModal('manual')}>
                + Add manual finding
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}
