export default function ConfirmAllUploadsModal({ isOpen, onCancel, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm all classifications"
      >
        <h3>Confirm All Remaining?</h3>
        <p>You haven't viewed all classifications yet. Confirm all anyway?</p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={onConfirm}>
            Confirm all
          </button>
        </div>
      </div>
    </div>
  );
}
