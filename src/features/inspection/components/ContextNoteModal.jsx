export default function ContextNoteModal({ isOpen, draft, setDraft, onClose, onSave }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Add case context note">
        <div className="modal-card__header">
          <h3>Add case context note</h3>
          <button type="button" className="modal-card__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p>This context will be included on the next processing run.</p>
        <textarea
          className="modal-textarea"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add context about rejected findings, inspection scope, or known exceptions..."
        />
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn primary" onClick={onSave}>
            Save context
          </button>
        </div>
      </div>
    </div>
  );
}
