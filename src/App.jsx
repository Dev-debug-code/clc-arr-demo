import { useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from './components/AppHeader.jsx';
import ConnectionBar from './components/ConnectionBar.jsx';
import StepTimeline from './components/StepTimeline.jsx';
import {
  ARR_CONNECTION,
  ARR_PROCESSING_STEPS,
  ARR_PROCESSING_MESSAGES,
  ARR_COMMENTARY,
  AUDIT_OPTIONS,
  AUDIT_CONNECTION,
  AUDIT_PROCESSING_STEPS,
  FINDING_SUMMARY,
  AUDIT_FINDINGS,
  DOCUMENT_TABS,
  REPORT_SUMMARY,
  STEP_CONFIG
} from './data/mockData.js';

const ARR_PDF_URL = '/assets/CLC_ARR_2022.pdf';

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepUnlocked, setMaxStepUnlocked] = useState(1);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [auditCards, setAuditCards] = useState(() => AUDIT_OPTIONS.map((option) => ({ ...option })));
  const [selectedQaId, setSelectedQaId] = useState(ARR_COMMENTARY[0].id);
  const [qaPulse, setQaPulse] = useState(null);
  const [docPulse, setDocPulse] = useState(null);
  const [activeDocTab, setActiveDocTab] = useState('policy');
  const [filterSeverity, setFilterSeverity] = useState([]);
  const pdfScrollRef = useRef(null);
  const commentaryRefs = useRef({});
  const docViewerRef = useRef(null);

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
    if (!qaPulse) return;
    const timer = setTimeout(() => setQaPulse(null), 1200);
    return () => clearTimeout(timer);
  }, [qaPulse]);

  useEffect(() => {
    if (!docPulse) return;
    const timer = setTimeout(() => setDocPulse(null), 1200);
    return () => clearTimeout(timer);
  }, [docPulse]);

  useEffect(() => {
    setMaxStepUnlocked((prev) => (currentStep > prev ? currentStep : prev));
  }, [currentStep]);

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

  const severityCounts = useMemo(() => FINDING_SUMMARY, []);

  const filteredFindings =
    filterSeverity.length === 0
      ? AUDIT_FINDINGS
      : AUDIT_FINDINGS.filter((finding) => filterSeverity.includes(finding.severity));

  const hiddenFindings =
    filterSeverity.length === 0 ? 0 : Math.max(AUDIT_FINDINGS.length - filteredFindings.length, 0);

  const selectedAudits = auditCards.filter((audit) => audit.selected);

  const currentDocument =
    DOCUMENT_TABS.find((doc) => doc.id === activeDocTab) ?? DOCUMENT_TABS[0] ?? null;

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

  const handleSelectQa = (qaId) => {
    setSelectedQaId(qaId);
    const qa = ARR_COMMENTARY.find((item) => item.id === qaId);

    if (pdfScrollRef.current && qa) {
      const scrollHeight = pdfScrollRef.current.scrollHeight - pdfScrollRef.current.clientHeight;
      const targetTop = (qa.boundingBox.top / 100) * pdfScrollRef.current.scrollHeight - 80;
      pdfScrollRef.current.scrollTo({
        top: Math.min(Math.max(targetTop, 0), scrollHeight),
        behavior: 'smooth'
      });
    }

    const node = commentaryRefs.current[qaId];
    if (node) {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    setQaPulse(qaId);
  };

  const handleToggleFilter = (severity) => {
    setFilterSeverity((prev) =>
      prev.includes(severity) ? prev.filter((item) => item !== severity) : [...prev, severity]
    );
  };

  const handleViewDocument = (documentId) => {
    setActiveDocTab(documentId);
    setDocPulse(documentId);
    if (docViewerRef.current) {
      docViewerRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
              <h3>ARR_2022.pdf</h3>
              <p className="panel-subtitle">Click any bounding box to jump to the commentary.</p>
            </div>
            <a href={ARR_PDF_URL} target="_blank" rel="noreferrer" className="link-button">
              Open PDF ↗
            </a>
          </div>
          <div className="pdf-frame" ref={pdfScrollRef}>
            <object className="pdf-embed" data={`${ARR_PDF_URL}#toolbar=0`} type="application/pdf">
              <p>Your browser cannot display embedded PDFs. Download instead.</p>
            </object>
            <div className="pdf-overlay">
              {ARR_COMMENTARY.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`pdf-box severity-${item.severity} ${
                    selectedQaId === item.id ? 'active' : ''
                  } ${qaPulse === item.id ? 'pulse' : ''}`}
                  style={{
                    top: `${item.boundingBox.top}%`,
                    left: `${item.boundingBox.left}%`,
                    width: `${item.boundingBox.width}%`,
                    height: `${item.boundingBox.height}%`
                  }}
                  onClick={() => handleSelectQa(item.id)}
                  aria-label={`Highlight ${item.id}`}
                >
                  {item.id}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="panel commentary-panel">
          <div className="panel-header">
            <div>
              <h3>Automated commentary</h3>
              <p className="panel-subtitle">Bidirectional sync with the PDF view.</p>
            </div>
          </div>
          <div className="commentary-list">
            {ARR_COMMENTARY.map((item) => (
              <article
                key={item.id}
                ref={(node) => {
                  commentaryRefs.current[item.id] = node;
                }}
                className={`commentary-item severity-${item.severity} ${
                  selectedQaId === item.id ? 'active' : ''
                }`}
                onClick={() => handleSelectQa(item.id)}
              >
                <div className="commentary-meta">
                  <span className="badge">{item.id}</span>
                  <span className={`severity-pill ${item.severity}`}>{item.severity}</span>
                </div>
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
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
            <div className='document-detection'>
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
                >
                  <div className="audit-card__header">
                    <h3>{audit.title}</h3>
                    {audit.arrFlags ? (
                      <span className="audit-flags">ARR flags: {audit.arrFlags.join(', ')}</span>
                    ) : (
                      <span className="audit-badge">{audit.badge}</span>
                    )}
                  </div>
                  <p>{audit.description}</p>
                  <p className="audit-stats">{audit.stats}</p>
                  <div className="audit-select-indicator">
                    {audit.selected ? 'Selected' : 'Click to include'}
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
                  {filteredFindings.map((finding) => (
                    <article key={finding.id} className={`finding-item severity-${finding.severity}`}>
                      <div className="finding-meta">
                        <span className="badge">{finding.rule}</span>
                        <span className={`severity-pill ${finding.severity}`}>{finding.severity}</span>
                      </div>
                      <h4>
                        {finding.title} — <span className="muted">{finding.matter}</span>
                      </h4>
                      <p>{finding.detail}</p>
                      <div className="finding-actions">
                        {finding.actions.policy ? (
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => handleViewDocument('policy')}
                          >
                            View in Policy
                          </button>
                        ) : null}
                        {finding.actions.matter ? (
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => handleViewDocument(`matter_${finding.actions.matter.split('_')[1]}`)}
                          >
                            View in Matter
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <div className="panel doc-panel" ref={docViewerRef}>
                <div className="doc-tabs">
                  {DOCUMENT_TABS.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      className={`doc-tab ${activeDocTab === doc.id ? 'active' : ''} severity-${doc.status} ${
                        docPulse === doc.id ? 'pulse' : ''
                      }`}
                      onClick={() => setActiveDocTab(doc.id)}
                    >
                      <span className="status-dot" />
                      {doc.label}
                    </button>
                  ))}
                </div>
                <div className="doc-details">
                  {currentDocument ? (
                    <>
                      <h3>{currentDocument.label}</h3>
                      <p className="panel-subtitle">{currentDocument.summary}</p>
                      <ul>
                        {currentDocument.highlights.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p>No document selected.</p>
                  )}
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
