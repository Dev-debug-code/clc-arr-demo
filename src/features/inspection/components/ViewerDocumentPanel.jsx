import PdfOverlayViewer from '../../../components/PdfOverlayViewer.jsx';

export default function ViewerDocumentPanel({
  docViewerRef,
  setCurrentStep,
  viewerBackStep,
  viewerBackLabel,
  viewerSelectionHistory,
  handleViewerBack,
  activeDocument,
  viewerDocumentSequence,
  viewerDocumentPosition,
  viewerDocumentCount,
  handleCycleDocument,
  maxStepUnlocked,
  handleCaseTabNavigate,
  activeCaseTabId,
  activeDocId,
  activeDocBoxes,
  activeDocBoxId,
  handleSelectDocBox,
  docPdfScrollRef,
  docFocusSignal,
  activeDocMinimapMarkers,
  setFeedbackOpen,
  onOpenDocumentAssistant
}) {
  return (
    <div className="panel doc-panel" ref={docViewerRef}>
      <div className="doc-panel-header">
        <div className="doc-panel-header-main">
          <div className="doc-top-nav">
            <div className="doc-top-nav-left">
              <button type="button" className="doc-breadcrumb-link" onClick={() => setCurrentStep(viewerBackStep)}>
                <span aria-hidden="true">←</span>
                <span>{`Back to ${viewerBackLabel}`}</span>
              </button>
            </div>
            <div className="doc-top-nav-center">
              <div>Document: {activeDocument?.filename ?? 'No document selected'}</div>
            </div>
            <div className="doc-top-nav-right">
              <span>Viewing: {viewerDocumentPosition} of {viewerDocumentCount} documents</span>
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
        </div>
      </div>
      <div className="doc-panel-body">
        <div className="pdf-overlay-panel">
          <PdfOverlayViewer
            key={activeDocument?.id || activeDocument?.pdf || 'doc-viewer'}
            pdfUrl={activeDocument?.pdf}
            boxes={activeDocBoxes}
            showBoxes
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
          <button
            type="button"
            className="btn btn-xs secondary"
            onClick={onOpenDocumentAssistant}
          >
            Ask Reggie about this document
          </button>
        </div>
        <span
          className="doc-viewer-feedback"
          role="button"
          tabIndex={0}
          onClick={() => setFeedbackOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setFeedbackOpen(true);
            }
          }}
        >
          ? Something to tell us?
        </span>
      </div>
    </div>
  );
}
