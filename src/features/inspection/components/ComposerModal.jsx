export default function ComposerModal({
  isOpen,
  composerModal,
  setComposerModal,
  observationSourceOptions,
  findingRequirementOptions,
  manualCaseLevelSourceOptions,
  onClose,
  onSubmit,
  onOpenEvidenceFlow
}) {
  if (!isOpen) return null;

  const isObservation = composerModal.type === 'observation';
  const isManual = composerModal.type === 'manual';
  const isManualHighlightEvidence = isManual && composerModal.evidenceType === 'document';
  const isManualDescribeEvidence = isManual && composerModal.evidenceType === 'case_level';

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card modal-card--wide" role="dialog" aria-modal="true" aria-label="Add finding">
        <div className="modal-card__header">
          <h3>{isManual ? 'Add Manual Finding' : 'Add General Observation'}</h3>
          <button type="button" className="modal-card__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {composerModal.step === 1 ? (
          <>
            <label className="modal-label" htmlFor="composer-text">
              {isManual ? 'Describe the finding' : 'What did you observe?'}
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
            {isObservation ? (
              <>
                <label className="modal-label" htmlFor="composer-source">
                  Source
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
        ) : (
          <>
            <label className="modal-label">{isManual ? 'Your finding' : 'Your observation'}</label>
            <div className="composer-preview">
              {composerModal.text.trim() ||
                (isManual ? 'No finding text entered yet.' : 'No observation text entered yet.')}
            </div>
            <label className="modal-label">Link to requirements</label>
            <div className="composer-requirements">
              <p className="composer-requirements__hint">
                {isManual
                  ? 'Suggested requirements:'
                  : 'Suggested requirements based on your observation:'}
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
            {isObservation ? (
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
                <label className="modal-label">Do you have document evidence to highlight?</label>
                <div className="composer-polarity-options">
                  <label className="composer-polarity-option">
                    <input
                      type="radio"
                      name="composer-evidence-type"
                      checked={isManualHighlightEvidence}
                      onChange={() =>
                        setComposerModal((prev) => ({
                          ...prev,
                          evidenceType: 'document'
                        }))
                      }
                    />
                    <span>Yes - I&apos;ll highlight the evidence</span>
                  </label>
                  <label className="composer-polarity-option">
                    <input
                      type="radio"
                      name="composer-evidence-type"
                      checked={isManualDescribeEvidence}
                      onChange={() =>
                        setComposerModal((prev) => ({
                          ...prev,
                          evidenceType: 'case_level',
                          sourceType: prev.sourceType || '',
                          selectedDocumentIds: [],
                          documentAnchors: {}
                        }))
                      }
                    />
                    <span>No - I&apos;ll describe the source</span>
                  </label>
                </div>
                {isManualDescribeEvidence ? (
                  <>
                    <label className="modal-label" htmlFor="composer-manual-source">
                      Source type
                    </label>
                    <select
                      id="composer-manual-source"
                      className="modal-select"
                      value={composerModal.sourceType}
                      onChange={(event) =>
                        setComposerModal((prev) => ({ ...prev, sourceType: event.target.value }))
                      }
                    >
                      <option value="">Select source type...</option>
                      {manualCaseLevelSourceOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                        ))}
                      </select>
                    </>
                ) : null}
                {composerModal.evidenceType === 'case_level' ? (
                  <>
                    <label className="modal-label" htmlFor="composer-evidence-note">
                      Evidence description
                    </label>
                    <textarea
                      id="composer-evidence-note"
                      className="modal-textarea"
                      value={composerModal.evidenceNote}
                      onChange={(event) =>
                        setComposerModal((prev) => ({ ...prev, evidenceNote: event.target.value }))
                      }
                      placeholder="Describe the evidence..."
                    />
                  </>
                ) : null}
              </>
            )}
          </>
        )}
        <div className="modal-actions">
          {composerModal.step === 1 ? (
            <>
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!composerModal.text.trim()}
                onClick={() => setComposerModal((prev) => ({ ...prev, step: 2 }))}
              >
                {isManual ? 'Next: review →' : 'Next: link requirements →'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  setComposerModal((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) }))
                }
              >
                ← Back
              </button>
              {isManual && composerModal.step === 2 && isManualHighlightEvidence ? (
                <button
                  type="button"
                  className="btn primary"
                  onClick={onOpenEvidenceFlow}
                >
                  Next: evidence →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn primary"
                  disabled={
                    isManual && isManualDescribeEvidence
                      ? !composerModal.sourceType.trim() || !composerModal.evidenceNote.trim()
                      : isManual && !composerModal.evidenceType
                        ? true
                        : false
                  }
                  onClick={onSubmit}
                >
                  {isManual ? 'Add finding' : 'Add observation'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
