import { useEffect, useMemo, useRef, useState } from 'react';
import PdfOverlayViewer from '../../../components/PdfOverlayViewer.jsx';

function JsonDocumentPreview({ documentUrl, selectedEvidence, focusSignal }) {
  const [content, setContent] = useState('');
  const [parsedContent, setParsedContent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const activeTranscriptEntryRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const loadDocument = async () => {
      if (!documentUrl) {
        setContent('');
        setParsedContent(null);
        setError('Transcript file unavailable.');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const response = await fetch(documentUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const rawText = await response.text();
        let formattedText = rawText;
        let parsedJson = null;
        try {
          parsedJson = JSON.parse(rawText);
          formattedText = JSON.stringify(parsedJson, null, 2);
        } catch {
          formattedText = rawText;
        }
        if (!cancelled) {
          setContent(formattedText);
          setParsedContent(parsedJson);
        }
      } catch (loadError) {
        if (!cancelled) {
          setContent('');
          setParsedContent(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load transcript preview.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [documentUrl]);

  const selectedTimestamp = useMemo(() => {
    const rawCategory = String(selectedEvidence?.category || '');
    const match = rawCategory.match(/(\d{2}:\d{2}:\d{2})/u);
    return match?.[1] ?? '';
  }, [selectedEvidence?.category]);

  const transcriptEntries = useMemo(() => {
    return Array.isArray(parsedContent?.transcript) ? parsedContent.transcript : [];
  }, [parsedContent]);

  const activeTranscriptIndex = useMemo(() => {
    if (!selectedTimestamp || transcriptEntries.length === 0) {
      return -1;
    }
    return transcriptEntries.findIndex((entry) => String(entry?.timestamp || '').trim() === selectedTimestamp);
  }, [selectedTimestamp, transcriptEntries]);

  useEffect(() => {
    if (activeTranscriptIndex >= 0 && activeTranscriptEntryRef.current) {
      activeTranscriptEntryRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeTranscriptIndex, focusSignal]);

  return (
    <div className="json-doc-viewer">
      <div className="json-doc-viewer__header">
        <strong>JSON transcript preview</strong>
        <span>This document is stored as JSON rather than PDF.</span>
      </div>
      {selectedEvidence ? (
        <div className="json-doc-viewer__evidence">
          <div className="json-doc-viewer__evidence-label">Selected evidence</div>
          <strong>{selectedEvidence.title || selectedEvidence.category || 'Transcript evidence'}</strong>
          <p>{selectedEvidence.details || selectedEvidence.category || 'Relevant transcript section selected.'}</p>
        </div>
      ) : null}
      {loading ? <div className="json-doc-viewer__state">Loading transcript...</div> : null}
      {!loading && error ? <div className="json-doc-viewer__state is-error">{error}</div> : null}
      {!loading && !error && transcriptEntries.length > 0 ? (
        <div className="json-doc-viewer__transcript">
          <div className="json-doc-viewer__transcript-label">
            Transcript
            {selectedTimestamp ? <span>Highlighted evidence at {selectedTimestamp}</span> : null}
          </div>
          <div className="json-doc-viewer__transcript-list">
            {transcriptEntries.map((entry, index) => {
              const isActive = index === activeTranscriptIndex;
              return (
                <article
                  key={`${entry?.timestamp || 'line'}-${index}`}
                  ref={isActive ? activeTranscriptEntryRef : null}
                  className={`json-doc-viewer__transcript-entry ${isActive ? 'is-active' : ''}`}
                >
                  <div className="json-doc-viewer__transcript-meta">
                    <strong>{entry?.speaker || 'Speaker'}</strong>
                    <span>{entry?.timestamp || 'Unknown time'}</span>
                  </div>
                  <p>{entry?.text || ''}</p>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
      {!loading && !error ? <pre className="json-doc-viewer__content">{content}</pre> : null}
    </div>
  );
}

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
  void viewerSelectionHistory;
  void handleViewerBack;
  void maxStepUnlocked;
  void handleCaseTabNavigate;
  void activeCaseTabId;

  const documentUrl = activeDocument?.pdf ?? '';
  const isJsonDocument = useMemo(() => {
    const filename = String(activeDocument?.filename ?? '').trim().toLowerCase();
    const url = String(documentUrl || '').trim().toLowerCase();
    return filename.endsWith('.json') || url.endsWith('.json');
  }, [activeDocument?.filename, documentUrl]);

  const selectedJsonEvidence = useMemo(() => {
    if (!Array.isArray(activeDocBoxes) || activeDocBoxes.length === 0) {
      return null;
    }
    return activeDocBoxes.find((box) => box.id === activeDocBoxId) ?? activeDocBoxes[0] ?? null;
  }, [activeDocBoxId, activeDocBoxes]);

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
          {isJsonDocument ? (
            <JsonDocumentPreview
              documentUrl={documentUrl}
              selectedEvidence={selectedJsonEvidence}
              focusSignal={docFocusSignal}
            />
          ) : (
            <>
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
            </>
          )}
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
