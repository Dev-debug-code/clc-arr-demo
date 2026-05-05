import { useMemo, useState } from 'react';
import {
  DISMISS_REASON_OPTIONS,
  RECURRING_FINDING_IDS,
  REQUIREMENT_KEYWORDS,
  REVIEW_REASON_OPTIONS,
  STEP_OVERVIEW
} from '../config.js';
import { isRequirementExcluded, isRequirementMet } from '../helpers.js';

const REQUIREMENT_SCOPE_OPTIONS = [
  { id: 'all', label: 'All requirements' },
  { id: 'needs_attention', label: 'Needs attention' }
];

const getRequirementStatusMeta = (status) => {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'reviewed') return { tone: 'reviewed', label: 'Reviewed' };
  if (normalized === 'non_compliant') return { tone: 'critical', label: 'Non-compliant' };
  if (normalized === 'lead') return { tone: 'guidance', label: 'Requires review' };
  if (normalized === 'good_practice') return { tone: 'good-practice', label: 'Good practice' };
  if (normalized === 'compliant' || normalized === 'pass') return { tone: 'compliant', label: 'Compliant' };
  if (normalized === 'not_assessed') return { tone: 'not-reviewed', label: 'Not reviewed' };
  if (normalized === 'not_applicable') return { tone: 'not-applicable', label: 'Not applicable' };

  return { tone: 'not-reviewed', label: 'Not reviewed' };
};

const getRequirementStatusIcon = (status) => {
  if (isRequirementMet(status)) return '✓';
  if (status === 'reviewed') return '✓';
  if (status === 'non_compliant') return '✕';
  if (status === 'not_applicable') return '–';
  if (status === 'not_assessed') return '○';
  return '●';
};

const normalizeRequirementStatusForDisplay = (status) => String(status || '').trim().toLowerCase();

