export default function NotAssessedAreasPanel({
  expanded,
  setExpanded,
  entries,
  title = 'Not Assessed',
  emptyText = 'No entries',
  subtitle = '',
  actionLabel = '',
  onAction = null
}) {
  return (
    <div
      className={`not-assessed ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setExpanded((prev) => !prev);
        }
      }}
    >
      <div className="not-assessed-header">
        <span className="code-area-chevron">{expanded ? '▼' : '▶'}</span>
        <span>
          {title} <span className="panel-subtitle">({entries.length})</span>
        </span>
      </div>
      <div className="not-assessed-body">
        {entries.length === 0 ? (
          <div className="not-assessed-item">
            <div>
              <span>{emptyText}</span>
            </div>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry} className="not-assessed-item">
              <span>{entry}</span>
              {subtitle || (typeof onAction === 'function' && actionLabel) ? (
                <span className="panel-subtitle">
                  {subtitle ? `${subtitle}${typeof onAction === 'function' && actionLabel ? '. ' : ''}` : ''}
                  {typeof onAction === 'function' && actionLabel ? (
                    <a
                      href="#"
                      className="btn-tertiary"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onAction(entry);
                      }}
                    >
                      {actionLabel}
                    </a>
                  ) : null}
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
