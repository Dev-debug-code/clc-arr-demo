import { useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from './components/AppHeader.jsx';
import ConnectionBar from './components/ConnectionBar.jsx';
import StepTimeline from './components/StepTimeline.jsx';
import PdfOverlayViewer from './components/PdfOverlayViewer.jsx';
import {
  ARR_CONNECTION,
  ARR_PROCESSING_STEPS,
  ARR_PROCESSING_MESSAGES,
  AUDIT_OPTIONS,
  AUDIT_CONNECTION,
  AUDIT_PROCESSING_STEPS,
  REPORT_SUMMARY,
  STEP_CONFIG
} from './data/mockData.js';
import arrOverlayPlaceholder from './data/arrOverlayPlaceholder.js';
import {
  auditDocuments as caseDocuments,
  auditFindings,
  buildSummaryCards
} from './data/auditDataset.js';

const ARR_PDF_URL = 'assets/CLC_ARR_2022.pdf';

export default function App() {
  const arrOverlay = arrOverlayPlaceholder;
  const arrBoxes = arrOverlay.boxes ?? [];

  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepUnlocked, setMaxStepUnlocked] = useState(1);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [auditCards, setAuditCards] = useState(() => AUDIT_OPTIONS.map((option) => ({ ...option })));

  const [showArrBoxes, setShowArrBoxes] = useState(true);
  const [activeArrBoxId, setActiveArrBoxId] = useState(arrBoxes[0]?.id ?? null);

  const [docPulse, setDocPulse] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState([]);
  const [activeDocId, setActiveDocId] = useState(caseDocuments[0]?.id ?? '');
  const [activeDocBoxId, setActiveDocBoxId] = useState(
    caseDocuments[0]?.overlay?.boxes?.[0]?.id ?? null
  );
  const [showDocBoxes, setShowDocBoxes] = useState(true);
  const [activeFindingId, setActiveFindingId] = useState(null);

  const commentaryRefs = useRef({});
  const docViewerRef = useRef(null);
  const docPdfScrollRef = useRef(null);
  const findingRefs = useRef({});

  useEffect(() => {
    if (!analysisRunning || currentStep !== 2) {
      return;
    }

    if (analysisProgress >= 100) {
      const timeout = setTimeout(() => {
        setAnalysisRunning(false);
        setCurrentStep(3);
      }, 500);
      return () => clearTimeout(timeout);
    }

    const timer = setTimeout(() => {
      setAnalysisProgress((prev) => Math.min(100, prev + 12 + Math.random() * 12));
    }, 850);

    return () => clearTimeout(timer);
  }, [analysisRunning, analysisProgress, currentStep]);

  useEffect(() => {
    if (!auditRunning || currentStep !== 5) {
      return;
    }

    if (auditProgress >= 100) {
      const timeout = setTimeout(() => {
        setAuditRunning(false);
        setCurrentStep(6);
      }, 700);
      return () => clearTimeout(timeout);
    }

    const timer = setTimeout(() => {
      setAuditProgress((prev) => Math.min(100, prev + 14));
    }, 900);

    return () => clearTimeout(timer);
  }, [auditRunning, auditProgress, currentStep]);

  useEffect(() => {
    if (currentStep !== 2 && analysisRunning) {
      setAnalysisRunning(false);
      setAnalysisProgress(0);
    }
    if (currentStep !== 5 && auditRunning) {
      setAuditRunning(false);
      setAuditProgress(0);
    }
  }, [currentStep, analysisRunning, auditRunning]);

  useEffect(() => {
    if (!docPulse) return;
    const timer = setTimeout(() => setDocPulse(null), 1200);
    return () => clearTimeout(timer);
  }, [docPulse]);

  useEffect(() => {
    setMaxStepUnlocked((prev) => (currentStep > prev ? currentStep : prev));
  }, [currentStep]);

  const documentsById = useMemo(() => {
    const entries = caseDocuments.map((doc) => [doc.id, doc]);
    return new Map(entries);
  }, []);

  const findingByDocAndBox = useMemo(() => {
    const map = new Map();
    auditFindings.forEach((finding) => {
      if (finding.documentId && finding.boxId) {
        map.set(`${finding.documentId}:${finding.boxId}`, finding);
      }
    });
    return map;
  }, []);

  const activeDocument = documentsById.get(activeDocId) ?? caseDocuments[0] ?? null;
  const activeDocBoxes = activeDocument?.overlay?.boxes ?? [];

  useEffect(() => {
    const doc = documentsById.get(activeDocId);
    if (!doc) return;
    const fallbackBox = doc.overlay?.boxes?.[0]?.id ?? null;
    if (!doc.overlay?.boxes?.some((box) => box.id === activeDocBoxId)) {
      setActiveDocBoxId(fallbackBox);
    }
  }, [activeDocId, documentsById, activeDocBoxId]);

  const analysisStageIndex = Math.min(
    ARR_PROCESSING_STEPS.length - 1,
    Math.floor((analysisProgress / 100) * ARR_PROCESSING_STEPS.length)
  );

  const analysisMessage =
    ARR_PROCESSING_MESSAGES[Math.min(ARR_PROCESSING_MESSAGES.length - 1, analysisStageIndex)] ??
    ARR_PROCESSING_MESSAGES[0];

  const auditStageIndex = Math.min(
    AUDIT_PROCESSING_STEPS.length - 1,
    Math.floor((auditProgress / 100) * AUDIT_PROCESSING_STEPS.length)
  );

  const severityCounts = useMemo(() => buildSummaryCards(), []);

  const filteredFindings =
    filterSeverity.length === 0
      ? auditFindings
      : auditFindings.filter((finding) => filterSeverity.includes(finding.severity));

  const hiddenFindings =
    filterSeverity.length === 0 ? 0 : Math.max(auditFindings.length - filteredFindings.length, 0);

  const selectedAudits = auditCards.filter((audit) => audit.selected);

  useEffect(() => {
    if (filteredFindings.length === 0) {
      setActiveFindingId(null);
      return;
    }
    if (!filteredFindings.some((finding) => finding.id === activeFindingId)) {
      setActiveFindingId(filteredFindings[0].id);
    }
  }, [filteredFindings, activeFindingId]);

  const handleNavigate = (targetStep) => {
    if (targetStep <= maxStepUnlocked) {
      setCurrentStep(targetStep);
    }
  };

  const handleAnalyzeClick = () => {
    setAnalysisProgress(5);
    setAnalysisRunning(true);
    setCurrentStep(2);
  };

  const handleRunAuditsClick = () => {
    if (selectedAudits.length === 0) return;
    setAuditProgress(12);
    setAuditRunning(true);
    setCurrentStep(5);
  };

  const toggleAuditSelection = (auditId) => {
    setAuditCards((prev) =>
      prev.map((audit) => (audit.id === auditId ? { ...audit, selected: !audit.selected } : audit))
    );
  };

  const handleSelectQa = (boxId) => {
    setActiveArrBoxId(boxId);
    const node = commentaryRefs.current[boxId];
    if (node) {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const handleToggleFilter = (severity) => {
    setFilterSeverity((prev) =>
      prev.includes(severity) ? prev.filter((item) => item !== severity) : [...prev, severity]
    );
  };

  const handleSelectDocTab = (docId) => {
    setActiveDocId(docId);
    const doc = documentsById.get(docId);
    setActiveDocBoxId(doc?.overlay?.boxes?.[0]?.id ?? null);
    const firstFinding = auditFindings.find((finding) => finding.documentId === docId);
    setActiveFindingId(firstFinding?.id ?? null);
  };

  const handleViewDocument = (documentId, boxId, findingId) => {
    setActiveDocId(documentId);
    const doc = documentsById.get(documentId);
    const fallbackBox = boxId ?? doc?.overlay?.boxes?.[0]?.id ?? null;
    setActiveDocBoxId(fallbackBox);
    const lookupKey = `${documentId}:${fallbackBox}`;
    const resolvedFinding = findingId
      ? auditFindings.find((item) => item.id === findingId)
      : findingByDocAndBox.get(lookupKey);
    setActiveFindingId(resolvedFinding?.id ?? null);
    if (resolvedFinding?.id && findingRefs.current[resolvedFinding.id]) {
      findingRefs.current[resolvedFinding.id].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    setDocPulse(documentId);
    if (docViewerRef.current) {
      docViewerRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  const handleSelectDocBox = (boxId) => {
    setActiveDocBoxId(boxId);
    const key = `${activeDocId}:${boxId}`;
    const match = findingByDocAndBox.get(key);
    if (match) {
      setActiveFindingId(match.id);
      if (findingRefs.current[match.id]) {
        findingRefs.current[match.id].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  };

  const renderProgressSteps = (steps, stageIndex) => (
    <div className="progress-steps">
      {steps.map((label, index) => {
        const status = index < stageIndex ? 'completed' : index === stageIndex ? 'active' : '';
        return (
          <div key={label} className={`progress-step ${status}`}>
            <span className="progress-step-icon">
              {status === 'completed' ? '✓' : status === 'active' ? '⟳' : '○'}
            </span>
            {label}
          </div>
        );
      })}
    </div>
  );

  const renderArrResults = () => (
    <div className="stage-card">
      <ConnectionBar
        icon={ARR_CONNECTION.icon}
        status={ARR_CONNECTION.status}
        path={ARR_CONNECTION.path}
        lastSynced={ARR_CONNECTION.lastSynced}
      />
      <div className="split-view">
        <div className="panel pdf-panel">
          <div className="panel-header">
            <div>
              <h3>{arrOverlay.source.displayName}</h3>
              <p className="panel-subtitle">{arrOverlay.source.summary}</p>
            </div>
            <div className="overlay-controls">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showArrBoxes}
                  onChange={(event) => setShowArrBoxes(event.target.checked)}
                />
                <span>Show highlights</span>
              </label>
              <a href={ARR_PDF_URL} target="_blank" rel="noreferrer" className="link-button">
                Open PDF ↗
              </a>
            </div>
          </div>
          <div className="pdf-overlay-panel">
            <PdfOverlayViewer
              pdfUrl={ARR_PDF_URL}
              boxes={arrBoxes}
              showBoxes={showArrBoxes}
              activeBoxId={activeArrBoxId}
              onSelectBox={handleSelectQa}
            />
          </div>
        </div>
        <div className="panel commentary-panel">
          <div className="panel-header">
            <div>
              <h3>Automated commentary</h3>
              <p className="panel-subtitle">Bidirectional sync with the PDF view.</p>
            </div>
          </div>
          {Array.isArray(arrOverlay.insights) && arrOverlay.insights.length > 0 ? (
            <div className="insights-card">
              <h4>ARR Insights</h4>
              <ul>
                {arrOverlay.insights.map((insight, index) => (
                  <li key={`insight-${index}`}>{insight}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="commentary-list">
            {arrBoxes.map((item) => (
              <article
                key={item.id}
                ref={(node) => {
                  commentaryRefs.current[item.id] = node;
                }}
                className={`commentary-item severity-${item.severity} ${
                  activeArrBoxId === item.id ? 'active' : ''
                }`}
                onClick={() => handleSelectQa(item.id)}
              >
                <div className="commentary-meta">
                  <span className="badge">{item.id}</span>
                  <span className={`severity-pill ${item.severity}`}>{item.severity}</span>
                </div>
                <h4>{item.title}</h4>
                <p>{item.details}</p>
                <button type="button" className="link-button ghost">
                  Click to view in PDF
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
      <div className="action-bar">
        <button type="button" className="btn ghost">
          Export Summary
        </button>
        <button type="button" className="btn primary" onClick={() => setCurrentStep(4)}>
          Run Compliance Audits →
        </button>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="stage-card">
            <ConnectionBar
              icon={ARR_CONNECTION.icon}
              status={ARR_CONNECTION.status}
              path={ARR_CONNECTION.path}
              lastSynced={ARR_CONNECTION.lastSynced}
            />
            <div className="document-detection">
              <div className="document-icon">📋</div>
              <h3>{ARR_CONNECTION.document.name}</h3>
              <p className="document-filename">{ARR_CONNECTION.document.filename}</p>
              <p className="document-meta">
                {ARR_CONNECTION.document.questions} questions • Last updated {ARR_CONNECTION.document.updated}
              </p>
              <button type="button" className="btn primary" onClick={handleAnalyzeClick}>
                🔍 Analyze ARR
              </button>
              <p className="document-hint">{ARR_CONNECTION.description}</p>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="stage-card processing">
            <div className="processing-icon">📊</div>
            <h2>Analyzing Annual Regulatory Return</h2>
            <p className="panel-subtitle">Extracting responses and identifying risk indicators…</p>
            <div className="progress-bar-wrapper">
              <div className="progress-bar-fill" style={{ width: `${analysisProgress}%` }} />
            </div>
            <div className="progress-status">{analysisMessage}</div>
            {renderProgressSteps(ARR_PROCESSING_STEPS, analysisStageIndex)}
          </div>
        );
      case 3:
        return renderArrResults();
      case 4:
        return (
          <div className="stage-card">
            <ConnectionBar
              icon={AUDIT_CONNECTION.icon}
              status={AUDIT_CONNECTION.status}
              path={AUDIT_CONNECTION.path}
              lastSynced={AUDIT_CONNECTION.lastSynced}
              meta={AUDIT_CONNECTION.meta}
            />
            <div className="alert-banner warning">
              ARR Analysis Identified Risk Areas • Pre-selecting recommended audits.
            </div>
            <div className="audit-grid">
              {auditCards.map((audit) => (
                <button
                  key={audit.id}
                  type="button"
                  className={`audit-card ${audit.selected ? 'selected' : ''}`}
                  onClick={() => toggleAuditSelection(audit.id)}
                  aria-pressed={audit.selected}
                >
                  <div className="audit-card__top">
                    <div className={`audit-checkbox${audit.selected ? ' checked' : ''}`}>
                      <span>✓</span>
                    </div>
                    <div>
                      <div className="audit-card__title-row">
                        <h3>{audit.title}</h3>
                        {audit.arrFlags ? (
                          <span className="audit-flags">ARR flags: {audit.arrFlags.join(', ')}</span>
                        ) : (
                          <span className="audit-badge">{audit.badge}</span>
                        )}
                      </div>
                      <p className="audit-description">{audit.description}</p>
                    </div>
                  </div>
                  <p className="audit-stats">{audit.stats}</p>
                  <div className="audit-select-indicator">
                    {audit.selected ? 'Ready to run' : 'Select to include'}
                  </div>
                </button>
              ))}
            </div>
            <div className="action-bar">
              <button type="button" className="btn secondary" disabled={selectedAudits.length === 0}>
                {selectedAudits.length} audits selected
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={selectedAudits.length === 0}
                onClick={handleRunAuditsClick}
              >
                Run Selected Audits ({selectedAudits.length} workflows) →
              </button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="stage-card processing">
            <div className="processing-icon">🗂️</div>
            <h2>Running Compliance Audits</h2>
            <p className="panel-subtitle">
              Checking {selectedAudits.map((audit) => audit.title).join(', ')}.
            </p>
            <div className="progress-bar-wrapper">
              <div className="progress-bar-fill" style={{ width: `${auditProgress}%` }} />
            </div>
            <div className="progress-status">
              {AUDIT_PROCESSING_STEPS[Math.min(AUDIT_PROCESSING_STEPS.length - 1, auditStageIndex)]}
            </div>
            {renderProgressSteps(AUDIT_PROCESSING_STEPS, auditStageIndex)}
          </div>
        );
      case 6:
        return (
          <div className="stage-card">
            <div className="summary-grid">
              {severityCounts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`summary-card severity-${item.id} ${
                    filterSeverity.includes(item.id) ? 'active' : ''
                  }`}
                  onClick={() => handleToggleFilter(item.id)}
                >
                  <span className="summary-label">{item.label}</span>
                  <strong className="summary-value">{item.count}</strong>
                  <span className="summary-helper">documents</span>
                </button>
              ))}
            </div>
            <div className="split-view findings-view">
              <div className="panel doc-panel" ref={docViewerRef}>
                <div className="doc-tabs">
                  {caseDocuments.map((doc) => (
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
                <div className="overlay-controls">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={showDocBoxes}
                      onChange={(event) => setShowDocBoxes(event.target.checked)}
                    />
                    <span>Show highlights</span>
                  </label>
                </div>
                <div className="pdf-overlay-panel">
                  <PdfOverlayViewer
                    pdfUrl={activeDocument?.pdf}
                    boxes={activeDocBoxes}
                    showBoxes={showDocBoxes}
                    activeBoxId={activeDocBoxId}
                    onSelectBox={handleSelectDocBox}
                    scrollRef={docPdfScrollRef}
                  />
                </div>
                <div className="doc-details">
                  {activeDocument ? (
                    <>
                      <h3>{activeDocument.label}</h3>
                      <p className="panel-subtitle">{activeDocument.filename}</p>
                      {activeDocument.findings?.length ? (
                        <ul>
                          {activeDocument.findings.map((finding) => (
                            <li key={finding.id ?? finding.title}>{finding.title}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">No issues detected in this document.</p>
                      )}
                    </>
                  ) : (
                    <p>No document selected.</p>
                  )}
                </div>
              </div>
              <div className="panel findings-panel">
                <div className="panel-header">
                  <div>
                    <h3>Findings</h3>
                    <p className="panel-subtitle">Powered by ARR-driven rule-set.</p>
                  </div>
                </div>
                {hiddenFindings > 0 ? (
                  <div className="filter-hint">{hiddenFindings} findings hidden by filter.</div>
                ) : null}
                <div className="findings-list">
                  {filteredFindings.map((finding) => {
                    const relatedDoc = documentsById.get(finding.documentId);
                    const isActive = activeFindingId === finding.id;
                    return (
                      <article
                        key={finding.id}
                        ref={(node) => {
                          findingRefs.current[finding.id] = node || null;
                        }}
                        className={`finding-item severity-${finding.severity} ${isActive ? 'active' : ''}`}
                      >
                        <div className="finding-meta">
                          <span className="badge">{finding.id}</span>
                          <span className={`severity-pill ${finding.severity}`}>{finding.severity}</span>
                        </div>
                        <h4>
                          {finding.title} — <span className="muted">{relatedDoc?.label ?? 'Document'}</span>
                        </h4>
                        <p>{finding.detail || 'See linked document for further detail.'}</p>
                        <div className="finding-actions">
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => {
                              setActiveFindingId(finding.id);
                              handleViewDocument(finding.documentId, finding.boxId, finding.id);
                            }}
                          >
                            View in Document
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="action-bar">
              <button type="button" className="btn ghost" onClick={() => setCurrentStep(3)}>
                ← Back to ARR
              </button>
              <button type="button" className="btn primary" onClick={() => setCurrentStep(7)}>
                Export Full Report
              </button>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="stage-card success">
            <div className="success-icon">✅</div>
            <h2>Report Ready</h2>
            <p className="panel-subtitle">ARR analysis, audits, and remediation steps compiled.</p>
            <div className="report-card">
              <div>
                <h3>{REPORT_SUMMARY.filename}</h3>
                <p className="panel-subtitle">
                  {REPORT_SUMMARY.pages} pages • {REPORT_SUMMARY.size}
                </p>
              </div>
              <ul>
                {REPORT_SUMMARY.sections.map((section) => (
                  <li key={section}>{section}</li>
                ))}
              </ul>
            </div>
            <div className="action-bar">
              <button type="button" className="btn primary">
                Download PDF
              </button>
              <button type="button" className="btn secondary">
                Email Report
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="arr-app-shell">
      <AppHeader currentStep={currentStep} maxStepUnlocked={maxStepUnlocked} onNavigate={handleNavigate} />
      <main className="workspace-main">
        <StepTimeline steps={STEP_CONFIG} currentStep={currentStep} />
        {renderStepContent()}
      </main>
    </div>
  );
}
