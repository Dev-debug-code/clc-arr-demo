export default function ReportRegenerateModal({ isOpen, onCancel, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Regenerate report">
        <div className="modal-card__header">
          <h3>Regenerate Report?</h3>
          <button type="button" className="modal-card__close" aria-label="Close" onClick={onCancel}>
            ×
          </button>
        </div>
        <p>Regenerating will replace the current report. Any manual edits will be lost. Continue?</p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={onConfirm}>
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}
