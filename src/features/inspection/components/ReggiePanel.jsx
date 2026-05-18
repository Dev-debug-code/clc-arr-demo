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

function formatFindingSeverity(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'critical') return 'Non-compliant';
  if (normalized === 'warning') return 'Inconclusive';
  if (normalized === 'compliant') return 'Compliant';
  if (normalized === 'best_practice') return 'Good Practice';
  return value || 'Finding';
}

function formatFindingCertainty(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'lead') return 'Inconclusive';
  if (normalized === 'finding') return 'Finding';
  return value || 'Finding';
}

function formatCodeAreaLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'General';
  if (normalized.includes('money laundering') || normalized === 'aml') return 'Anti-Money Laundering';
  if (normalized.includes('lender') || normalized.includes('mortgage fraud')) return 'Acting for Lenders';
  if (normalized.includes('code of conduct')) return 'Code of Conduct';
  return value;
}

function renderRichText(message, onOpenCitation) {
  return renderMessageSegments(message).map((segment, index) =>
    segment.type === 'citation' ? (
      <button
        key={`${message.id || 'reggie'}-citation-${segment.value}-${index}`}
        type="button"
        className="reggie-inline-citation"
        onClick={() => onOpenCitation(segment.citation)}
      >
        {segment.value}
      </button>
    ) : (
      <span key={`${message.id || 'reggie'}-text-${index}`}>{segment.value}</span>
    )
  );
}

