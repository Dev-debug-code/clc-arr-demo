export default function LeadConfirmModal({
  isOpen,
  leadConfirmFinding,
  safeText,
  leadConfirmModal,
  setLeadConfirmModal,
  caseDocuments,
  toggleLeadConfirmDocument,
  leadConfirmSelectedDocuments,
  createLeadConfirmDocumentAnchor,
  isLeadConfirmDocumentAnchorComplete,
  updateLeadConfirmDocumentAnchor,
  coerceText,
  onClose,
  isEvidenceReady,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card modal-card--wide" role="dialog" aria-modal="true" aria-label="Confirm lead">
        <h3>Confirm Lead as Finding</h3>
        <p className="panel-subtitle">
          Confirm polarity and anchor evidence before promoting this lead.
        </p>
        {leadConfirmFinding ? (
          <>
            <div className="lead-confirm-modal__selected">
              <strong>{safeText(leadConfirmFinding.title, 'Finding')}</strong>
              <p>{safeText(leadConfirmFinding.detail, 'Potential issue identified in current evidence.')}</p>
            </div>

            <label className="modal-label">Polarity</label>
            <div className="composer-polarity-options">
              <label className="composer-polarity-option">
                <input
                  type="radio"
                  name="lead-confirm-polarity"
                  checked={leadConfirmModal.polarity === 'non_compliant'}
                  onChange={() =>
                    setLeadConfirmModal((prev) => ({
                      ...prev,
                      polarity: 'non_compliant',
                      goodPractice: false
                    }))
                  }
                />
                Non-compliant
              </label>
              <label className="composer-polarity-option">
                <input
                  type="radio"
                  name="lead-confirm-polarity"
                  checked={leadConfirmModal.polarity === 'compliant'}
                  onChange={() =>
                    setLeadConfirmModal((prev) => ({
                      ...prev,
                      polarity: 'compliant'
                    }))
                  }
                />
                Compliant
              </label>
            </div>

            {leadConfirmModal.polarity === 'compliant' ? (
              <label className="lead-confirm-modal__toggle">
                <input
                  type="checkbox"
                  checked={leadConfirmModal.goodPractice}
                  onChange={(event) =>
                    setLeadConfirmModal((prev) => ({
                      ...prev,
                      goodPractice: event.target.checked
                    }))
                  }
                />
                <span>
                  Mark as good practice
                  <span className="lead-confirm-modal__hint">
                    Use this only where the evidence shows a stronger-than-required approach.
                  </span>
                </span>
              </label>
            ) : null}

            <label className="modal-label">Select document(s)</label>
            <p className="composer-evidence-helper">
              Select every document that supports this lead. Each selected document needs either a
              highlighted passage or a text evidence location before the lead can be promoted.
            </p>
            {caseDocuments.length === 0 ? (
              <div className="alert alert-warning small">
                No documents are available yet. Upload and verify documents before confirming this lead.
              </div>
            ) : (
              <div className="composer-document-list">
                {caseDocuments.map((doc) => {
                  const isSelected = (leadConfirmModal.selectedDocumentIds || []).includes(doc.id);
                  const availableBoxes = Array.isArray(doc?.overlay?.boxes) ? doc.overlay.boxes : [];
                  return (
                    <label
                      key={`lead-confirm-doc-${doc.id}`}
                      className={`composer-document-row ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => toggleLeadConfirmDocument(doc.id, event.target.checked)}
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

            {leadConfirmSelectedDocuments.length > 0 ? (
              <div className="composer-anchor-list">
                {leadConfirmSelectedDocuments.map((doc) => {
                  const anchor =
                    leadConfirmModal.documentAnchors?.[doc.id] ??
                    createLeadConfirmDocumentAnchor(leadConfirmFinding, doc.id);
                  const availableBoxes = Array.isArray(doc?.overlay?.boxes) ? doc.overlay.boxes : [];
                  const anchorComplete = isLeadConfirmDocumentAnchorComplete(doc.id);
                  return (
                    <div
                      key={`lead-confirm-anchor-${doc.id}`}
                      className={`composer-anchor-card ${anchorComplete ? 'is-complete' : ''}`}
                    >
                      <div className="composer-anchor-card__head">
                        <div>
                          <strong>{doc.filename ?? doc.label ?? 'Case document'}</strong>
                          <p className="composer-anchor-card__meta">
                            {availableBoxes.length > 0
                              ? 'Use a highlighted passage or switch to a text evidence location.'
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
                              name={`lead-confirm-anchor-mode-${doc.id}`}
                              checked={anchor.useHighlight}
                              onChange={() =>
                                updateLeadConfirmDocumentAnchor(doc.id, (prev) => ({
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
                              name={`lead-confirm-anchor-mode-${doc.id}`}
                              checked={!anchor.useHighlight}
                              onChange={() =>
                                updateLeadConfirmDocumentAnchor(doc.id, (prev) => ({
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
                          <label className="modal-label" htmlFor={`lead-confirm-anchor-box-${doc.id}`}>
                            Highlighted passage
                          </label>
                          <select
                            id={`lead-confirm-anchor-box-${doc.id}`}
                            className="modal-select"
                            value={anchor.boxId}
                            onChange={(event) =>
                              updateLeadConfirmDocumentAnchor(doc.id, { boxId: event.target.value })
                            }
                          >
                            <option value="">Select a passage</option>
                            {availableBoxes.map((box) => (
                              <option key={`lead-confirm-box-${doc.id}-${box.id}`} value={box.id}>
                                {`Page ${Number.isFinite(box?.page) ? box.page : '?'} - ${
                                  coerceText(box?.title) || coerceText(box?.details) || `Passage ${box.id}`
                                }`}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : null}
                      <label className="modal-label" htmlFor={`lead-confirm-anchor-note-${doc.id}`}>
                        {availableBoxes.length > 0 && anchor.useHighlight
                          ? 'Optional inspector note'
                          : 'Evidence location'}
                      </label>
                      <textarea
                        id={`lead-confirm-anchor-note-${doc.id}`}
                        className="modal-textarea"
                        value={anchor.note}
                        onChange={(event) =>
                          updateLeadConfirmDocumentAnchor(doc.id, { note: event.target.value })
                        }
                        placeholder={
                          availableBoxes.length > 0 && anchor.useHighlight
                            ? 'Optional context for why this passage supports the finding...'
                            : 'e.g. Page 7, paragraph 3 - customer due diligence section'
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : (
          <p className="panel-subtitle">This lead could not be loaded.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!leadConfirmFinding || !isEvidenceReady}
            onClick={onSubmit}
          >
            Confirm finding
          </button>
        </div>
      </div>
    </div>
  );
}
