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
  void activeClassificationMenu;
  void setActiveClassificationMenu;
  void documentClassificationOtherOption;
  void handleUploadClassificationDetailChange;
  void stepDocuments;
  void verifiedUploadCount;
  void incompleteInterviewUploadCount;
  void processingEntries;

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
              <th style={{ width: '80px' }}>Uploaded</th>
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
                        {isLowConfidence && !isUnknown ? (
                          <span className="classification-warning">
                            <span className="warn-icon">⚠</span>
                            <select
                              className="classification-select is-warning"
                              value={classification}
                              onChange={(event) => {
                                const selectedValue = event.target.value;
                                const selectedEntry = classificationEntries.find(
                                  (entry) => entry.optionLabel === selectedValue
                                );
                                if (!selectedEntry) return;
                                handleUploadClassificationSelect(
                                  item.id,
                                  selectedEntry.groupLabel,
                                  selectedEntry.optionLabel
                                );
                              }}
                            >
                              {classificationEntries.map((entry) => (
                                <option key={`${item.id}-${entry.optionLabel}`} value={entry.optionLabel}>
                                  {entry.optionLabel}
                                </option>
                              ))}
                            </select>
                          </span>
                        ) : (
                          <select
                            className={`classification-select${isUnknown ? ' is-warning' : ''}`}
                            value={isUnknown ? '' : classification}
                            onChange={(event) => {
                              const selectedValue = event.target.value;
                              if (!selectedValue) return;
                              const selectedEntry = classificationEntries.find(
                                (entry) => entry.optionLabel === selectedValue
                              );
                              if (!selectedEntry) return;
                              handleUploadClassificationSelect(
                                item.id,
                                selectedEntry.groupLabel,
                                selectedEntry.optionLabel
                              );
                            }}
                          >
                            {isUnknown ? (
                              <option value="" disabled>
                                -- Select classification --
                              </option>
                            ) : null}
                            {classificationEntries.map((entry) => (
                              <option key={`${item.id}-${entry.optionLabel}`} value={entry.optionLabel}>
                                {entry.optionLabel}
                              </option>
                            ))}
                          </select>
                        )}

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
                          <div className="classification-hint">
                            Limited analysis. Classify more specifically for full processing.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td>
                    {isClassifying || parties.length === 0 ? (
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
                        <button
                          type="button"
                          className="party-chip party-add"
                          onClick={() => {
                            const base = parties.join(', ');
                            const next = base ? `${base}, Additional party` : 'Additional party';
                            handleUploadFieldChange(item.id, 'parties', next);
                          }}
                        >
                          + Add
                        </button>
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
          onClick={handleConfirmAllUploads}
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