export default function ComplianceCodeAreaSection({
  area,
  requirementsByCodeArea,
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
  const [requirementScope, setRequirementScope] = useState('all');
  const [expandedRequirementIds, setExpandedRequirementIds] = useState({});

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
    countParts.push({ key: 'attention', label: `${attentionCount} attention`, cls: 'count-attention' });
  }
  if (goodPracticeCount > 0) {
    countParts.push({ key: 'good-practice', label: `${goodPracticeCount} good practice`, cls: 'count-gp' });
  }
  if (guidanceCount > 0) {
    countParts.push({ key: 'lead', label: `${guidanceCount} requires review`, cls: 'count-lead' });
  }

  const activeRequirementId = overviewRequirementFilter.areaId === area.id ? overviewRequirementFilter.requirementId : '';

  const requirementCards = useMemo(() => {
    const findingMatchesRequirement = (finding, requirement) => {
      const explicitRequirementId = safeText(finding?.requirementId || finding?.requirement_id, '');
      if (explicitRequirementId && explicitRequirementId === requirement.id) {
        return true;
      }

      const keywords = [
        ...(REQUIREMENT_KEYWORDS[requirement.id] ?? []),
        safeText(requirement.label, '').toLowerCase(),
        String(requirement.id || '').trim().toLowerCase()
      ].filter(Boolean);

      if (keywords.length === 0) return false;

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
    };

    return assessableRequirementRows.map((requirement) => {
      const findings = areaFindings.filter((finding) => findingMatchesRequirement(finding, requirement));
      const activeFindings = findings.filter((finding) => {
        const reviewState = findingDecisions[finding.id] ?? 'unreviewed';
        return reviewState !== 'rejected' && reviewState !== 'dismissed';
      });
      const pendingReviewCount = findings.filter(
        (finding) => (findingDecisions[finding.id] ?? 'unreviewed') === 'unreviewed'
      ).length;
      const rawStatus = normalizeRequirementStatusForDisplay(requirement.status);
      let displayStatus = requirement.status;
      if (pendingReviewCount > 0 && activeFindings.some((finding) => getFindingBucketId(finding) === 'critical')) {
        displayStatus = 'non_compliant';
      } else if (pendingReviewCount > 0 && activeFindings.some((finding) => getFindingBucketId(finding) === 'warning')) {
        displayStatus = 'lead';
      } else if (
        pendingReviewCount === 0 &&
        activeFindings.some((finding) => {
          const bucket = getFindingBucketId(finding);
          return bucket === 'critical' || bucket === 'warning';
        })
      ) {
        displayStatus = 'reviewed';
      } else if (activeFindings.some((finding) => getFindingBucketId(finding) === 'best_practice')) {
        displayStatus = 'good_practice';
      } else if (activeFindings.some((finding) => getFindingBucketId(finding) === 'pass')) {
        displayStatus = 'compliant';
      } else if (['non_compliant', 'lead', 'not_assessed'].includes(rawStatus)) {
        displayStatus = 'compliant';
      }
      const statusMeta = getRequirementStatusMeta(displayStatus);
      const bucketCounts = activeFindings.reduce(
        (acc, finding) => {
          const bucket = getFindingBucketId(finding);
          if (bucket === 'critical') acc.critical += 1;
          if (bucket === 'warning') acc.guidance += 1;
          if (bucket === 'best_practice') acc.goodPractice += 1;
          if (bucket === 'pass') acc.compliant += 1;
          return acc;
        },
        { critical: 0, guidance: 0, goodPractice: 0, compliant: 0 }
      );
      const requiresAttention = pendingReviewCount > 0;

      return {
        ...requirement,
        displayStatus,
        findings,
        activeFindings,
        statusMeta,
        bucketCounts,
        pendingReviewCount,
        requiresAttention
      };
    });
  }, [assessableRequirementRows, areaFindings, findingDecisions, getFindingBucketId, safeText]);

  const mappedRequirementIds = new Set(
    requirementCards.filter((card) => card.findings.length > 0).map((card) => card.id)
  );
  const unmappedFindings = areaFindings.filter((finding) => {
    const explicitRequirementId = safeText(finding?.requirementId || finding?.requirement_id, '');
    if (explicitRequirementId && mappedRequirementIds.has(explicitRequirementId)) return false;
    return !requirementCards.some((card) => card.findings.some((entry) => entry.id === finding.id));
  });
  const visibleRequirementCards = useMemo(() => {
    const scopedCards =
      requirementScope === 'needs_attention'
        ? requirementCards.filter((card) => card.requiresAttention)
        : requirementCards;

    return [...scopedCards].sort((left, right) => {
      if (left.requiresAttention !== right.requiresAttention) {
        return left.requiresAttention ? -1 : 1;
      }
      if (left.pendingReviewCount !== right.pendingReviewCount) {
        return right.pendingReviewCount - left.pendingReviewCount;
      }
      return left.label.localeCompare(right.label);
    });
  }, [requirementCards, requirementScope]);

  const reviewedRequirements = requirementCards.filter((card) => card.pendingReviewCount === 0).length;
  const requirementProgressWidth =
    totalRequirements === 0 ? 100 : Math.min(100, Math.max(0, (reviewedRequirements / totalRequirements) * 100));
  const requirementProgressLabel =
    totalRequirements === 0 ? 'Complete' : `${reviewedRequirements}/${totalRequirements} reviewed`;

  const toggleRequirementCard = (requirementId) => {
    const currentlyExpanded = expandedRequirementIds[requirementId] ?? activeRequirementId === requirementId;
    const nextExpanded = !currentlyExpanded;

    setExpandedRequirementIds((prev) => ({
      ...prev,
      [requirementId]: nextExpanded
    }));

    setOverviewRequirementFilter((prev) => {
      const isActive = prev.areaId === area.id && prev.requirementId === requirementId;
      if (isActive && !nextExpanded) {
        return { areaId: '', requirementId: '' };
      }
      return { areaId: area.id, requirementId };
    });
  };

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
      leadConfirmOpen && leadConfirmOriginStep === STEP_OVERVIEW && leadConfirmFindingId === finding.id;
    const evidencePassages = buildEvidencePassages(finding);
    const canDeleteFinding = !finding.reference;
    const canResetDecision = !isLeadFinding && reviewState !== 'unreviewed';
    const showInlineReset = canResetDecision && !canDeleteFinding;

    return (
      <article
        key={`code-area-finding-${area.id}-${finding.id}`}
        className={`finding-card ${
          findingBucket === 'warning' ? 'lead' : findingBucket === 'best_practice' ? 'compliant' : 'noncompliant'
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
              {RECURRING_FINDING_IDS.has(finding.id) ? <span className="recurring-badge">Previously flagged</span> : null}
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
                  <p>Current uploaded material does not provide enough certainty to classify this as a confirmed finding.</p>
                </div>
                <div className="lead-section">
                  <div className="lead-section-title">Suggested action</div>
                  <p>Use &quot;Jump to evidence&quot; and request missing context from the practice before confirming or dismissing.</p>
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
                              handleViewDocument(passage.documentId, passage.boxId || finding.boxId, finding.id, STEP_OVERVIEW);
                            }}
                          >
                            <span className="jump-link">Jump to evidence</span>
                          </button>
                          <span className="tooltip-text">Opens Document Viewer</span>
                        </span>
                      ) : null}
                    </div>
                    {passage.excerpt ? <div className="excerpt">&quot;{passage.excerpt}&quot;</div> : null}
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
  };

  return (
    <div key={area.id}>
      <div
        className={`code-area-row ${isExpanded ? 'expanded' : ''}${reviewRequiredCount > 0 ? ' has-pending-review' : ''}`}
        onClick={() =>
          setExpandedCodeAreaIds((prev) => ({
            ...prev,
            [area.id]: !prev?.[area.id]
          }))
        }
      >
        <div className="code-area-chevron">▶</div>
        <div className="code-area-info">
          <div className="code-area-name">
            <span>{area.name}</span>
            {reviewRequiredCount > 0 ? (
              <span className="code-area-attention-badge" aria-label={`${reviewRequiredCount} items to review`}>
                {reviewRequiredCount}
              </span>
            ) : null}
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
        {isFullyCompliant ? <span className="fully-compliant">✓</span> : null}
      </div>

      {isExpanded ? (
        <div className="expanded-area overview-requirements-area">
          <div className="overview-requirements-area__content">
            <div className="overview-requirement-toolbar">
              <div className="requirement-scope-toggle" role="tablist" aria-label="Requirement scope">
                {REQUIREMENT_SCOPE_OPTIONS.map((option) => (
                  <button
                    key={`${area.id}-${option.id}`}
                    type="button"
                    className={`requirement-scope-btn${requirementScope === option.id ? ' active' : ''}`}
                    onClick={() => setRequirementScope(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
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
                  {['unreviewed', 'leads', 'non_compliant', 'good_practice', 'inspector_added'].map((filterKey) => (
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

            {activeRequirementId ? (
              <div className="filter-clear visible">
                <button
                  type="button"
                  className="btn btn-xs ghost"
                  onClick={() => setOverviewRequirementFilter({ areaId: '', requirementId: '' })}
                >
                  Show all requirements
                </button>
              </div>
            ) : null}

            {visibleRequirementCards.length === 0 && unmappedFindings.length === 0 ? (
              <div className="empty-state-inline">
                <h4>
                  {requirementScope === 'needs_attention'
                    ? 'No requirements currently need attention'
                    : !hasActiveFindingFilters
                      ? 'No requirements currently mapped'
                      : 'No requirements match the selected filter'}
                </h4>
                <p>
                  {requirementScope === 'needs_attention'
                    ? 'This code area is currently passing or excluded from review.'
                    : !hasActiveFindingFilters
                      ? 'As processing evolves, this panel will populate with linked findings.'
                      : 'Try switching the finding filter back to All to restore the full view.'}
                </p>
              </div>
            ) : (
              <div className="overview-requirement-list">
                {visibleRequirementCards.map((requirement) => {
                  const isRequirementExpanded = expandedRequirementIds[requirement.id] ?? activeRequirementId === requirement.id;
                  const linkedFindingsLabel =
                    requirement.findings.length === 1 ? '1 linked finding' : `${requirement.findings.length} linked findings`;

                  return (
                    <article
                      key={`${area.id}-${requirement.id}`}
                      className={`overview-requirement-card ${requirement.statusMeta.tone}${
                        activeRequirementId === requirement.id ? ' active-filter' : ''
                      }${requirement.requiresAttention ? ' needs-attention' : ''}`}
                    >
                      <button
                        type="button"
                        className="overview-requirement-card__header"
                        onClick={() => toggleRequirementCard(requirement.id)}
                        aria-expanded={isRequirementExpanded}
                      >
                        <div className="overview-requirement-card__summary">
                          <span className={`req-icon ${requirement.displayStatus}`}>
                            {getRequirementStatusIcon(requirement.displayStatus)}
                          </span>
                          <div>
                            <div className="overview-requirement-card__title">
                              <span>{requirement.label}</span>
                              {requirement.pendingReviewCount > 0 ? (
                                <span
                                  className="overview-tab-attention-badge"
                                  aria-label={`${requirement.pendingReviewCount} findings to review`}
                                >
                                  {requirement.pendingReviewCount}
                                </span>
                              ) : null}
                            </div>
                            <div className="overview-requirement-card__detail">
                              {requirement.findings.length > 0 ? linkedFindingsLabel : 'No linked findings yet'}
                            </div>
                          </div>
                        </div>
                        <div className="overview-requirement-card__meta">
                          {requirement.pendingReviewCount > 0 ? (
                            <span className="overview-requirement-badge review">
                              {requirement.pendingReviewCount} to review
                            </span>
                          ) : null}
                          <span className={`overview-requirement-tag ${requirement.statusMeta.tone}`}>{requirement.statusMeta.label}</span>
                          {requirement.pendingReviewCount > 0 && requirement.bucketCounts.critical > 0 ? (
                            <span className="overview-requirement-badge critical">{requirement.bucketCounts.critical} critical</span>
                          ) : null}
                          {requirement.pendingReviewCount > 0 && requirement.bucketCounts.guidance > 0 ? (
                            <span className="overview-requirement-badge guidance">{requirement.bucketCounts.guidance} requires review</span>
                          ) : null}
                          <span className="finding-expand-chev">{isRequirementExpanded ? '▾' : '▸'}</span>
                        </div>
                      </button>

                      {isRequirementExpanded ? (
                        <div className="overview-requirement-card__body">
                          {requirement.findings.length === 0 ? (
                            <div className="overview-requirement-empty">
                              <p>No finding is currently linked to this requirement.</p>
                            </div>
                          ) : (
                            <div className="overview-findings-column">
                              {requirement.findings.map((finding) => renderFindingCard(finding))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}

                {unmappedFindings.length > 0 ? (
                  <section className="overview-unmapped-findings">
                    <div className="overview-unmapped-findings__head">
                      <h4>Other findings</h4>
                      <p>These findings are in this code area but are not linked to a specific requirement yet.</p>
                    </div>
                    <div className="overview-findings-column">
                      {unmappedFindings.map((finding) => renderFindingCard(finding))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}

            <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => openComposerModal('manual')}>
                + Add manual finding
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
