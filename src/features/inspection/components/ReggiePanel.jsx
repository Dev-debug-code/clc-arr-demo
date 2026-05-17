import { useEffect, useRef, useState } from 'react';

function renderMessageSegments(message) {
  const text = message?.answerText || message?.text || '';
  const citations = Array.isArray(message?.citations) ? message.citations.filter(Boolean) : [];

  if (!text || citations.length === 0) {
    return [{ type: 'text', value: text }];
  }

  const tokens = citations
    .map((citation) => ({
      label: String(citation?.label || '').trim(),
      citation
    }))
    .filter((entry) => entry.label);

  if (tokens.length === 0) {
    return [{ type: 'text', value: text }];
  }

  const pattern = new RegExp(
    `(${tokens.map((entry) => entry.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g'
  );
  const lookup = new Map(tokens.map((entry) => [entry.label, entry.citation]));
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const label = match[0];
    segments.push({ type: 'citation', value: label, citation: lookup.get(label) });
    lastIndex = match.index + label.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

export default function ReggiePanel({
  isOpen,
  onClose,
  reggieScope,
  reggieThinkingLevel,
  setReggieThinkingLevel,
  suggestions,
  reggieChats,
  activeReggieChatId,
  onCreateNewChat,
  onSelectChat,
  reggieMessages,
  onQuickPrompt,
  onOpenCitation,
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
  }, [activeReggieChatId, isVisible, reggieMessages.length]);

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

        <div className="reggie-panel__controls">
          <div className="reggie-panel__thinking">
            <span className="reggie-section-label">Thinking level</span>
            <div className="reggie-thinking-toggle" role="tablist" aria-label="Reggie thinking level">
              {['medium', 'high'].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`reggie-thinking-toggle__btn${reggieThinkingLevel === level ? ' is-active' : ''}`}
                  onClick={() => setReggieThinkingLevel(level)}
                >
                  {level === 'medium' ? 'Medium' : 'High'}
                </button>
              ))}
            </div>
          </div>
          <div className="reggie-panel__chats">
            <div className="reggie-panel__chats-head">
              <span className="reggie-section-label">Chats</span>
              <button type="button" className="btn btn-xs secondary" onClick={onCreateNewChat}>
                New chat
              </button>
            </div>
            <div className="reggie-chat-list">
              {reggieChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  className={`reggie-chat-chip${activeReggieChatId === chat.id ? ' is-active' : ''}`}
                  onClick={() => onSelectChat(chat.id)}
                >
                  {chat.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="reggie-panel__messages" ref={messagesRef}>
          {reggieMessages.length === 0 ? (
            <>
              <div className="reggie-welcome">
                <div className="reggie-welcome__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2L3 5v5.5C3 15 6.2 18.2 10 19c3.8-.8 7-4 7-8.5V5L10 2z" />
                    <polyline points="6.5,10.5 8.75,12.75 13.5,7.5" />
                  </svg>
                </div>
                <p>Regulatory Guidance &amp; Inspection Engine</p>
                <span>Use Reggie to cross-check the document corpus and return linked citations.</span>
              </div>
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
            </>
          ) : null}

          {reggieMessages.map((message) => (
            <article key={message.id} className={`reggie-message ${message.role}`}>
              <p className="reggie-answer">
                {renderMessageSegments(message).map((segment, index) =>
                  segment.type === 'citation' ? (
                    <button
                      key={`${message.id}-citation-${segment.value}-${index}`}
                      type="button"
                      className="reggie-inline-citation"
                      onClick={() => onOpenCitation(segment.citation)}
                    >
                      {segment.value}
                    </button>
                  ) : (
                    <span key={`${message.id}-text-${index}`}>{segment.value}</span>
                  )
                )}
              </p>
              {message.role === 'assistant' && Array.isArray(message.citations) && message.citations.length > 0 ? (
                <div className="reggie-citations">
                  <div className="reggie-section-label">Citations</div>
                  {message.citations.map((citation) => (
                    <div key={`${message.id}-${citation.label}-${citation.source}`} className="reggie-citation-card">
                      <button
                        type="button"
                        className="btn btn-xs secondary reggie-citation-card__button"
                        onClick={() => onOpenCitation(citation)}
                      >
                        {citation.label} {citation.source}
                      </button>
                      <p>{citation.quote}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
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
