import { useEffect, useMemo } from 'react';

const CASE_LEVEL_SOURCE_OPTIONS = ['Interview', 'Observation', 'External system', 'Prior inspection', 'Other'];

function deriveSeverityLabel(finding) {
  const normalized = String(finding?.severity ?? '').trim().toLowerCase();
  if (normalized === 'critical') return 'CRITICAL';
  if (normalized === 'warning' || normalized === 'lead') return 'GUIDANCE';
  if (normalized === 'best_practice') return 'GOOD PRACTICE';
  if (normalized === 'pass' || normalized === 'compliant') return 'COMPLIANT';
  return 'CRITICAL';
}

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
  const selectedDocuments = leadConfirmSelectedDocuments;
  const activeDocument = useMemo(
    () =>
      selectedDocuments.find((doc) => doc.id === leadConfirmModal.activeDocumentId) ??
      selectedDocuments[0] ??
      null,
    [leadConfirmModal.activeDocumentId, selectedDocuments]
  );
  const activeDocumentIndex = Math.max(
    0,
    selectedDocuments.findIndex((doc) => doc.id === activeDocument?.id)
  );

  useEffect(() => {
    if (!isOpen) return;
    const nextActiveDocumentId = activeDocument?.id ?? '';
    if (nextActiveDocumentId === leadConfirmModal.activeDocumentId) return;
    setLeadConfirmModal((prev) => ({
      ...prev,
      activeDocumentId: nextActiveDocumentId
    }));
  }, [activeDocument?.id, isOpen, leadConfirmModal.activeDocumentId, setLeadConfirmModal]);

  if (!isOpen) return null;

  const step = leadConfirmModal.step || 1;
  const severityLabel = deriveSeverityLabel(leadConfirmFinding);
  const activeAnchor = activeDocument
    ? leadConfirmModal.documentAnchors?.[activeDocument.id] ??
      createLeadConfirmDocumentAnchor(leadConfirmFinding, activeDocument.id)
    : null;
  const activeBoxes = Array.isArray(activeDocument?.overlay?.boxes) ? activeDocument.overlay.boxes : [];
  const defaultBoxId = coerceText(activeBoxes[0]?.id);
  const isCaseLevel = Boolean(leadConfirmModal.caseLevel);
  const isStepTwoReady = isCaseLevel
    ? leadConfirmModal.caseLevelSource && leadConfirmModal.caseLevelDescription?.trim()
    : selectedDocuments.length > 0;

  const goToStep = (nextStep) => {
    setLeadConfirmModal((prev) => ({ ...prev, step: nextStep }));
  };

  const handleToggleCaseLevel = (checked) => {
    setLeadConfirmModal((prev) => ({
      ...prev,
      caseLevel: checked,
      selectedDocumentIds: checked ? [] : prev.selectedDocumentIds,
      documentAnchors: checked ? {} : prev.documentAnchors,
      activeDocumentId: checked ? '' : prev.activeDocumentId
    }));
  };

  const handleNavigateDocument = (direction) => {
    if (selectedDocuments.length === 0) return;
    const nextIndex = (activeDocumentIndex + direction + selectedDocuments.length) % selectedDocuments.length;
    const nextDocument = selectedDocuments[nextIndex];
    if (!nextDocument) return;
    setLeadConfirmModal((prev) => ({
      ...prev,
      activeDocumentId: nextDocument.id
    }));
  };

  const handleEvidenceTextChange = (value) => {
    if (!activeDocument) return;
    updateLeadConfirmDocumentAnchor(activeDocument.id, (prev) => ({
      ...prev,
      useHighlight: value.trim().length === 0,
      boxId: value.trim().length === 0 ? coerceText(prev.boxId) || defaultBoxId : '',
      note: value
    }));
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card modal-card--wide" role="dialog" aria-modal="true" aria-label="Confirm finding">
        <div className="modal-card__header">
          <h3>Confirm finding</h3>
          <button type="button" className="modal-card__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {leadConfirmFinding ? (
          <>
            <div className="evidence-step-indicator">
              {[
                ['1', 'Polarity'],
                ['2', 'Documents'],
                ['3', 'Highlight']
              ].map(([id, label], index) => (
                <div key={`lead-confirm-step-${id}`} className="evidence-step-indicator__item">
                  <div className={`step-dot ${step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}`}>
                    {id}
                  </div>
                  <div className="step-label">{label}</div>
                </div>
              ))}
            </div>

            {step === 1 ? (
              <div className="evidence-step active">
                <div className="evidence-step-section">
                  <div className="form-label">Requirement</div>
                  <div className="evidence-step-value">
                    {safeText(leadConfirmFinding.title, 'Possible finding')}
                  </div>
                </div>
                <div className="evidence-step-section">
                  <div className="form-label">Severity</div>
                  <div className="evidence-step-severity">{severityLabel}</div>
                </div>
                <div className="evidence-step-section">
                  <div className="form-label">Polarity</div>
                  <label className="polarity-option">
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
                  <label className="polarity-option">
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
                  <div className="good-practice-toggle visible">
                    <input
                      id="lead-confirm-good-practice"
                      type="checkbox"
                      checked={leadConfirmModal.goodPractice}
                      onChange={(event) =>
                        setLeadConfirmModal((prev) => ({
                          ...prev,
                          goodPractice: event.target.checked
                        }))
                      }
                    />
                    <label htmlFor="lead-confirm-good-practice">Mark as good practice</label>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="evidence-step active">
                <div className="form-label" style={{ marginBottom: 'var(--sp-3)' }}>
                  Select documents containing evidence
                </div>
                {caseDocuments.map((doc) => (
                  <div key={`lead-confirm-check-${doc.id}`} className="doc-checklist-item">
                    <input
                      id={`lead-confirm-doc-${doc.id}`}
                      type="checkbox"
                      checked={(leadConfirmModal.selectedDocumentIds || []).includes(doc.id)}
                      onChange={(event) => toggleLeadConfirmDocument(doc.id, event.target.checked)}
                    />
                    <label htmlFor={`lead-confirm-doc-${doc.id}`}>
                      {`📄 ${doc.filename ?? doc.label ?? 'Case document'}`}
                    </label>
                  </div>
                ))}
                <div className="case-level-option">
                  <label className="case-level-toggle">
                    <input
                      type="checkbox"
                      checked={isCaseLevel}
                      onChange={(event) => handleToggleCaseLevel(event.target.checked)}
                    />
                    No document evidence (case-level finding)
                  </label>
                  <div className={`case-level-fields ${isCaseLevel ? 'visible' : ''}`}>
                    <div className="form-group" style={{ marginBottom: 'var(--sp-3)' }}>
                      <label className="form-label" htmlFor="lead-confirm-case-level-source">
                        Source type
                      </label>
                      <select
                        id="lead-confirm-case-level-source"
                        className="form-control"
                        value={leadConfirmModal.caseLevelSource || ''}
                        onChange={(event) =>
                          setLeadConfirmModal((prev) => ({
                            ...prev,
                            caseLevelSource: event.target.value
                          }))
                        }
                      >
                        <option value="">Select source...</option>
                        {CASE_LEVEL_SOURCE_OPTIONS.map((option) => (
                          <option key={`lead-confirm-source-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="lead-confirm-case-level-description">
                        Description
                      </label>
                      <textarea
                        id="lead-confirm-case-level-description"
                        className="form-control"
                        rows="2"
                        placeholder="Describe the evidence source..."
                        value={leadConfirmModal.caseLevelDescription || ''}
                        onChange={(event) =>
                          setLeadConfirmModal((prev) => ({
                            ...prev,
                            caseLevelDescription: event.target.value
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="evidence-step active">
                <div className="doc-navigator">
                  <div className="doc-navigator-label">
                    Document: {activeDocument ? activeDocument.filename ?? activeDocument.label ?? 'Case document' : 'None selected'}
                  </div>
                  <div className="doc-navigator-counter">
                    {selectedDocuments.length === 0 ? '0 selected' : `${activeDocumentIndex + 1} of ${selectedDocuments.length} selected`}
                  </div>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm btn-secondary"
                    onClick={() => handleNavigateDocument(-1)}
                    title="Previous document"
                    disabled={selectedDocuments.length <= 1}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm btn-secondary"
                    onClick={() => handleNavigateDocument(1)}
                    title="Next document"
                    disabled={selectedDocuments.length <= 1}
                  >
                    ▶
                  </button>
                </div>
                <div className="pdf-viewer-placeholder">
                  PDF viewer area - select text to highlight as evidence
                </div>
                <div style={{ marginBottom: 'var(--sp-3)' }}>
                  <label className="form-label" htmlFor="lead-confirm-manual-evidence">
                    Or enter text evidence manually
                  </label>
                  <textarea
                    id="lead-confirm-manual-evidence"
                    className="form-control text-evidence-input"
                    rows="2"
                    placeholder="Paste or type the relevant passage..."
                    value={activeAnchor?.note ?? ''}
                    onChange={(event) => handleEvidenceTextChange(event.target.value)}
                    disabled={!activeDocument}
                  />
                </div>
                <div className="evidence-tracking-list">
                  <div className="form-label" style={{ marginBottom: 'var(--sp-2)' }}>
                    Evidence tracking
                  </div>
                  {selectedDocuments.map((doc) => {
                    const isComplete = isLeadConfirmDocumentAnchorComplete(doc.id);
                    return (
                      <div key={`lead-confirm-tracking-${doc.id}`} className="evidence-tracking-item">
                        <span className={`evidence-status-icon ${isComplete ? 'done' : 'pending'}`}>
                          {isComplete ? '✓' : '○'}
                        </span>
                        <span>{doc.filename ?? doc.label ?? 'Case document'}</span>
                        <span className="evidence-tracking-status">
                          {isComplete ? 'Evidence added' : 'Evidence needed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="panel-subtitle">This review item could not be loaded.</p>
        )}
        <div className="modal-actions">
          {step > 1 ? (
            <button type="button" className="btn secondary" onClick={() => goToStep(step - 1)}>
              ← Back
            </button>
          ) : null}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          {step === 1 ? (
            <button type="button" className="btn primary" onClick={() => goToStep(2)}>
              Next: select documents →
            </button>
          ) : step === 2 ? (
            isCaseLevel ? (
              <button type="button" className="btn primary" disabled={!isStepTwoReady} onClick={onSubmit}>
                Confirm finding
              </button>
            ) : (
              <button type="button" className="btn primary" disabled={!isStepTwoReady} onClick={() => goToStep(3)}>
                Next: highlight evidence →
              </button>
            )
          ) : (
            <button type="button" className="btn primary" disabled={!leadConfirmFinding || !isEvidenceReady} onClick={onSubmit}>
              Confirm finding
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
