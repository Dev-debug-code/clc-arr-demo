export default function DocumentsManagePhase({
  documentRows,
  expandedUploadSummaryId,
  setExpandedUploadSummaryId,
  handleViewDocument,
  stepDocuments,
  setDocumentWorkspaceTab,
  documentsNotesExpanded,
  setDocumentsNotesExpanded,
  flattenedDocumentNotes,
  documentsLogExpanded,
  setDocumentsLogExpanded,
  processingEntries,
  setDocumentsPhase,
  openDocumentsFilePicker
}) {
  return (
    <div className="docs-wireframe-phase">
      <div className="section-heading">
        <h2>
          Documents <span className="docs-count-inline">({documentRows.length})</span>
        </h2>
        <div className="section-heading-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDocumentsPhase('upload')}>
            Edit classifications
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={openDocumentsFilePicker}>
            + Add docs
          </button>
        </div>
      </div>

      {documentRows.length === 0 ? (
        <div className="empty-state-inline">
          <h4>No documents uploaded yet</h4>
          <p>Upload files in Phase 1 to begin ongoing management.</p>
        </div>
      ) : (
        <table className="table docs-wire-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Classification</th>
              <th>Parties</th>
              <th style={{ width: '90px' }}>Findings</th>
              <th style={{ width: '130px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {documentRows.flatMap((row) => {
              const summaryRowId = `manage-${row.id}`;
              const showSummary = expandedUploadSummaryId === summaryRowId && row.summary;
              const rows = [
                <tr key={`manage-row-${row.id}`}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {row.summary ? (
                      <button
                        type="button"
                        className="summary-toggle-inline"
                        onClick={() => setExpandedUploadSummaryId((prev) => (prev === summaryRowId ? '' : summaryRowId))}
                      >
                        {showSummary ? '▼' : '▶'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="table-link-btn"
                      onClick={() => handleViewDocument(row.id, null, null, stepDocuments)}
                    >
                      {row.label}
                    </button>
                  </td>
                  <td>
                    {row.classification}
                    {row.limitedAnalysis ? <div className="classification-hint">Limited analysis</div> : null}
                  </td>
                  <td>{row.parties}</td>
                  <td>
                    {row.findingsCount > 0 ? (
                      <button
                        type="button"
                        className="table-link-btn"
                        onClick={() => {
                          handleViewDocument(row.id, null, null, stepDocuments);
                          setDocumentWorkspaceTab('findings');
                        }}
                      >
                        {row.findingsCount}
                      </button>
                    ) : (
                      row.findingsCount
                    )}
                  </td>
                  <td>
                    {row.status === 'verified' ? (
                      <span className="status-processed">✓ Processed</span>
                    ) : row.status === 'attention' ? (
                      <span className="status-needs-attention">Needs attention</span>
                    ) : (
                      <span className="status-reviewing">Reviewing</span>
                    )}
                  </td>
                </tr>
              ];

              if (showSummary) {
                rows.push(
                  <tr key={`manage-summary-${row.id}`} className="summary-row">
                    <td colSpan={5}>
                      <div className="summary-block">{row.summary}</div>
                    </td>
                  </tr>
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      )}

      <div className={`expandable-section ${documentsNotesExpanded ? 'expanded' : ''}`}>
        <button
          type="button"
          className="expandable-header"
          onClick={() => setDocumentsNotesExpanded((prev) => !prev)}
        >
          <span className="expandable-chevron">▶</span>
          Document Notes <span className="docs-count-inline">({flattenedDocumentNotes.length})</span>
        </button>
        <div className="expandable-body">
          {flattenedDocumentNotes.length > 0 ? (
            flattenedDocumentNotes.slice(0, 8).map((entry) => (
              <div key={`doc-note-${entry.id}`} className="doc-note">
                <span className="doc-note-file">{entry.docLabel}</span> —{' '}
                <span className="doc-note-text">{entry.text}</span>
              </div>
            ))
          ) : (
            <div className="doc-note">
              <span className="doc-note-text">No document notes added yet.</span>
            </div>
          )}
        </div>
      </div>

      <div className={`expandable-section ${documentsLogExpanded ? 'expanded' : ''}`}>
        <button
          type="button"
          className="expandable-header"
          onClick={() => setDocumentsLogExpanded((prev) => !prev)}
        >
          <span className="expandable-chevron">▶</span>
          Processing Log
        </button>
        <div className="expandable-body">
          {processingEntries.map((entry) => {
            const isInitial = /initial/i.test(entry.detail);
            return (
              <div key={`phase2-log-${entry.id}`} className="log-entry">
                <div className={`log-dot ${isInitial ? 'dot-process' : 'dot-update'}`} />
                <div className="log-text">{entry.detail}</div>
                <div className="log-time">{entry.time}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
