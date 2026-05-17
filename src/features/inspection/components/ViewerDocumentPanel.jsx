import { useEffect, useMemo, useRef, useState } from 'react';
import PdfOverlayViewer from '../../../components/PdfOverlayViewer.jsx';

function JsonDocumentPreview({ documentUrl, documentName, documentMeta, selectedEvidence, focusSignal }) {
  const [content, setContent] = useState('');
  const [parsedContent, setParsedContent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const activeTranscriptEntryRef = useRef(null);
  const transcriptListRef = useRef(null);

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
    const transcriptListNode = transcriptListRef.current;
    const activeEntryNode = activeTranscriptEntryRef.current;
    if (activeTranscriptIndex >= 0 && transcriptListNode && activeEntryNode) {
      const listRect = transcriptListNode.getBoundingClientRect();
      const activeRect = activeEntryNode.getBoundingClientRect();
      const nextScrollTop = Math.max(
        0,
        transcriptListNode.scrollTop + (activeRect.top - listRect.top) - 12
      );
      transcriptListNode.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
    }
  }, [activeTranscriptIndex, focusSignal]);

  const metadataRows = useMemo(() => {
    const extractedFields = documentMeta?.extractedFields ?? documentMeta?.extracted_fields ?? {};
    const transcriptFields = parsedContent?.extracted_fields ?? parsedContent?.extractedFields ?? {};
    const transcriptMetadata = parsedContent?.metadata ?? {};
    const rows = [
      {
        label: 'Filename',
        key: 'filename',
        value: documentName
      },
      {
        label: 'Interviewee',
        key: 'interviewee',
        value:
          extractedFields.interviewee
          || transcriptFields.interviewee
          || transcriptMetadata.interviewee
          || documentMeta?.intervieweeName
          || '—'
      },
      {
        label: 'Interviewer',
        key: 'interviewer',
        value:
          extractedFields.interviewer
          || transcriptFields.interviewer
          || transcriptMetadata.interviewer
          || '—'
      },
      {
        label: 'Interview date',
        key: 'interview-date',
        value:
          extractedFields.interview_date
          || transcriptFields.interview_date
          || transcriptMetadata.interview_date
          || transcriptMetadata.date
          || documentMeta?.interviewDate
          || '—'
      },
      {
        label: 'Role',
        key: 'role',
        value:
          extractedFields.interviewee_role
          || transcriptFields.interviewee_role
          || transcriptMetadata.interviewee_role
          || documentMeta?.intervieweeRole
          || '—'
      }
    ];
    return rows.filter((row) => String(row.value || '').trim() !== '');
  }, [documentMeta, documentName, parsedContent]);

  return (
    <div className="json-doc-viewer">
      <div className="json-doc-viewer__header">
        <strong>JSON transcript preview</strong>
        <span>This document is stored as JSON rather than PDF.</span>
      </div>
      {metadataRows.length > 0 ? (
        <div className="json-doc-viewer__meta-grid">
          {metadataRows.map((row) => (
            <div key={row.label} className={`json-doc-viewer__meta-card json-doc-viewer__meta-card--${row.key}`}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {selectedEvidence ? (
        <div className="json-doc-viewer__selected">
          <div className="json-doc-viewer__evidence-label">Selected evidence</div>
          <strong>{selectedEvidence.title || selectedEvidence.category || 'Transcript evidence'}</strong>
          <span>{selectedEvidence.category || 'Relevant transcript section selected.'}</span>
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
          <div className="json-doc-viewer__transcript-list" ref={transcriptListRef}>
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
      {!loading && !error && content ? (
        <details className="json-doc-viewer__raw">
          <summary>Raw JSON payload</summary>
          <pre className="json-doc-viewer__content">{content}</pre>
        </details>
      ) : null}
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
  showDocBoxes,
  activeDocBoxes,
  activeDocBoxId,
  handleSelectDocBox,
  docPdfScrollRef,
  docFocusSignal,
  activeDocMinimapMarkers,
  setFeedbackOpen,
  onOpenDocumentAssistant
}) {
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
    if (!showDocBoxes) {
      return null;
    }
    if (!Array.isArray(activeDocBoxes) || activeDocBoxes.length === 0) {
      return null;
    }
    return activeDocBoxes.find((box) => box.id === activeDocBoxId) ?? activeDocBoxes[0] ?? null;
  }, [activeDocBoxId, activeDocBoxes, showDocBoxes]);

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
              {viewerSelectionHistory.length > 0 ? (
                <button type="button" className="btn btn-xs secondary" onClick={handleViewerBack}>
                  Back
                </button>
              ) : null}
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
              documentName={activeDocument?.filename ?? activeDocument?.name ?? ''}
              documentMeta={activeDocument}
              selectedEvidence={selectedJsonEvidence}
              focusSignal={docFocusSignal}
            />
          ) : (
            <>
              <PdfOverlayViewer
                key={activeDocument?.id || activeDocument?.pdf || 'doc-viewer'}
                pdfUrl={activeDocument?.pdf}
                boxes={activeDocBoxes}
                showBoxes={showDocBoxes && activeDocBoxes.length > 0}
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
              {showDocBoxes && activeDocMinimapMarkers.length > 0 ? (
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
      </div>
    </div>
  );
}
