function DocumentClassificationMenu({
  uploadItemId,
  activeClassificationMenu,
  setActiveClassificationMenu,
  documentClassificationGroups,
  documentClassificationOtherOption,
  handleUploadClassificationSelect
}) {
  if (activeClassificationMenu?.uploadId !== uploadItemId) return null;

  const activeGroup =
    documentClassificationGroups.find((group) => group.id === activeClassificationMenu.activeGroupId) ??
    documentClassificationGroups[0];

  return (
    <div className="classification-menu" role="dialog" aria-modal="false" aria-label="Choose classification">
      <div className="classification-menu__groups">
        {documentClassificationGroups.map((group) => (
          <button
            key={`${uploadItemId}-group-${group.id}`}
            type="button"
            className={`classification-menu__group${activeGroup.id === group.id ? ' active' : ''}`}
            onMouseEnter={() =>
              setActiveClassificationMenu((prev) =>
                prev?.uploadId === uploadItemId ? { ...prev, activeGroupId: group.id } : prev
              )
            }
            onFocus={() =>
              setActiveClassificationMenu((prev) =>
                prev?.uploadId === uploadItemId ? { ...prev, activeGroupId: group.id } : prev
              )
            }
            onClick={() =>
              setActiveClassificationMenu((prev) =>
                prev?.uploadId === uploadItemId
                  ? { ...prev, activeGroupId: group.id }
                  : { uploadId: uploadItemId, activeGroupId: group.id }
              )
            }
          >
            {group.label}
          </button>
        ))}
      </div>
      <div className="classification-menu__options">
        <div className="classification-menu__heading">{activeGroup.label}</div>
        {activeGroup.options.map((option) => (
          <button
            key={`${uploadItemId}-${activeGroup.id}-${option}`}
            type="button"
            className="classification-menu__option"
            onClick={() => handleUploadClassificationSelect(uploadItemId, activeGroup.label, option)}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          className="classification-menu__option classification-menu__option--limited"
          onClick={() =>
            handleUploadClassificationSelect(uploadItemId, activeGroup.label, documentClassificationOtherOption)
          }
        >
          Other (limited analysis)
        </button>
      </div>
    </div>
  );
}

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
  processingEntries
}) {
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
          <div className="docs-wireframe-upload-actions">
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
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={(event) => {
                event.stopPropagation();
                setUploadAreaCollapsed(true);
              }}
            >
              Collapse
            </button>
          </div>
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
              <th style={{ width: '90px' }}>Uploaded</th>
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
              const linkedDocumentId = resolveLinkedDocumentId(normalizedItem);
              const confidenceState = resolveConfidenceState(normalizedItem.confidence);
              const parties = textOf(normalizedItem.parties, '')
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean);
              const interviewees = normalizeUploadInterviewees(normalizedItem);
              const isInterviewTranscript = isInterviewTranscriptUpload(normalizedItem);
              const isLimitedAnalysis = isUploadLimitedAnalysis(normalizedItem);
              const isLowConfidence = confidenceState === 'attention';
              const rowClassName = [
                isLowConfidence ? 'row-amber' : '',
                isUnknown ? 'row-warning' : '',
                isClassifying ? 'row-classifying' : '',
                isLimitedAnalysis ? 'row-limited-analysis' : ''
              ]
                .filter(Boolean)
                .join(' ');

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
                        className="table-link-btn"
                        onClick={() => handleViewDocument(linkedDocumentId, null, null, stepDocuments)}
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
                          className={`classification-trigger ${isUnknown ? 'is-warning' : ''}`}
                          onClick={() =>
                            setActiveClassificationMenu((prev) =>
                              prev?.uploadId === item.id
                                ? null
                                : {
                                    uploadId: item.id,
                                    activeGroupId:
                                      documentClassificationGroups.find(
                                        (group) => group.label === normalizedItem.classificationL1
                                      )?.id ?? documentClassificationGroups[0].id
                                  }
                            )
                          }
                        >
                          {isUnknown ? <span className="warn-icon">⚠</span> : null}
                          <span>{classification}</span>
                          <span className="classification-trigger__chevron">▾</span>
                        </button>
                        <DocumentClassificationMenu
                          uploadItemId={item.id}
                          activeClassificationMenu={activeClassificationMenu}
                          setActiveClassificationMenu={setActiveClassificationMenu}
                          documentClassificationGroups={documentClassificationGroups}
                          documentClassificationOtherOption={documentClassificationOtherOption}
                          handleUploadClassificationSelect={handleUploadClassificationSelect}
                        />
                        {isLimitedAnalysis ? (
                          <div className="classification-hint">
                            Limited analysis. Classify more specifically for full processing.
                          </div>
                        ) : null}
                        {isLimitedAnalysis ? (
                          <input
                            type="text"
                            className="docs-inline-input classification-detail-input"
                            value={textOf(normalizedItem.classificationDetail, '')}
                            onChange={(event) =>
                              handleUploadClassificationDetailChange(item.id, event.target.value)
                            }
                            placeholder="Describe the specific document type..."
                          />
                        ) : null}
                      </div>
                    )}
                    {!isClassifying && isInterviewTranscript ? (
                      <div className="transcript-fields">
                        {interviewees.map((interviewee) => (
                          <div key={interviewee.id} className="transcript-field-row">
                            <input
                              type="text"
                              className="docs-inline-input"
                              value={interviewee.name}
                              onChange={(event) =>
                                handleUpdateUploadInterviewee(
                                  item.id,
                                  interviewee.id,
                                  'name',
                                  event.target.value
                                )
                              }
                              placeholder="Interviewee name..."
                            />
                            <input
                              type="text"
                              className="docs-inline-input"
                              value={interviewee.role}
                              onChange={(event) =>
                                handleUpdateUploadInterviewee(
                                  item.id,
                                  interviewee.id,
                                  'role',
                                  event.target.value
                                )
                              }
                              placeholder="Role..."
                            />
                            <input
                              type="date"
                              className="docs-inline-input"
                              value={toDateInputValue(interviewee.date)}
                              onChange={(event) =>
                                handleUpdateUploadInterviewee(
                                  item.id,
                                  interviewee.id,
                                  'date',
                                  event.target.value
                                )
                              }
                            />
                            <input
                              type="text"
                              className="docs-inline-input transcript-context-input"
                              value={interviewee.contextNote}
                              onChange={(event) =>
                                handleUpdateUploadInterviewee(
                                  item.id,
                                  interviewee.id,
                                  'contextNote',
                                  event.target.value
                                )
                              }
                              placeholder="Context note (optional)..."
                            />
                            <button
                              type="button"
                              className="btn btn-xs ghost transcript-remove-btn"
                              onClick={() => handleRemoveUploadInterviewee(item.id, interviewee.id)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-xs ghost transcript-add-btn"
                          onClick={() => handleAddUploadInterviewee(item.id)}
                        >
                          + Add interviewee
                        </button>
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {isClassifying ? (
                      <span className="dash-muted">—</span>
                    ) : (
                      <div className="party-chip-row">
                        {parties.length > 0
                          ? parties.map((party, partyIndex) => (
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
                            ))
                          : null}
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
                  <td>
                    {formatShortDisplayDate(item.addedOn ?? currentCaseMeta.started ?? toIsoDate(new Date()))}
                  </td>
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
        {unclassifiedUploadCount > 0 ? (
          <div className="warning-line amber">
            ⚠ {unclassifiedUploadCount} document{unclassifiedUploadCount === 1 ? '' : 's'} need classification
            correction
          </div>
        ) : null}
        {lowConfidenceUploadCount > 0 ? (
          <div className="warning-line amber">
            ⚠ {lowConfidenceUploadCount} low-confidence classification
            {lowConfidenceUploadCount === 1 ? '' : 's'} should be reviewed carefully
          </div>
        ) : null}
        {incompleteInterviewUploadCount > 0 ? (
          <div className="warning-line amber">
            ⚠ {incompleteInterviewUploadCount} interview transcript
            {incompleteInterviewUploadCount === 1 ? '' : 's'} need interviewee name and role
          </div>
        ) : null}
        {limitedAnalysisUploadCount > 0 ? (
          <div className="warning-line muted">
            ℹ {limitedAnalysisUploadCount} document{limitedAnalysisUploadCount === 1 ? '' : 's'} will receive limited
            analysis until classified more specifically
          </div>
        ) : null}
        <div className="warning-line muted">
          ✓ {verifiedUploadCount} of {uploadItems.length} document{uploadItems.length === 1 ? '' : 's'} confirmed
        </div>
        <div className="warning-line muted">
          ○ {unverifiedUploadCount} document{unverifiedUploadCount === 1 ? '' : 's'} not yet confirmed
        </div>
      </div>

      <div className="bottom-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={uploadItems.length === 0}
          onClick={handleConfirmAllUploads}
          title="Confirm all classified rows"
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

      <section className="docs-processing-log">
        <h4>Processing Log</h4>
        {processingEntries.map((entry) => {
          const isInitial = /initial/i.test(entry.detail);
          return (
            <div key={`phase1-log-${entry.id}`} className="log-entry">
              <div className={`log-dot ${isInitial ? 'dot-process' : 'dot-update'}`} />
              <div className="log-text">{entry.detail}</div>
              <div className="log-time">{entry.time}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
