export default function UndoToast({ undoDecision, onUndo }) {
  if (!undoDecision) return null;

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span>
        {undoDecision.nextDecision === 'accepted' ? (
          <>
            Finding <strong>accepted</strong>.
          </>
        ) : undoDecision.nextDecision === 'rejected' ? (
          <>
            Finding <strong>rejected</strong>.
          </>
        ) : undoDecision.nextDecision === 'dismissed' ? (
          <>
            Lead <strong>dismissed</strong>.
          </>
        ) : (
          'Decision cleared.'
        )}
      </span>
      <button type="button" className="undo-link-btn" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
