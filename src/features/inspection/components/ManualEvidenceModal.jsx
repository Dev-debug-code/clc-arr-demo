export default function ManualEvidenceModal({
  isOpen,
  composerModal,
  caseDocuments,
  toggleComposerDocument,
  composerSelectedDocuments,
  createComposerDocumentAnchor,
  isComposerDocumentAnchorComplete,
  updateComposerDocumentAnchor,
  coerceText,
  isEvidenceStepValid,
  onBack,
  onClose,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card modal-card--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Manual finding evidence"
      >
        <div className="modal-card__header">
          <h3>Add Manual Finding</h3>
          <button type="button" className="modal-card__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
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
                        ? `${availableBoxes.length} highlighted passage${
                            availableBoxes.length === 1 ? '' : 's'
                          } available`
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
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onBack}>
            ← Back
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={!isEvidenceStepValid} onClick={onSubmit}>
            Add finding
          </button>
        </div>
      </div>
    </div>
  );
}
