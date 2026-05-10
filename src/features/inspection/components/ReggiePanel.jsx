import { useEffect, useRef, useState } from 'react';

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
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);
  const messagesRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      const timer = setTimeout(() => setIsVisible(true), 28);
      return () => clearTimeout(timer);
    }

    setIsVisible(false);
    const timer = setTimeout(() => setIsMounted(false), 220);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isVisible || !messagesRef.current) return;
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [isVisible, reggieMessages.length]);

  if (!isMounted) return null;

  return (
    <>
      <div className={`reggie-backdrop ${isVisible ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside
        className={`reggie-panel ${isVisible ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Reggie assistant"
      >
        <header className="reggie-panel__header">
          <div>
            <div className="reggie-panel__eyebrow">Assistant</div>
            <h3>Reggie</h3>
            <p>{reggieScope === 'document' ? 'Focused on this document' : 'Scanning across the full case'}</p>
          </div>
          <button type="button" className="btn btn-xs ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="reggie-panel__messages" ref={messagesRef}>
          {reggieMessages.length === 0 ? (
            <div className="reggie-welcome">
              <div className="reggie-welcome__icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2L3 5v5.5C3 15 6.2 18.2 10 19c3.8-.8 7-4 7-8.5V5L10 2z" />
                  <polyline points="6.5,10.5 8.75,12.75 13.5,7.5" />
                </svg>
              </div>
              <p>Regulatory Guidance &amp; Inspection Engine</p>
              <span>Use Reggie to surface linked evidence, cross-document patterns and quick drafting prompts.</span>
            </div>
          ) : null}
          {reggieMessages.length === 0 ? (
            <div className="reggie-suggestions-wrap">
              <div className="reggie-section-label">Suggested prompts</div>
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
                <div className="reggie-source-card__label">Relevant source</div>
                <strong>{safeText(finding.title, 'Finding')}</strong>
                <p>{relatedDoc?.label ?? 'Document'} · {safeSourceField(finding.source, 'section', 'Source excerpt')}</p>
                <div className="reggie-source-card__actions">
                  <button
                    type="button"
                    className="btn btn-xs secondary reggie-jump-btn"
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
                </div>
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
          <button type="button" className="btn secondary reggie-send-btn" onClick={onSend} title="Send">
            Send
          </button>
        </div>
      </aside>
    </>
  );
}
