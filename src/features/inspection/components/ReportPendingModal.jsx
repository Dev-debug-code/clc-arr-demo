export default function ReportPendingModal({
  isOpen,
  reportPendingAction,
  onCancel,
  onGenerateCurrent,
  onReprocessFirst
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Unprocessed changes">
        <div className="modal-card__header">
          <h3>Unprocessed Changes</h3>
          <button type="button" className="modal-card__close" aria-label="Close" onClick={onCancel}>
            ×
          </button>
        </div>
        <p>
          There are unprocessed changes. Would you like to reprocess findings first, or{' '}
          {reportPendingAction === 'generate' ? 'generate' : 'regenerate'} the report from current
          findings?
        </p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn secondary" onClick={onGenerateCurrent}>
            Generate from current findings
          </button>
          <button type="button" className="btn primary" onClick={onReprocessFirst}>
            Reprocess findings first
          </button>
        </div>
      </div>
    </div>
  );
}
