export default function FeedbackControls({
  isViewerStep,
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
      <div className={`feedback-tab ${isViewerStep ? 'left' : ''}`}>
        <button type="button" onClick={onOpen}>
          Feedback
        </button>
      </div>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Share feedback">
            <h3>Share feedback</h3>
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
              Notes
            </label>
            <textarea
              id="feedback-text"
              className="modal-textarea"
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="Tell us what needs improving..."
            />
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={onClose}>
                Close
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
