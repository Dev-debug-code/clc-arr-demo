export default function DocumentsIntakePhase({
  uploadAreaCollapsed,
  setUploadAreaCollapsed,
  openDocumentsFilePicker,
  handleUploadDrop,
  uploadItems,
  handleRemoveUploadItem,
  formatShortDisplayDate,
  currentCaseMeta,
  toIsoDate,
  handleRunClassification
}) {
  return (
    <div className="docs-wireframe-phase">
      <div className="section-heading">
        <h2>Document intake</h2>
      </div>

      <p className="panel-subtitle docs-phase-intro">
        Select all case documents first. Once they are loaded, run AI classification across the full set.
      </p>

      {uploadAreaCollapsed ? (
        <button type="button" className="upload-collapsed" onClick={() => setUploadAreaCollapsed(false)}>
          + Add documents
        </button>
      ) : (
        <div
          className="upload-area"
          role="button"
          tabIndex={0}
          onClick={openDocumentsFilePicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openDocumentsFilePicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={handleUploadDrop}
        >
          <div className="upload-icon">☁</div>
          <div className="upload-title">Drop files here or click to upload</div>
          <div className="upload-subtitle">PDF documents up to 32MB each</div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={(event) => {
              event.stopPropagation();
              openDocumentsFilePicker();
            }}
          >
            Choose files
          </button>
        </div>
      )}

      <div className="section-heading">
        <h2>
          Selected documents <span className="docs-count-inline">({uploadItems.length})</span>
        </h2>
      </div>

      {uploadItems.length === 0 ? (
        <div className="empty-state-inline">
          <h4>No documents selected yet</h4>
          <p>Add the case files first, then run AI classification.</p>
        </div>
      ) : (
        <table className="table docs-wire-table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: '180px' }}>Stage</th>
              <th style={{ width: '110px' }}>Added</th>
              <th style={{ width: '110px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {uploadItems.map((item) => {
              const stageLabel =
                item.status === 'verified'
                  ? 'Confirmed'
                  : item.status === 'classified'
                    ? 'Ready for review'
                    : 'Queued for classification';

              return (
                <tr key={`intake-row-${item.id}`}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</td>
                  <td>{stageLabel}</td>
                  <td>{formatShortDisplayDate(item.addedOn ?? currentCaseMeta.started ?? toIsoDate(new Date()))}</td>
                  <td>
                    {item.status === 'queued' ? (
                      <button
                        type="button"
                        className="btn btn-xs ghost docs-remove-btn"
                        onClick={() => handleRemoveUploadItem(item.id)}
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="docs-locked-label">Locked</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="warning-messages">
        <div className="warning-line muted">
          AI classification runs across all selected documents together before the reviewer checks the results.
        </div>
      </div>

      <div className="bottom-actions">
        <button type="button" className="btn primary" disabled={uploadItems.length === 0} onClick={handleRunClassification}>
          Run AI classification
        </button>
      </div>
    </div>
  );
}
