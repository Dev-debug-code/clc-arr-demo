import { useEffect, useMemo, useState } from 'react';

const SOURCE_CLASSIFICATION_ENTRIES = [
  { groupLabel: 'Policy Document', optionLabel: 'AML Policy' },
  { groupLabel: 'Financial Record', optionLabel: 'Bank Statement' },
  { groupLabel: 'Compliance Record', optionLabel: 'CDD Records' },
  { groupLabel: 'Compliance Record', optionLabel: 'Training Register' },
  { groupLabel: 'Communications & Interviews', optionLabel: 'Interview Transcript' },
  { groupLabel: 'Policy Document', optionLabel: 'Complaints Procedure' },
  { groupLabel: 'Client Matter Document', optionLabel: 'Fee Estimate' }
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
  uploadAreaCollapsed,
  setUploadAreaCollapsed,
  openDocumentsFilePicker,
  handleUploadDrop,
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
  void stepDocuments;
  void verifiedUploadCount;
  void incompleteInterviewUploadCount;
  void processingEntries;

  const [classificationGroupByUploadId, setClassificationGroupByUploadId] = useState({});
  const [partyInputUploadId, setPartyInputUploadId] = useState('');
  const [partyInputValue, setPartyInputValue] = useState('');

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!event.target.closest('.classification-cell')) {
        setActiveClassificationMenu(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveClassificationMenu(null);
        setPartyInputUploadId('');
        setPartyInputValue('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setActiveClassificationMenu]);

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

  return (
    <div className="docs-wireframe-phase">
      {uploadAreaCollapsed ? (
        <button type="button" className="upload-collapsed" onClick={() => setUploadAreaCollapsed(false)}>
          + Add more documents
        </button>
      ) : (
        <div
          className="upload-area"
          role="button"
          tabIndex={0}
          onClick={openDocumentsFilePicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openDocumentsFilePicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={handleUploadDrop}
        >
          <div className="upload-icon">☁</div>
          <div className="upload-title">Drop files here or click to upload</div>
          <div className="upload-subtitle">PDF documents up to 32MB each</div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={(event) => {
              event.stopPropagation();
              openDocumentsFilePicker();
            }}
          >
            Choose files
          </button>
        </div>
      )}

      <div className="section-heading">
        <h2>
          Uploaded Documents <span className="docs-count-inline">({uploadItems.length})</span>
        </h2>
      </div>

      {uploadItems.length === 0 ? (
        <div className="empty-state-inline">
          <h4>No uploads queued</h4>
          <p>Add documents to begin classification and verification.</p>
        </div>
      ) : (
        <table className="table docs-wire-table docs-wire-table--phase-one">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>✓</th>
              <th>Name</th>
              <th>Classification</th>
              <th>Parties</th>
              <th style={{ width: '100px' }}>Confidence</th>
              <th style={{ width: '80px' }}>Added</th>
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
              const showSummary = expandedUploadSummaryId === item.id && textOf(item.summary, '');
              const confidenceState = resolveConfidenceState(normalizedItem.confidence);
              const parties = textOf(normalizedItem.parties, '')
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean);
              const interviewees = normalizeUploadInterviewees(normalizedItem);
              const isInterviewTranscript = isInterviewTranscriptUpload(normalizedItem);
              const isLimitedAnalysis = isUploadLimitedAnalysis(normalizedItem);
              const isLowConfidence = confidenceState === 'attention';
              const linkedDocumentId = resolveLinkedDocumentId(normalizedItem);
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
              const showClassificationDetailInput =
                normalizedItem.classificationL2 === documentClassificationOtherOption;

              const rows = [
                <tr
                  key={`upload-row-${item.id}`}
                  className={rowClassName}
                  ref={index === uploadItems.length - 1 ? uploadTableLastRowRef : null}
                >
                  <td>
                    {isClassifying ? (
                      <span className="doc-status-icon classifying" title="Classifying...">
                        —
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={`doc-status-icon ${isVerified ? 'confirmed' : 'unconfirmed'}`}
                        onClick={() => handleToggleUploadConfirmed(item.id)}
                        title={
                          isUnknown
                            ? 'Select classification first'
                            : hasIncompleteUploadInterviewees(normalizedItem)
                              ? 'Complete interviewee details first'
                              : isVerified
                                ? 'Click to unconfirm'
                                : 'Click to confirm'
                        }
                        disabled={!isReadyForConfirmation}
                      >
                        {isVerified ? '✓' : '○'}
                      </button>
                    )}
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {item.summary ? (
                      <button
                        type="button"
                        className="summary-toggle-inline"
                        onClick={() => setExpandedUploadSummaryId((prev) => (prev === item.id ? '' : item.id))}
                      >
                        {showSummary ? '▼' : '▶'}
                      </button>
                    ) : null}
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
                        Classifying...
                      </span>
                    ) : (
                      <div className="classification-cell">
                        <button
                          type="button"
                          className={`classification-trigger${isUnknown || isLowConfidence ? ' is-warning' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveClassificationMenu((prev) => {
                              const nextValue = prev === item.id ? null : item.id;
                              if (nextValue) {
                                setClassificationGroupByUploadId((prevGroups) => ({
                                  ...prevGroups,
                                  [item.id]: fallbackGroupLabel
                                }));
                              }
                              return nextValue;
                            });
                          }}
                          aria-expanded={isClassificationMenuOpen}
                        >
                          <span>{isUnknown ? '-- Select classification --' : classification}</span>
                          <span className="classification-trigger__chevron">
                            {isClassificationMenuOpen ? '▲' : '▼'}
                          </span>
                        </button>

                        {isClassificationMenuOpen && activeGroup ? (
                          <div className="classification-menu" onClick={(event) => event.stopPropagation()}>
                            <div className="classification-menu__groups">
                              {classificationGroups.map((group) => (
                                <button
                                  key={`${item.id}-${group.id}`}
                                  type="button"
                                  className={`classification-menu__group${group.label === activeGroup.label ? ' active' : ''}`}
                                  onMouseEnter={() =>
                                    setClassificationGroupByUploadId((prev) => ({
                                      ...prev,
                                      [item.id]: group.label
                                    }))
                                  }
                                  onFocus={() =>
                                    setClassificationGroupByUploadId((prev) => ({
                                      ...prev,
                                      [item.id]: group.label
                                    }))
                                  }
                                  onClick={() =>
                                    setClassificationGroupByUploadId((prev) => ({
                                      ...prev,
                                      [item.id]: group.label
                                    }))
                                  }
                                >
                                  {group.label}
                                </button>
                              ))}
                            </div>
                            <div className="classification-menu__options">
                              <div className="classification-menu__heading">{activeGroup.label}</div>
                              {activeGroup.options.map((optionLabel) => (
                                <button
                                  key={`${item.id}-${activeGroup.label}-${optionLabel}`}
                                  type="button"
                                  className={`classification-menu__option${
                                    optionLabel === documentClassificationOtherOption ? ' classification-menu__option--limited' : ''
                                  }`}
                                  onClick={() =>
                                    handleUploadClassificationSelect(item.id, activeGroup.label, optionLabel)
                                  }
                                >
                                  {optionLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

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

                        {isInterviewTranscript ? (
                          <div className="interviewee-group">
                            {interviewees.map((interviewee, intervieweeIndex) => (
                              <div key={interviewee.id} className="interviewee-row">
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={interviewee.name}
                                  onChange={(event) =>
                                    handleUpdateUploadInterviewee(item.id, interviewee.id, 'name', event.target.value)
                                  }
                                  placeholder="Name *"
                                  required
                                  style={{ flex: 1 }}
                                />
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={interviewee.role}
                                  onChange={(event) =>
                                    handleUpdateUploadInterviewee(item.id, interviewee.id, 'role', event.target.value)
                                  }
                                  placeholder="Role *"
                                  required
                                  style={{ width: '120px' }}
                                />
                                <input
                                  type="date"
                                  className="form-control form-control-sm"
                                  value={toDateInputValue(interviewee.date)}
                                  onChange={(event) =>
                                    handleUpdateUploadInterviewee(item.id, interviewee.id, 'date', event.target.value)
                                  }
                                  style={{ width: '140px' }}
                                />
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
                                  placeholder="Context note..."
                                  style={{ flex: 1 }}
                                />
                                {intervieweeIndex > 0 ? (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => handleRemoveUploadInterviewee(item.id, interviewee.id)}
                                    title="Remove"
                                    style={{ fontSize: '1rem', padding: '2px 6px' }}
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </div>
                            ))}
                            <a
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                handleAddUploadInterviewee(item.id);
                              }}
                            >
                              + Add interviewee
                            </a>
                          </div>
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
                      </div>
                    )}
                  </td>
                  <td>
                    {isClassifying ? (
                      <span className="dash-muted">—</span>
                    ) : (
                      <div className="party-chip-row">
                        {parties.map((party, partyIndex) => (
                          <span key={`${item.id}-party-${party}-${partyIndex}`} className="party-chip">
                            {party}
                            <button
                              type="button"
                              className="chip-remove"
                              onClick={() => {
                                const nextParties = parties.filter((_, rowIndex) => rowIndex !== partyIndex);
                                handleUploadFieldChange(item.id, 'parties', nextParties.join(', '));
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {partyInputUploadId === item.id ? (
                          <input
                            type="text"
                            className="form-control form-control-sm party-chip-input"
                            value={partyInputValue}
                            placeholder="Party name..."
                            onChange={(event) => setPartyInputValue(event.target.value)}
                            onBlur={() => {
                              const cleanValue = partyInputValue.trim();
                              if (cleanValue) {
                                handleUploadFieldChange(item.id, 'parties', [...parties, cleanValue].join(', '));
                              }
                              setPartyInputUploadId('');
                              setPartyInputValue('');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                const cleanValue = partyInputValue.trim();
                                if (cleanValue) {
                                  handleUploadFieldChange(item.id, 'parties', [...parties, cleanValue].join(', '));
                                }
                                setPartyInputUploadId('');
                                setPartyInputValue('');
                              }
                              if (event.key === 'Escape') {
                                setPartyInputUploadId('');
                                setPartyInputValue('');
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            className="party-chip party-add"
                            onClick={() => {
                              setPartyInputUploadId(item.id);
                              setPartyInputValue('');
                            }}
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {isClassifying || isUnknown ? (
                      <span className="dash-muted">—</span>
                    ) : (
                      renderConfidenceDots(confidenceState)
                    )}
                  </td>
                  <td>{formatShortDisplayDate(item.addedOn ?? currentCaseMeta.started ?? toIsoDate(new Date()))}</td>
                </tr>
              ];

              if (showSummary) {
                rows.push(
                  <tr key={`upload-summary-${item.id}`} className="summary-row">
                    <td colSpan={6}>
                      <div className="summary-block">{item.summary}</div>
                    </td>
                  </tr>
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      )}

      <div className="warning-messages">
        {classificationCorrectionCount > 0 ? (
          <div className="warning-line amber">
            ⚠ {classificationCorrectionCount} document{classificationCorrectionCount === 1 ? '' : 's'} need
            classification correction
          </div>
        ) : null}
        <div className="warning-line muted">
          ○ {unverifiedUploadCount} document{unverifiedUploadCount === 1 ? '' : 's'} not yet confirmed
        </div>
      </div>

      <div className="bottom-actions">
        <button
          type="button"
          className="btn btn-secondary"
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
          Confirm all remaining ({confirmableUploadCount})
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!allUploadsVerified}
          onClick={handleGenerateFindings}
          title="All documents must be classified and confirmed before generating findings."
        >
          Generate findings
        </button>
      </div>
    </div>
  );
}
