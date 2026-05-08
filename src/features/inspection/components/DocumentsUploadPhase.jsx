import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const SOURCE_CLASSIFICATION_ENTRIES = [
  { groupLabel: 'Policy Document', optionLabel: 'AML Policy' },
  { groupLabel: 'Financial Record', optionLabel: 'Bank Statement' },
  { groupLabel: 'Financial Record', optionLabel: 'Giftor Source of Funds' },
  { groupLabel: 'Compliance Record', optionLabel: 'CDD Records' },
  { groupLabel: 'Compliance Record', optionLabel: 'Training Register' },
  { groupLabel: 'Compliance Record', optionLabel: 'Client Risk Assessment' },
  { groupLabel: 'Compliance Record', optionLabel: 'Sanctions Screening' },
  { groupLabel: 'Compliance Record', optionLabel: 'PEP Screening' },
  { groupLabel: 'Communications & Interviews', optionLabel: 'Interview Transcript' },
  { groupLabel: 'Policy Document', optionLabel: 'Complaints Procedure' },
  { groupLabel: 'Client Matter Document', optionLabel: 'Fee Estimate' },
  { groupLabel: 'Client Matter Document', optionLabel: 'Client Care Letter' },
  { groupLabel: 'Client Matter Document', optionLabel: 'Identity Verification' },
  { groupLabel: 'Client Matter Document', optionLabel: 'Proof of Address' },
  { groupLabel: 'Client Matter Document', optionLabel: 'Gift Letter' },
  { groupLabel: 'Client Matter Document', optionLabel: 'Giftor ID Verification' },
  { groupLabel: 'Client Matter Document', optionLabel: 'Source of Funds Declaration' }
];

const buildClassificationEntries = (documentClassificationGroups, currentValue, currentGroupLabel) => {
  const groupLookup = new Map(
    (documentClassificationGroups ?? []).flatMap((group) =>
      (group.options ?? []).map((option) => [option, group.label])
    )
  );

  const entries = SOURCE_CLASSIFICATION_ENTRIES.map((entry) => ({
    optionLabel: entry.optionLabel,
    groupLabel: groupLookup.get(entry.optionLabel) ?? entry.groupLabel
  }));

  if (currentValue && currentValue !== 'Unknown' && !entries.some((entry) => entry.optionLabel === currentValue)) {
    entries.push({
      optionLabel: currentValue,
      groupLabel: currentGroupLabel || groupLookup.get(currentValue) || currentValue
    });
  }

  return entries;
};

