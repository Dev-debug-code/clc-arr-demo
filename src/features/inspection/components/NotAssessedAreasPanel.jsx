export default function NotAssessedAreasPanel({
  expanded,
  setExpanded,
  entries,
  title = 'Not Assessed',
  emptyText = 'No entries',
  subtitle = 'Excluded from this inspection',
  actionLabel = 'Restore to assessment',
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
        <span>{expanded ? '▼' : '▶'}</span>
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
              <div>
                <span>{entry}</span>
                <div className="panel-subtitle">{subtitle}</div>
              </div>
              {typeof onAction === 'function' ? (
                <button
                  type="button"
                  className="btn btn-xs secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAction(entry);
                  }}
                >
                  {actionLabel}
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
