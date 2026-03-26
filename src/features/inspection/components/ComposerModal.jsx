export default function ComposerModal({
  isOpen,
  composerModal,
  setComposerModal,
  observationSourceOptions,
  findingRequirementOptions,
  reportSeverityLabelMap,
  getRequirementSeverity,
  manualCaseLevelSourceOptions,
  caseDocuments,
  toggleComposerDocument,
  composerSelectedDocuments,
  createComposerDocumentAnchor,
  isComposerDocumentAnchorComplete,
  updateComposerDocumentAnchor,
  coerceText,
  onClose,
  isEvidenceStepValid,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card modal-card--wide" role="dialog" aria-modal="true" aria-label="Add finding">
        <h3>{composerModal.type === 'manual' ? 'Add Manual Finding' : 'Add General Observation'}</h3>
        {composerModal.step === 1 ? (
          <>
            <label className="modal-label" htmlFor="composer-text">
              {composerModal.type === 'manual' ? 'Describe the finding' : 'What did you observe?'}
            </label>
            <div className="composer-textarea-wrap">
              <textarea
                id="composer-text"
                className="modal-textarea"
                value={composerModal.text}
                onChange={(event) =>
                  setComposerModal((prev) => ({ ...prev, text: event.target.value }))
                }
                placeholder={
                  composerModal.type === 'manual'
                    ? 'Describe the finding...'
                    : 'What did you observe?'
                }
              />
              <button type="button" className="composer-voice-btn" title="Dictate (UI only)" aria-label="Dictate">
                🎤
              </button>
            </div>
            {composerModal.type === 'observation' ? (
              <>
                <label className="modal-label" htmlFor="composer-source">
                  Source type
                </label>
                <select
                  id="composer-source"
                  className="modal-select"
                  value={composerModal.sourceType}
                  onChange={(event) =>
                    setComposerModal((prev) => ({ ...prev, sourceType: event.target.value }))
                  }
                >
                  {observationSourceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </>
        ) : composerModal.step === 2 ? (
          <>
            <label className="modal-label">Observation preview</label>
            <div className="composer-preview">
              {composerModal.text.trim() || 'No observation text entered yet.'}
            </div>
            <label className="modal-label" htmlFor="composer-requirement">
              Requirement linkage
            </label>
            <div className="composer-requirements">
              <p className="composer-requirements__hint">
                Suggested requirements based on your {composerModal.type === 'manual' ? 'finding' : 'observation'}:
              </p>
              {findingRequirementOptions.map((option) => {
                const selected = (composerModal.selectedRequirements || []).includes(option);
                return (
                  <label key={option} className="composer-requirements__item">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        setComposerModal((prev) => {
                          const current = new Set(prev.selectedRequirements || []);
                          if (event.target.checked) {
                            current.add(option);
                          } else {
                            current.delete(option);
                          }
                          const next = Array.from(current);
                          return {
                            ...prev,
                            selectedRequirements:
                              next.length > 0 ? next : [findingRequirementOptions[0]],
                            requirement: next[0] || findingRequirementOptions[0]
                          };
                        })
                      }
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
              <button
                type="button"
                className="link-button composer-requirements__add-link"
                onClick={(event) => event.preventDefault()}
              >
                + Add requirement
              </button>
            </div>
            <div className="composer-severity-context">
              {(() => {
                const selected = composerModal.selectedRequirements?.length
                  ? composerModal.selectedRequirements
                  : [composerModal.requirement];
                const severityLabels = Array.from(
                  new Set(
                    selected.map(
                      (requirement) => reportSeverityLabelMap[getRequirementSeverity(requirement)] ?? 'Guidance'
                    )
                  )
                );

                return severityLabels.length === 1
                  ? `Inherited severity: ${severityLabels[0]} requirement`
                  : `Inherited severities: ${severityLabels.join(', ')}`;
              })()}
            </div>
            {composerModal.type === 'observation' ? (
              <>
                <label className="modal-label">Polarity</label>
                <div className="composer-polarity-options">
                  <label className="composer-polarity-option">
                    <input
                      type="radio"
                      name="composer-polarity"
                      checked={composerModal.polarity === 'non_compliant'}
                      onChange={() =>
                        setComposerModal((prev) => ({
                          ...prev,
                          polarity: 'non_compliant',
                          goodPractice: false
                        }))
                      }
                    />
                    <span>Non-compliant - requirement not met</span>
                  </label>
                  <label className="composer-polarity-option">
                    <input
                      type="radio"
                      name="composer-polarity"
                      checked={composerModal.polarity === 'compliant'}
                      onChange={() =>
                        setComposerModal((prev) => ({
                          ...prev,
                          polarity: 'compliant'
                        }))
                      }
                    />
                    <span>Compliant - requirement met</span>
                  </label>
                </div>
                {composerModal.polarity === 'compliant' ? (
                  <label className="toggle composer-good-practice-toggle">
                    <input
                      type="checkbox"
                      checked={composerModal.goodPractice}
                      onChange={(event) =>
                        setComposerModal((prev) => ({ ...prev, goodPractice: event.target.checked }))
                      }
                    />
                    <span>Mark as good practice</span>
                  </label>
                ) : null}
              </>
            ) : (
              <>
                <label className="modal-label" htmlFor="composer-polarity">
                  Polarity
                </label>
                <select
                  id="composer-polarity"
                  className="modal-select"
                  value={composerModal.polarity}
                  onChange={(event) =>
                    setComposerModal((prev) => ({
                      ...prev,
                      polarity: event.target.value,
                      goodPractice:
                        event.target.value === 'compliant' ? prev.goodPractice : false
                    }))
                  }
                >
                  <option value="non_compliant">Non-compliant</option>
                  <option value="compliant">Compliant</option>
                </select>
                {composerModal.polarity === 'compliant' ? (
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={composerModal.goodPractice}
                      onChange={(event) =>
                        setComposerModal((prev) => ({ ...prev, goodPractice: event.target.checked }))
                      }
                    />
                    <span>Mark as good practice</span>
                  </label>
                ) : null}
              </>
            )}
            {composerModal.type === 'manual' ? (
              <>
                <label className="modal-label" htmlFor="composer-evidence">
                  Evidence type
                </label>
                <select
                  id="composer-evidence"
                  className="modal-select"
                  value={composerModal.evidenceType}
                  onChange={(event) =>
                    setComposerModal((prev) => ({
                      ...prev,
                      evidenceType: event.target.value,
                      sourceType:
                        event.target.value === 'case_level'
                          ? prev.sourceType || manualCaseLevelSourceOptions[0]
                          : prev.sourceType
                    }))
                  }
                >
                  <option value="document">Document-based</option>
                  <option value="case_level">Case-level</option>
                </select>
                {composerModal.evidenceType === 'case_level' ? (
                  <>
                    <label className="modal-label" htmlFor="composer-manual-source">
                      Case-level source
                    </label>
                    <select
                      id="composer-manual-source"
                      className="modal-select"
                      value={composerModal.sourceType}
                      onChange={(event) =>
                        setComposerModal((prev) => ({ ...prev, sourceType: event.target.value }))
                      }
                    >
                      {manualCaseLevelSourceOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <p className="composer-evidence-helper">
                    Continue to select one or more documents, then add a highlight anchor or a text
                    evidence location for each selected document.
                  </p>
                )}
                {composerModal.evidenceType === 'case_level' ? (
                  <>
                    <label className="modal-label" htmlFor="composer-evidence-note">
                      Evidence note
                    </label>
                    <textarea
                      id="composer-evidence-note"
                      className="modal-textarea"
                      value={composerModal.evidenceNote}
                      onChange={(event) =>
                        setComposerModal((prev) => ({ ...prev, evidenceNote: event.target.value }))
                      }
                      placeholder="Describe case-level evidence context (interview, on-site note, missing document, etc.)..."
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            <label className="modal-label">Finding preview</label>
            <div className="composer-preview">
              {composerModal.text.trim() || 'No finding text entered yet.'}
            </div>
            <label className="modal-label">Select document(s)</label>
            <p className="composer-evidence-helper">
              Choose every document that supports this finding. Each selected document needs either a
              highlighted passage or a text evidence location.
            </p>
            {caseDocuments.length === 0 ? (
              <div className="alert alert-warning small">
                No documents are available yet. Upload and verify documents before creating a
                document-based finding.
              </div>
            ) : (
              <div className="composer-document-list">
                {caseDocuments.map((doc) => {
                  const isSelected = (composerModal.selectedDocumentIds || []).includes(doc.id);
                  const availableBoxes = Array.isArray(doc?.overlay?.boxes) ? doc.overlay.boxes : [];
                  return (
                    <label
                      key={`composer-doc-${doc.id}`}
                      className={`composer-document-row ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => toggleComposerDocument(doc.id, event.target.checked)}
                      />
                      <span>
                        <strong>{doc.filename ?? doc.label ?? 'Case document'}</strong>
                        <span className="composer-document-meta">
                          {availableBoxes.length > 0
                            ? `${availableBoxes.length} highlighted passage${availableBoxes.length === 1 ? '' : 's'} available`
                            : 'No highlighted passages available'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {composerSelectedDocuments.length > 0 ? (
              <div className="composer-anchor-list">
                {composerSelectedDocuments.map((doc) => {
                  const anchor =
                    composerModal.documentAnchors?.[doc.id] ?? createComposerDocumentAnchor(doc.id);
                  const availableBoxes = Array.isArray(doc?.overlay?.boxes) ? doc.overlay.boxes : [];
                  const anchorComplete = isComposerDocumentAnchorComplete(doc.id);
                  return (
                    <div
                      key={`composer-anchor-${doc.id}`}
                      className={`composer-anchor-card ${anchorComplete ? 'is-complete' : ''}`}
                    >
                      <div className="composer-anchor-card__head">
                        <div>
                          <strong>{doc.filename ?? doc.label ?? 'Case document'}</strong>
                          <p className="composer-anchor-card__meta">
                            {availableBoxes.length > 0
                              ? 'Use a highlighted passage or switch to a text location.'
                              : 'No precomputed highlights are available for this document.'}
                          </p>
                        </div>
                        <span className={`composer-anchor-status ${anchorComplete ? 'ready' : 'pending'}`}>
                          {anchorComplete ? 'Anchored' : 'Anchor required'}
                        </span>
                      </div>
                      {availableBoxes.length > 0 ? (
                        <div className="composer-anchor-options">
                          <label className="composer-polarity-option">
                            <input
                              type="radio"
                              name={`composer-anchor-mode-${doc.id}`}
                              checked={anchor.useHighlight}
                              onChange={() =>
                                updateComposerDocumentAnchor(doc.id, (prev) => ({
                                  ...prev,
                                  useHighlight: true,
                                  boxId: coerceText(prev.boxId) || coerceText(availableBoxes[0]?.id)
                                }))
                              }
                            />
                            <span>Use highlighted passage</span>
                          </label>
                          <label className="composer-polarity-option">
                            <input
                              type="radio"
                              name={`composer-anchor-mode-${doc.id}`}
                              checked={!anchor.useHighlight}
                              onChange={() =>
                                updateComposerDocumentAnchor(doc.id, (prev) => ({
                                  ...prev,
                                  useHighlight: false,
                                  boxId: ''
                                }))
                              }
                            />
                            <span>Describe evidence location</span>
                          </label>
                        </div>
                      ) : null}
                      {availableBoxes.length > 0 && anchor.useHighlight ? (
                        <>
                          <label className="modal-label" htmlFor={`composer-anchor-box-${doc.id}`}>
                            Highlighted passage
                          </label>
                          <select
                            id={`composer-anchor-box-${doc.id}`}
                            className="modal-select"
                            value={anchor.boxId}
                            onChange={(event) =>
                              updateComposerDocumentAnchor(doc.id, { boxId: event.target.value })
                            }
                          >
                            <option value="">Select a passage</option>
                            {availableBoxes.map((box) => (
                              <option key={`composer-box-${doc.id}-${box.id}`} value={box.id}>
                                {`Page ${Number.isFinite(box?.page) ? box.page : '?'} - ${
                                  coerceText(box?.title) || coerceText(box?.details) || `Passage ${box.id}`
                                }`}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : null}
                      <label className="modal-label" htmlFor={`composer-anchor-note-${doc.id}`}>
                        {availableBoxes.length > 0 && anchor.useHighlight
                          ? 'Optional inspector note'
                          : 'Evidence location'}
                      </label>
                      <textarea
                        id={`composer-anchor-note-${doc.id}`}
                        className="modal-textarea"
                        value={anchor.note}
                        onChange={(event) =>
                          updateComposerDocumentAnchor(doc.id, { note: event.target.value })
                        }
                        placeholder={
                          availableBoxes.length > 0 && anchor.useHighlight
                            ? 'Optional context for why this passage supports the finding...'
                            : 'e.g. Page 7, paragraph 3 - client risk assessment section'
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          {composerModal.step === 1 ? (
            <button
              type="button"
              className="btn primary"
              disabled={!composerModal.text.trim()}
              onClick={() => setComposerModal((prev) => ({ ...prev, step: 2 }))}
            >
              Next: link requirements →
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  setComposerModal((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) }))
                }
              >
                ← Back
              </button>
              {composerModal.type === 'manual' &&
              composerModal.step === 2 &&
              composerModal.evidenceType === 'document' ? (
                <button
                  type="button"
                  className="btn primary"
                  disabled={caseDocuments.length === 0}
                  onClick={() => setComposerModal((prev) => ({ ...prev, step: 3 }))}
                >
                  Next: evidence →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn primary"
                  disabled={
                    composerModal.type === 'manual' && composerModal.step === 3
                      ? !isEvidenceStepValid
                      : composerModal.type === 'manual' && composerModal.evidenceType === 'case_level'
                        ? !composerModal.evidenceNote.trim()
                        : false
                  }
                  onClick={onSubmit}
                >
                  {composerModal.type === 'manual'
                    ? composerModal.step === 3
                      ? 'Add finding'
                      : 'Add finding'
                    : 'Add observation'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