const buildClassificationGroups = (documentClassificationGroups, otherOption, currentGroupLabel, currentOptionLabel) => {
  const normalizedGroups = (documentClassificationGroups ?? []).map((group) => {
    const baseOptions = Array.isArray(group.options) ? [...group.options] : [];
    if (otherOption && !baseOptions.includes(otherOption)) {
      baseOptions.push(otherOption);
    }
    return {
      id: group.id,
      label: group.label,
      options: baseOptions
    };
  });

  if (
    currentGroupLabel &&
    !normalizedGroups.some((group) => group.label === currentGroupLabel)
  ) {
    normalizedGroups.push({
      id: `custom-${currentGroupLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      label: currentGroupLabel,
      options: currentOptionLabel ? [currentOptionLabel] : otherOption ? [otherOption] : []
    });
  }

  return normalizedGroups;
};

export default function DocumentsUploadPhase({
  setDocumentsPhase,
  uploadAreaCollapsed,
  openDocumentsFilePicker,
  handleRerunClassification,
  uploadItems,
  prepareUploadDraft,
  formatUploadClassificationLabel,
  isUploadClassificationResolved,
  isUploadReadyForConfirmation,
  expandedUploadSummaryId,
  setExpandedUploadSummaryId,
  resolveLinkedDocumentId,
  textOf,
  normalizeUploadInterviewees,
  isInterviewTranscriptUpload,
  isUploadLimitedAnalysis,
  hasIncompleteUploadInterviewees,
  uploadTableLastRowRef,
  activeClassificationMenu,
  setActiveClassificationMenu,
  documentClassificationGroups,
  documentClassificationOtherOption,
  handleUploadClassificationSelect,
  handleUploadClassificationDetailChange,
  handleViewDocument,
  stepDocuments,
  currentCaseMeta,
  toIsoDate,
  formatShortDisplayDate,
  toDateInputValue,
  handleUpdateUploadInterviewee,
  handleRemoveUploadInterviewee,
  handleAddUploadInterviewee,
  handleUploadFieldChange,
  handleToggleUploadConfirmed,
  renderConfidenceDots,
  resolveConfidenceState,
  unclassifiedUploadCount,
  lowConfidenceUploadCount,
  incompleteInterviewUploadCount,
  limitedAnalysisUploadCount,
  verifiedUploadCount,
  unverifiedUploadCount,
  confirmableUploadCount,
  allUploadsVerified,
  handleConfirmAllUploads,
  handleGenerateFindings,
  processingEntries,
  hasViewedUploadTableEnd
}) {
  void openDocumentsFilePicker;
  void uploadAreaCollapsed;
  void stepDocuments;
  void verifiedUploadCount;
  void incompleteInterviewUploadCount;
  void processingEntries;
  void currentCaseMeta;
  void toIsoDate;
  void formatShortDisplayDate;
  void renderConfidenceDots;

  const [classificationGroupByUploadId, setClassificationGroupByUploadId] = useState({});
  const [classificationMenuLayout, setClassificationMenuLayout] = useState(null);

  const closeClassificationMenu = () => {
    setActiveClassificationMenu(null);
    setClassificationMenuLayout(null);
  };

  const buildClassificationMenuLayout = (triggerNode, preferUpward = false) => {
    if (!(triggerNode instanceof HTMLElement) || typeof window === 'undefined') return null;

    const rect = triggerNode.getBoundingClientRect();
    const viewportPadding = 12;
    const menuWidth = Math.min(420, Math.max(280, window.innerWidth - viewportPadding * 2));
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding)
    );
    const availableBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding);
    const availableAbove = Math.max(0, rect.top - viewportPadding);
    const openUpward = preferUpward || (availableBelow < 260 && availableAbove > availableBelow);

    if (openUpward) {
      return {
        left,
        width: menuWidth,
        maxHeight: Math.max(180, availableAbove - 8),
        openUpward: true,
        bottom: Math.max(viewportPadding, window.innerHeight - rect.top + 8)
      };
    }

    return {
      left,
      width: menuWidth,
      maxHeight: Math.max(180, availableBelow - 8),
      openUpward: false,
      top: Math.min(window.innerHeight - viewportPadding, rect.bottom + 8)
    };
  };

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!event.target.closest('.classification-cell') && !event.target.closest('.classification-menu--portal')) {
        closeClassificationMenu();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeClassificationMenu();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setActiveClassificationMenu]);

  useEffect(() => {
    if (!activeClassificationMenu) return undefined;

    const handleViewportChange = () => {
      closeClassificationMenu();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [activeClassificationMenu]);

  const sourceEntryLookup = useMemo(
    () => new Map(SOURCE_CLASSIFICATION_ENTRIES.map((entry) => [entry.optionLabel, entry.groupLabel])),
    []
  );

  const classificationCorrectionCount = uploadItems.filter((item) => {
    const normalizedItem = prepareUploadDraft(item);
    const confidenceState = resolveConfidenceState(normalizedItem.confidence);
    return (
      !isUploadClassificationResolved(normalizedItem) ||
      confidenceState === 'attention' ||
      isUploadLimitedAnalysis(normalizedItem)
    );
  }).length;
  const generateFindingsBlockedReason =
    unclassifiedUploadCount > 0
      ? `Classify all ${unclassifiedUploadCount} remaining document${unclassifiedUploadCount === 1 ? '' : 's'} first.`
      : incompleteInterviewUploadCount > 0
        ? `Complete the interview details for ${incompleteInterviewUploadCount} transcript${incompleteInterviewUploadCount === 1 ? '' : 's'} before continuing.`
        : unverifiedUploadCount > 0
          ? `Confirm all ${unverifiedUploadCount} document${unverifiedUploadCount === 1 ? '' : 's'} before generating findings.`
          : '';

  return (
    <div className="docs-wireframe-phase">
      <div className="section-heading">
        <h2>
          Classification review <span className="docs-count-inline">({uploadItems.length})</span>
        </h2>
        <div className="section-heading-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDocumentsPhase('intake')}>
            Back to document intake
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleRerunClassification}>
            Re-run AI classification
          </button>
        </div>
      </div>

      <p className="panel-subtitle docs-phase-intro">
        Review the AI classifications, override anything that looks wrong, and confirm the rows you want used before
        generating findings.
      </p>

      {uploadItems.length === 0 ? (
        <div className="empty-state-inline">
          <h4>No classified documents yet</h4>
          <p>Go back to document intake to add files and run AI classification first.</p>
        </div>
      ) : (
        <div className="docs-wire-table-wrap">
          <table className="table docs-wire-table docs-wire-table--phase-one">
            <colgroup>
              <col style={{ width: '104px' }} />
              <col style={{ width: '31%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: '104px' }}>Confirm</th>
                <th>Classification</th>
                <th>Name</th>
                <th>Reason</th>
                <th>Justification</th>
              </tr>
            </thead>
            <tbody>
              {uploadItems.flatMap((item, index) => {
              const normalizedItem = prepareUploadDraft(item);
              const classification = formatUploadClassificationLabel(normalizedItem);
              const isClassifying = normalizedItem.status === 'queued';
              const isUnknown = !isUploadClassificationResolved(normalizedItem);
              const isVerified =
                normalizedItem.status === 'verified' && isUploadReadyForConfirmation(normalizedItem);
              const isReadyForConfirmation = isUploadReadyForConfirmation(normalizedItem);
              const confidenceState = resolveConfidenceState(normalizedItem.confidence);
              const interviewees = normalizeUploadInterviewees(normalizedItem);
              const isInterviewTranscript = isInterviewTranscriptUpload(normalizedItem);
              const isLimitedAnalysis = isUploadLimitedAnalysis(normalizedItem);
              const isLowConfidence = confidenceState === 'attention';
              const linkedDocumentId = resolveLinkedDocumentId(normalizedItem);
              const classificationReason = textOf(
                normalizedItem.classificationReason ?? normalizedItem.classification_reason,
                textOf(item.summary, '')
              );
              const classificationJustification = textOf(
                normalizedItem.classificationJustification ?? normalizedItem.classification_justification,
                ''
              );
              const rowClassName = [isLowConfidence ? 'row-amber' : '', isUnknown ? 'row-warning' : '', isClassifying ? 'row-classifying' : '']
                .filter(Boolean)
                .join(' ');
              const classificationEntries = buildClassificationEntries(
                documentClassificationGroups,
                classification,
                normalizedItem.classificationL1
              );
              const classificationGroups = buildClassificationGroups(
                documentClassificationGroups,
                documentClassificationOtherOption,
                normalizedItem.classificationL1,
                normalizedItem.classificationL2
              );
              const fallbackGroupLabel =
                normalizedItem.classificationL1 ||
                sourceEntryLookup.get(classification) ||
                classificationEntries[0]?.groupLabel ||
                classificationGroups[0]?.label ||
                '';
              const activeGroupLabel = classificationGroupByUploadId[item.id] || fallbackGroupLabel;
              const activeGroup =
                classificationGroups.find((group) => group.label === activeGroupLabel) ||
                classificationGroups[0] ||
                null;
              const isClassificationMenuOpen = activeClassificationMenu === item.id;
              const shouldOpenMenuUpward = isInterviewTranscript || index >= Math.max(uploadItems.length - 3, 0);
              const showClassificationDetailInput =
                normalizedItem.classificationL2 === documentClassificationOtherOption;

              const rows = [
                <tr
                  key={`upload-row-${item.id}`}
                  className={rowClassName}
                  ref={index === uploadItems.length - 1 ? uploadTableLastRowRef : null}
                >
                  <td className="docs-confirm-cell">
                    {isClassifying ? (
                      <span className="doc-status-icon classifying" title="Classifying...">
                        —
                      </span>
                    ) : (
                      <label
                        className={`doc-confirm-toggle ${isVerified ? 'is-checked' : ''} ${
                          !isReadyForConfirmation ? 'is-disabled' : ''
                        }`}
                        title={
                          isUnknown
                            ? 'Select classification first'
                            : hasIncompleteUploadInterviewees(normalizedItem)
                              ? 'Complete interviewee details first'
                              : isVerified
                                ? 'Untick to remove this document from findings generation'
                                : 'Tick to use this document for findings generation'
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isVerified}
                          disabled={!isReadyForConfirmation}
                          onChange={() => handleToggleUploadConfirmed(item.id)}
                          aria-label={`Use ${item.name} for findings generation`}
                        />
                        <span className="doc-confirm-toggle__control" aria-hidden="true" />
                      </label>
                    )}
                  </td>
                  <td>
                    {isClassifying ? (
                      <span className="classifying-text">
                        <span className="spinner" />
                        Classifying...
                      </span>
                    ) : (
                      <div
                        className={`classification-cell${isInterviewTranscript ? ' classification-cell--transcript' : ''}${
                          isClassificationMenuOpen ? ' classification-cell--menu-open' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className={`classification-trigger${isUnknown || isLowConfidence ? ' is-warning' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            const nextValue = activeClassificationMenu === item.id ? null : item.id;
                            if (nextValue) {
                              setClassificationGroupByUploadId((prevGroups) => ({
                                ...prevGroups,
                                [item.id]: fallbackGroupLabel
                              }));
                              setClassificationMenuLayout(
                                buildClassificationMenuLayout(event.currentTarget, shouldOpenMenuUpward)
                              );
                              setActiveClassificationMenu(nextValue);
                              return;
                            }

                            closeClassificationMenu();
                          }}
                          aria-expanded={isClassificationMenuOpen}
                        >
                          <span>{isUnknown ? 'Choose document type' : classification}</span>
                          <span className="classification-trigger__chevron">
                            {isClassificationMenuOpen ? '▲' : '▼'}
                          </span>
                        </button>

                        {isClassificationMenuOpen && activeGroup && typeof document !== 'undefined'
                          ? createPortal(
                              <div
                                className={`classification-menu classification-menu--portal${
                                  classificationMenuLayout?.openUpward ? ' classification-menu--upward' : ''
                                }`}
                                style={{
                                  left: `${classificationMenuLayout?.left ?? 12}px`,
                                  width: `${classificationMenuLayout?.width ?? 420}px`,
                                  maxHeight: `${classificationMenuLayout?.maxHeight ?? 280}px`,
                                  ...(classificationMenuLayout?.openUpward
                                    ? { bottom: `${classificationMenuLayout?.bottom ?? 12}px` }
                                    : { top: `${classificationMenuLayout?.top ?? 12}px` })
                                }}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <p className="classification-menu__hint">
                                  Choose the closest category first, then the specific subcategory.
                                </p>
                                <label className="classification-menu__field">
                                  <span className="classification-menu__heading">Category</span>
                                  <select
                                    className="classification-menu__select"
                                    value={activeGroup.label}
                                    onChange={(event) =>
                                      setClassificationGroupByUploadId((prev) => ({
                                        ...prev,
                                        [item.id]: event.target.value
                                      }))
                                    }
                                  >
                                    {classificationGroups.map((group) => (
                                      <option key={`${item.id}-${group.id}`} value={group.label}>
                                        {group.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="classification-menu__field">
                                  <span className="classification-menu__heading">Subcategory</span>
                                  <select
                                    className="classification-menu__select"
                                    value={normalizedItem.classificationL1 === activeGroup.label ? normalizedItem.classificationL2 ?? '' : ''}
                                    onChange={(event) => {
                                      if (!event.target.value) return;
                                      handleUploadClassificationSelect(item.id, activeGroup.label, event.target.value);
                                    }}
                                  >
                                    <option value="">Select subcategory</option>
                                    {activeGroup.options.map((optionLabel) => (
                                      <option
                                        key={`${item.id}-${activeGroup.label}-${optionLabel}`}
                                        value={optionLabel}
                                      >
                                        {optionLabel}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>,
                              document.body
                            )
                          : null}

                        {showClassificationDetailInput ? (
                          <input
                            type="text"
                            className="form-control form-control-sm classification-detail-input"
                            value={normalizedItem.classificationDetail ?? ''}
                            onChange={(event) =>
                              handleUploadClassificationDetailChange(item.id, event.target.value)
                            }
                            placeholder={`Describe ${normalizedItem.classificationL1?.toLowerCase() || 'document'} type...`}
                          />
                        ) : null}

                        {isLimitedAnalysis ? (
                          <span className="tooltip-wrap classification-tooltip">
                            <button type="button" className="classification-info-button" aria-label="Classification help">
                              i
                            </button>
                            <span className="tooltip-text">
                              Limited analysis. Classify more specifically for full processing.
                            </span>
                          </span>
                        ) : null}

                        {isInterviewTranscript ? (
                          <div className="interviewee-inline-card">
                            <div className="interviewee-inline-card__head">
                              <strong>Interview details</strong>
                              <span>Needed for transcript findings</span>
                            </div>
                            <div className="interviewee-inline-group">
                              {interviewees.map((interviewee, intervieweeIndex) => (
                                <div key={interviewee.id} className="interviewee-inline-row">
                                  <label className="interviewee-inline-field">
                                    <span className="interviewee-inline-field__label">Interviewee</span>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      value={interviewee.name}
                                      onChange={(event) =>
                                        handleUpdateUploadInterviewee(item.id, interviewee.id, 'name', event.target.value)
                                      }
                                      placeholder="Jane Smith"
                                      required
                                    />
                                  </label>
                                  <label className="interviewee-inline-field">
                                    <span className="interviewee-inline-field__label">Topic / role</span>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      value={interviewee.role}
                                      onChange={(event) =>
                                        handleUpdateUploadInterviewee(item.id, interviewee.id, 'role', event.target.value)
                                      }
                                      placeholder="MLRO / Compliance Officer"
                                      required
                                    />
                                  </label>
                                  <label className="interviewee-inline-field">
                                    <span className="interviewee-inline-field__label">Date</span>
                                    <input
                                      type="date"
                                      className="form-control form-control-sm"
                                      value={toDateInputValue(interviewee.date)}
                                      onChange={(event) =>
                                        handleUpdateUploadInterviewee(item.id, interviewee.id, 'date', event.target.value)
                                      }
                                    />
                                  </label>
                                  <label className="interviewee-inline-field">
                                    <span className="interviewee-inline-field__label">Context</span>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      value={interviewee.contextNote}
                                      onChange={(event) =>
                                        handleUpdateUploadInterviewee(
                                          item.id,
                                          interviewee.id,
                                          'contextNote',
                                          event.target.value
                                        )
                                      }
                                      placeholder="Optional context"
                                    />
                                  </label>
                                  {intervieweeIndex > 0 ? (
                                    <button
                                      type="button"
                                      className="interviewee-inline-remove-btn"
                                      onClick={() => handleRemoveUploadInterviewee(item.id, interviewee.id)}
                                      title="Remove interviewee"
                                    >
                                      ×
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm interviewee-inline-add-btn"
                                onClick={() => handleAddUploadInterviewee(item.id)}
                              >
                                + Add interviewee
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {linkedDocumentId ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleViewDocument(linkedDocumentId, null, null, stepDocuments)}
                        title="Open document viewer"
                      >
                        {item.name}
                      </button>
                    ) : (
                      item.name
                    )}
                  </td>
                  <td>
                    {isClassifying ? (
                      <span className="classifying-text">
                        <span className="spinner" />
                        Re-running AI classification...
                      </span>
                    ) : (
                      <div className="docs-reason-cell">
                        {classificationReason || '—'}
                      </div>
                    )}
                  </td>
                  <td>
                    {isClassifying ? (
                      <span className="dash-muted">—</span>
                    ) : (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={classificationJustification}
                        placeholder="Optional reviewer note..."
                        onChange={(event) =>
                          handleUploadFieldChange(item.id, 'classificationJustification', event.target.value)
                        }
                      />
                    )}
                  </td>
                </tr>
              ];

                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="warning-messages">
        <div className="warning-line muted">
          Tick each confirm box after the classification looks right. Only confirmed rows are used for findings generation.
        </div>
        {classificationCorrectionCount > 0 ? (
          <div className="warning-line amber">
            ⚠ {classificationCorrectionCount} document{classificationCorrectionCount === 1 ? '' : 's'} need
            classification attention before findings generation
          </div>
        ) : null}
        <div className="warning-line muted">
          ○ {unverifiedUploadCount} document{unverifiedUploadCount === 1 ? '' : 's'} not yet confirmed
        </div>
      </div>

      <div className="bottom-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm docs-bulk-confirm-btn"
          disabled={confirmableUploadCount === 0}
          onClick={() => {
            if (!window.confirm(`Confirm all remaining ${confirmableUploadCount} document${confirmableUploadCount === 1 ? '' : 's'}?`)) {
              return;
            }
            handleConfirmAllUploads();
          }}
          title={
            !hasViewedUploadTableEnd ? 'Confirm all classifications' : 'Confirm all classified rows'
          }
        >
          {confirmableUploadCount > 0
            ? `Confirm all classified rows (${confirmableUploadCount})`
            : 'All classified rows confirmed'}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={!allUploadsVerified}
          onClick={handleGenerateFindings}
          title={generateFindingsBlockedReason || 'Generate findings from the confirmed documents.'}
        >
          Generate findings
        </button>
      </div>
      {generateFindingsBlockedReason ? (
        <p className="empty-state-helper docs-action-helper">{generateFindingsBlockedReason}</p>
      ) : null}
    </div>
  );
}
