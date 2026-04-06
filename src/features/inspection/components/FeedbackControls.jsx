export default function FeedbackControls({
  onOpen,
  isOpen,
  feedbackCategory,
  setFeedbackCategory,
  feedbackText,
  setFeedbackText,
  onClose,
  onSubmit
}) {
  return (
    <>
      <div className="feedback-tab">
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault();
            onOpen();
          }}
        >
          Feedback
        </a>
      </div>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Share feedback">
            <div className="modal-card__header">
              <h3>Send Feedback</h3>
              <button type="button" className="modal-card__close" aria-label="Close" onClick={onClose}>
                ×
              </button>
            </div>
            <label className="modal-label" htmlFor="feedback-category">
              Category
            </label>
            <select
              id="feedback-category"
              className="modal-select"
              value={feedbackCategory}
              onChange={(event) => setFeedbackCategory(event.target.value)}
            >
              <option value="bug">Bug</option>
              <option value="suggestion">Suggestion</option>
              <option value="question">Question</option>
              <option value="other">Other</option>
            </select>
            <label className="modal-label" htmlFor="feedback-text">
              Your feedback
            </label>
            <textarea
              id="feedback-text"
              className="modal-textarea"
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="Tell us what you think..."
            />
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={onSubmit}>
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