function ReggieCitationList({ messageId, citations, onOpenCitation }) {
  if (!Array.isArray(citations) || citations.length === 0) return null;

  return (
    <div className="reggie-citations">
      <div className="reggie-section-label">Citations</div>
      {citations.map((citation) => (
        <div key={`${messageId}-${citation.label}-${citation.source}`} className="reggie-citation-card">
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
  );
}

function ReggieInspectionCard({ message, onOpenCitation }) {
  return (
    <article className="reggie-message assistant reggie-message--card reggie-inspection-card">
      <div className="reggie-card__eyebrow">Investigation output</div>
      <h4>{message.topic || 'Inspection'}</h4>
      <p className="reggie-answer">{renderRichText(message, onOpenCitation)}</p>
      <ReggieCitationList messageId={message.id} citations={message.citations} onOpenCitation={onOpenCitation} />
    </article>
  );
}

function ReggieFindingProposalCard({ message, onOpenCitation, onAccept, onReject }) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const finding = message?.finding ?? {};
  const proposalStatus = message?.proposalStatus ?? 'pending';
  const isResolved = proposalStatus !== 'pending' && proposalStatus !== 'saving';

  const handleRejectSubmit = () => {
    const cleanReason = rejectReason.trim();
    if (!cleanReason) return;
    onReject?.(message, cleanReason);
    setRejectReason('');
    setIsRejecting(false);
  };

  return (
    <article
      className={`reggie-message assistant reggie-message--card reggie-finding-card${isResolved ? ' is-resolved' : ''}`}
    >
      <div className="reggie-card__eyebrow">Proposed finding</div>
      <div className="reggie-finding-card__head">
        <h4>{finding.title || 'Proposed finding'}</h4>
        <div className="reggie-finding-card__pills">
          <span className={`reggie-status-pill severity-${String(finding.severity || '').toLowerCase()}`}>
            {formatFindingSeverity(finding.severity)}
          </span>
          <span className="reggie-status-pill certainty">{formatFindingCertainty(finding.certainty)}</span>
          <span className="reggie-status-pill code-area">{formatCodeAreaLabel(finding.codeArea)}</span>
        </div>
      </div>
      <p className="reggie-finding-card__summary">{finding.summary}</p>
      <div className="reggie-finding-card__evidence">
        <div className="reggie-section-label">Evidence</div>
        <p className="reggie-answer">{renderRichText({ id: `${message.id}-evidence`, answerText: finding.evidence, citations: message.citations }, onOpenCitation)}</p>
      </div>
      <ReggieCitationList messageId={message.id} citations={message.citations} onOpenCitation={onOpenCitation} />
      {proposalStatus === 'accepted' ? (
        <div className="reggie-finding-card__decision is-accepted">Accepted and sent back to Reggie.</div>
      ) : null}
      {proposalStatus === 'saving' ? (
        <div className="reggie-finding-card__decision">Saving accepted finding into the workspace...</div>
      ) : null}
      {proposalStatus === 'rejected' ? (
        <div className="reggie-finding-card__decision is-rejected">
          Rejected. Reason: {message.rejectionReason || 'No reason recorded.'}
        </div>
      ) : null}
      {proposalStatus === 'pending' ? (
        <div className="reggie-finding-card__actions">
          <button type="button" className="btn btn-sm primary" onClick={() => onAccept?.(message)}>
            Accept
          </button>
          <button
            type="button"
            className="btn btn-sm secondary"
            onClick={() => {
              setIsRejecting((prev) => !prev);
              setRejectReason('');
            }}
          >
            Reject
          </button>
        </div>
      ) : null}
      {proposalStatus === 'pending' && isRejecting ? (
        <div className="reggie-finding-card__reject">
          <label className="reggie-section-label" htmlFor={`${message.id}-reject-reason`}>
            Rejection reason
          </label>
          <textarea
            id={`${message.id}-reject-reason`}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Tell Reggie why this proposed finding should be rejected..."
          />
          <div className="reggie-finding-card__reject-actions">
            <button type="button" className="btn btn-sm ghost" onClick={() => setIsRejecting(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm primary" onClick={handleRejectSubmit}>
              Send rejection
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
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
  onSend,
  hasReggieRuntimeKey,
  onManageReggieAccessKey,
  onClearReggieAccessKey,
  reggieBusy,
  onAcceptFindingProposal,
  onRejectFindingProposal
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

  const highModeBlocked = reggieThinkingLevel === 'high' && !hasReggieRuntimeKey;
  const sendDisabled = reggieThinkingLevel === 'high' && (highModeBlocked || reggieBusy);

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

          <div className={`reggie-runtime-status${hasReggieRuntimeKey ? ' is-ready' : ' is-missing'}`}>
            <div>
              <span className="reggie-section-label">Live access</span>
              <p>
                {hasReggieRuntimeKey
                  ? 'High mode is ready to call the deployed Reggie runtime.'
                  : 'High mode needs a Reggie access key. Medium mode remains available without it.'}
              </p>
            </div>
            <div className="reggie-runtime-status__actions">
              <button type="button" className="btn btn-xs secondary" onClick={onManageReggieAccessKey}>
                {hasReggieRuntimeKey ? 'Update key' : 'Set key'}
              </button>
              {hasReggieRuntimeKey ? (
                <button type="button" className="btn btn-xs ghost" onClick={onClearReggieAccessKey}>
                  Clear
                </button>
              ) : null}
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

          {reggieBusy ? <p className="reggie-panel__hint">Reggie is working through the current high-mode query.</p> : null}
          {highModeBlocked ? (
            <p className="reggie-panel__hint">Add the Reggie access key to use live high mode from this hosted site.</p>
          ) : null}
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

          {reggieMessages.map((message) => {
            if (message.kind === 'inspection_card') {
              return <ReggieInspectionCard key={message.id} message={message} onOpenCitation={onOpenCitation} />;
            }

            if (message.kind === 'finding_proposal') {
              return (
                <ReggieFindingProposalCard
                  key={message.id}
                  message={message}
                  onOpenCitation={onOpenCitation}
                  onAccept={onAcceptFindingProposal}
                  onReject={onRejectFindingProposal}
                />
              );
            }

            return (
              <article key={message.id} className={`reggie-message ${message.role}`}>
                <p className="reggie-answer">{renderRichText(message, onOpenCitation)}</p>
                {message.role === 'assistant' && Array.isArray(message.citations) && message.citations.length > 0 ? (
                  <ReggieCitationList
                    messageId={message.id}
                    citations={message.citations}
                    onOpenCitation={onOpenCitation}
                  />
                ) : null}
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
              if (event.key === 'Enter' && !sendDisabled) {
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
            className="btn secondary reggie-send-btn"
            onClick={() => onSend()}
            title="Send"
            disabled={sendDisabled}
          >
            {reggieBusy ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </aside>
    </>
  );
}
