export default function ReggiePanel({
  isOpen,
  onClose,
  reggieScope,
  suggestions,
  reggieMessages,
  onQuickPrompt,
  filteredCrossDocResults,
  documentsById,
  safeText,
  safeSourceField,
  onJumpToEvidence,
  onAddAsFinding,
  reggieInput,
  setReggieInput,
  onSend
}) {
  if (!isOpen) return null;

  return (
    <>
      <div className="reggie-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="reggie-panel" role="dialog" aria-modal="true" aria-label="Reggie assistant">
        <header className="reggie-panel__header">
          <div>
            <h3>Reggie</h3>
            <p>{reggieScope === 'document' ? 'This document' : 'All documents'}</p>
          </div>
          <button type="button" className="btn btn-xs ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="reggie-panel__messages">
          {reggieMessages.length === 0 ? (
            <div className="reggie-welcome">
              <div className="reggie-welcome__icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2L3 5v5.5C3 15 6.2 18.2 10 19c3.8-.8 7-4 7-8.5V5L10 2z" />
                  <polyline points="6.5,10.5 8.75,12.75 13.5,7.5" />
                </svg>
              </div>
              <p>
                Regulatory Guidance &amp; Inspection Engine
                <br />
                <span>I can help you explore this case</span>
              </p>
            </div>
          ) : null}
          {reggieMessages.length === 0 ? (
            <div className="reggie-suggestions">
              {suggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="reggie-suggestion-chip"
                  onClick={() => onQuickPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
          {reggieMessages.map((message) => (
            <article key={message.id} className={`reggie-message ${message.role}`}>
              <p>{message.text}</p>
            </article>
          ))}
          {filteredCrossDocResults.slice(0, 2).map((finding) => {
            const relatedDoc = documentsById.get(finding.documentId);
            return (
              <article key={`reggie-source-${finding.id}`} className="reggie-source-card">
                <strong>{safeText(finding.title, 'Finding')}</strong>
                <p>{relatedDoc?.label ?? 'Document'} · {safeSourceField(finding.source, 'section', 'Source excerpt')}</p>
                <button
                  type="button"
                  className="btn btn-xs ghost"
                  onClick={() => onJumpToEvidence(finding)}
                >
                  Jump to evidence
                </button>
                <button
                  type="button"
                  className="btn btn-xs secondary"
                  onClick={() => onAddAsFinding(finding)}
                >
                  Add as finding
                </button>
              </article>
            );
          })}
        </div>
        <div className="reggie-panel__composer">
          <input
            type="text"
            value={reggieInput}
            onChange={(event) => setReggieInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder={
              reggieScope === 'document'
                ? 'Ask Reggie about this document...'
                : 'Ask Reggie about this case...'
            }
          />
          <button
            type="button"
            className="btn btn-xs ghost reggie-voice-btn"
            title="Voice input (UI only)"
            aria-label="Voice input"
          >
            🎤
          </button>
          <button type="button" className="btn btn-xs secondary reggie-send-btn" onClick={onSend} title="Send">
            ➤
          </button>
        </div>
      </aside>
    </>
  );
}
