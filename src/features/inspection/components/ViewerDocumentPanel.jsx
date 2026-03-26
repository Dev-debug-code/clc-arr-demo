import PdfOverlayViewer from '../../../components/PdfOverlayViewer.jsx';

export default function ViewerDocumentPanel({
  docViewerRef,
  setCurrentStep,
  viewerBackStep,
  viewerBackLabel,
  viewerSelectionHistory,
  handleViewerBack,
  activeDocument,
  activeViewerFinding,
  safeText,
  viewerHasFindingFocus,
  viewerDocumentPosition,
  viewerDocumentCount,
  handleClearViewerFindingFocus,
  handleCycleDocument,
  viewerDocumentSequence,
  activeDocId,
  docPulse,
  handleSelectDocTab,
  isViewerFocusMode,
  setIsViewerFocusMode,
  showDocBoxes,
  setShowDocBoxes,
  activeDocBoxes,
  activeDocBoxId,
  handleSelectDocBox,
  docPdfScrollRef,
  docFocusSignal,
  activeDocMinimapMarkers,
  setDocLevelNoteOpen,
  docCrossSearchOpen,
  setDocCrossSearchOpen,
  setFeedbackOpen,
  docLevelNoteOpen,
  docLevelNoteDraft,
  setDocLevelNoteDraft,
  handleSaveDocumentNote,
  documentNotes,
  docSearchScope,
  setDocSearchScope,
  docSearchQuery,
  isProviderSearchLoading,
  filteredInDocumentResults,
  filteredCrossDocResults,
  findingReferencesDocument,
  getFindingPreferredBoxIdForDocument,
  documentsById,
  formatSourceDocumentRef,
  handleViewDocument,
  handleOpenAddNote
}) {
  return (
    <div className="panel doc-panel" ref={docViewerRef}>
      <div className="doc-panel-header">
        <div className="doc-panel-header-main">
          <div className="doc-top-nav">
            <div className="doc-top-nav-left">
              <button type="button" className="doc-breadcrumb-link" onClick={() => setCurrentStep(viewerBackStep)}>
                ← {viewerBackLabel}
              </button>
              {viewerSelectionHistory.length > 0 ? (
                <button type="button" className="btn btn-xs ghost" onClick={handleViewerBack}>
                  Previous selection
                </button>
              ) : null}
            </div>
            <div className="doc-top-nav-center">
              <div>Document: {activeDocument?.filename ?? 'No document selected'}</div>
              <div className="doc-top-nav-context">
                {activeViewerFinding ? (
                  <>
                    Evidence focus: {safeText(activeViewerFinding.title, 'Finding')}
                    {activeViewerFinding?.id ? <span className="badge">{activeViewerFinding.id}</span> : null}
                  </>
                ) : (
                  'Browsing all case documents'
                )}
              </div>
            </div>
            <div className="doc-top-nav-right">
              <span className="doc-navigator">
                <span className="doc-navigator-label">
                  {viewerHasFindingFocus ? 'Finding evidence' : 'Case documents'}
                </span>
                <span>
                  Viewing: {viewerDocumentPosition} of {viewerDocumentCount}
                </span>
              </span>
              {viewerHasFindingFocus ? (
                <button type="button" className="btn btn-xs ghost" onClick={handleClearViewerFindingFocus}>
                  Browse all documents
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-icon btn-xs secondary"
                onClick={() => handleCycleDocument(-1)}
                disabled={viewerDocumentSequence.length <= 1}
              >
                ◀
              </button>
              <button
                type="button"
                className="btn btn-icon btn-xs secondary"
                onClick={() => handleCycleDocument(1)}
                disabled={viewerDocumentSequence.length <= 1}
              >
                ▶
              </button>
            </div>
          </div>
          <div className="doc-tabs">
            {viewerDocumentSequence.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={`doc-tab ${activeDocId === doc.id ? 'active' : ''} severity-${doc.severity} ${
                  docPulse === doc.id ? 'pulse' : ''
                }`}
                onClick={() => handleSelectDocTab(doc.id)}
              >
                <span className="status-dot" />
                {doc.label}
              </button>
            ))}
          </div>
          {viewerHasFindingFocus ? (
            <div className="doc-sequence-note">
              Showing only documents linked to the selected finding. Clear focus to return to the full case set.
            </div>
          ) : null}
        </div>
        <div className="overlay-controls">
          <button type="button" className="btn btn-xs ghost" onClick={() => setIsViewerFocusMode((prev) => !prev)}>
            {isViewerFocusMode ? 'Exit focus' : 'Focus viewer'}
          </button>
          <label className="toggle">
            <input type="checkbox" checked={showDocBoxes} onChange={(event) => setShowDocBoxes(event.target.checked)} />
            <span>Show highlights</span>
          </label>
        </div>
      </div>
      {activeDocBoxes.length === 0 ? (
        <div className="alert alert-warning small">No bounding boxes are available for this document yet.</div>
      ) : null}
      <div className="doc-panel-body">
        <div className="pdf-overlay-panel">
          <PdfOverlayViewer
            key={activeDocument?.id || activeDocument?.pdf || 'doc-viewer'}
            pdfUrl={activeDocument?.pdf}
            boxes={activeDocBoxes}
            showBoxes={showDocBoxes}
            activeBoxId={activeDocBoxId}
            onSelectBox={(boxId) =>
              handleSelectDocBox(boxId, {
                origin: 'pdf',
                documentId: activeDocId
              })
            }
            scrollRef={docPdfScrollRef}
            focusSignal={docFocusSignal}
          />
          {activeDocMinimapMarkers.length > 0 ? (
            <div className="doc-minimap" title="Document minimap">
              {activeDocMinimapMarkers.map((marker) => (
                <button
                  key={`minimap-${marker.id}`}
                  type="button"
                  className={`doc-minimap-marker severity-${marker.severity}`}
                  style={{ top: `${marker.topPercent}%` }}
                  onClick={() => handleSelectDocBox(marker.id, { scrollFinding: true, documentId: activeDocId })}
                  title="Jump to highlighted evidence"
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="doc-viewer-footer">
        <div className="doc-viewer-footer__actions">
          <button type="button" className="btn btn-xs secondary" onClick={() => setDocLevelNoteOpen(true)}>
            📝 Add note to document
          </button>
          <button
            type="button"
            className="btn btn-xs secondary"
            onClick={() => setDocCrossSearchOpen((prev) => !prev)}
          >
            {docCrossSearchOpen ? 'Hide search' : 'Search documents'}
          </button>
        </div>
        <button type="button" className="doc-viewer-feedback" onClick={() => setFeedbackOpen(true)}>
          ? Something to tell us?
        </button>
      </div>
      {docLevelNoteOpen ? (
        <div className="doc-note-inline-panel">
          <p className="panel-subtitle">
            Document note for: <strong>{activeDocument?.label ?? 'Current document'}</strong>
          </p>
          <textarea
            className="modal-textarea"
            value={docLevelNoteDraft}
            onChange={(event) => setDocLevelNoteDraft(event.target.value)}
            placeholder="Add context about this document for the next processing run..."
          />
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setDocLevelNoteOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn primary" onClick={handleSaveDocumentNote}>
              Save note
            </button>
          </div>
          {(documentNotes[activeDocId] ?? []).length > 0 ? (
            <div className="doc-note-history">
              {(documentNotes[activeDocId] ?? []).slice(0, 4).map((entry) => (
                <p key={entry.id}>
                  <span>{entry.ts} - {entry.actor}</span>
                  {entry.text}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {docCrossSearchOpen ? (
        <div className="doc-cross-search-panel">
          <div className="doc-search-scope-tabs">
            <button
              type="button"
              className={`doc-search-scope-tab ${docSearchScope === 'document' ? 'active' : ''}`}
              onClick={() => setDocSearchScope('document')}
            >
              This document
            </button>
            <button
              type="button"
              className={`doc-search-scope-tab ${docSearchScope === 'all' ? 'active' : ''}`}
              onClick={() => setDocSearchScope('all')}
            >
              Cross-document
            </button>
          </div>
          <p className="panel-subtitle">
            {docSearchScope === 'document' ? 'Document Search' : 'Cross-Document Search'}
          </p>
          {!docSearchQuery.trim() ? (
            <p className="panel-subtitle">
              {docSearchScope === 'document'
                ? 'Search this document using keywords and jump directly to evidence.'
                : 'Search across all case documents and jump directly to evidence.'}
            </p>
          ) : isProviderSearchLoading ? (
            <p className="panel-subtitle">Searching...</p>
          ) : (docSearchScope === 'document' ? filteredInDocumentResults.length === 0 : filteredCrossDocResults.length === 0) ? (
            <p className="panel-subtitle">
              {docSearchScope === 'document'
                ? 'No matches found in this document. Try broader terms.'
                : 'No cross-document matches found. Try broader terms.'}
            </p>
          ) : (
            <div className="docs-search-results compact">
              {(docSearchScope === 'document' ? filteredInDocumentResults : filteredCrossDocResults).map((finding) => {
                const resultDocumentId =
                  docSearchScope === 'document' && findingReferencesDocument(finding, activeDocId)
                    ? activeDocId
                    : finding.documentId;
                const resultBoxId =
                  docSearchScope === 'document'
                    ? getFindingPreferredBoxIdForDocument(finding, resultDocumentId)
                    : finding.boxId;
                const relatedDoc = documentsById.get(resultDocumentId || finding.documentId);
                return (
                  <div key={`viewer-search-${finding.id}`} className="docs-search-result">
                    <strong>{safeText(finding.title, 'Finding')}</strong>
                    <p>{relatedDoc?.label ?? 'Document'} · {safeText(finding.detail, '')}</p>
                    {finding.source ? <p className="finding-doc-ref">{formatSourceDocumentRef(finding.source)}</p> : null}
                    <div className="search-result-actions">
                      <button
                        type="button"
                        className="btn btn-xs secondary"
                        onClick={() => handleViewDocument(resultDocumentId, resultBoxId, finding.id)}
                      >
                        Jump to passage
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs ghost"
                        onClick={() => handleOpenAddNote(finding.id, safeText(finding.detail, ''))}
                      >
                        Add as finding note
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
