export default function DeleteFindingModal({ isOpen, onCancel, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Delete finding">
        <div className="modal-card__header">
          <h3>Delete finding?</h3>
          <button type="button" className="modal-card__close" aria-label="Close" onClick={onCancel}>
            ×
          </button>
        </div>
        <p>This action cannot be undone and removes the finding from current review views.</p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
