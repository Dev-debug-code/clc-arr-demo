export default function DocumentsManagePhase({
  documentRows,
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
            {documentRows.map((row) => (
              <tr key={`manage-row-${row.id}`}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{row.label}</td>
                  <td>
                    <div className="classification-cell">
                      {row.classification}
                      {row.limitedAnalysis ? (
                        <span className="tooltip-wrap classification-tooltip">
                          <button type="button" className="classification-info-button" aria-label="Classification help">
                            i
                          </button>
                          <span className="tooltip-text">
                            Limited analysis. Classify more specifically for full processing.
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{row.parties}</td>
                  <td>{row.findingsCount}</td>
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
