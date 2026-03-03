import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AppHeader from './components/AppHeader.jsx';
import StepTimeline from './components/StepTimeline.jsx';
import PdfOverlayViewer from './components/PdfOverlayViewer.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { getFirebaseAuth } from './config/firebase.js';
import { auditDocuments, auditFindings } from './data/auditDataset.js';
import { upsertUserProfile } from './services/userProfile.js';
import {
  createCaseRecord,
  listCases,
  loadCaseWorkspaceData,
  persistContextNote,
  persistDocumentNote,
  persistFindingDecision,
  persistFindingNote,
  persistGenerateFindingsEvent,
  persistUploadItem
} from './services/caseData.js';

const STAGE_TARGET_DURATION_MS = 5000;
const ANALYSIS_TICK_INTERVAL_MS = 1500;

const computeProgressIncrement = (duration, interval) => {
  const stepCount = Math.max(Math.round(duration / interval), 1);
  return 100 / stepCount;
};

const ANALYSIS_PROGRESS_INCREMENT = computeProgressIncrement(
  STAGE_TARGET_DURATION_MS,
  ANALYSIS_TICK_INTERVAL_MS
);

const CASE_META = {
  practiceName: 'Hartley & Partners Solicitors',
  caseId: 'CLC-12458',
  owner: 'Wayne Bradley',
  started: '12 Feb 2026',
  riskLevel: 'Medium',
  previousInspection: 'March 2023',
  holp: 'Sarah Chen',
  hofa: 'James Wright'
};

const STEP_DOCUMENTS = 1;
const STEP_PROCESSING = 2;
const STEP_OVERVIEW = 3;
const STEP_VIEWER = 4;
const STEP_REPORT = 5;
const STEP_HISTORY = 6;
const INSPECTION_LINEAR_FINAL_STEP = STEP_REPORT;

const WORKFLOW_STEP_CONFIG = [
  { id: 1, title: 'Case Dashboard', subtitle: 'Open an inspection case' },
  { id: 2, title: 'Create Case', subtitle: 'Set up case details and focus areas' },
  { id: 3, title: 'Documents', subtitle: 'Upload, classify and verify documents' },
  { id: 4, title: 'AI Processing', subtitle: 'Process and classify uploaded evidence' },
  { id: 5, title: 'Overview', subtitle: 'Review findings and leads' },
  { id: 6, title: 'Document Viewer', subtitle: 'Inspect evidence and annotate' },
  { id: 7, title: 'Report', subtitle: 'Review and export output' }
];

const CASE_TABS = [
  { id: 'overview', label: 'Overview', step: STEP_OVERVIEW },
  { id: 'documents', label: 'Documents', step: STEP_DOCUMENTS },
  { id: 'history', label: 'History', step: STEP_HISTORY },
  { id: 'report', label: 'Report', step: STEP_REPORT }
];

const AI_PROCESSING_STEPS = [
  'Classifying uploaded documents',
  'Extracting structured evidence',
  'Running compliance checks',
  'Linking findings to source passages',
  'Building overview workspace'
];

const AI_PROCESSING_MESSAGES = [
  'Classifying documents and validating metadata...',
  'Extracting policy clauses, dates and parties...',
  'Running compliance checks across assessed code areas...',
  'Linking evidence highlights to findings and leads...',
  'Preparing overview and reviewer actions...'
];

const INITIAL_HISTORY_ITEMS = [];

const DOCUMENT_PHASE_OPTIONS = [
  { id: 'upload', label: 'Phase 1: Upload & Verify' },
  { id: 'manage', label: 'Phase 2: Ongoing Management' }
];

const INITIAL_UPLOAD_ITEMS = [
  {
    id: 'up1',
    name: 'Updated sanctions evidence.pdf',
    status: 'queued',
    classification: 'Unknown',
    parties: 'Firm',
    confidence: 'low',
    summary:
      'Potential mismatch between sanctions declaration timing and supporting document chronology.'
  },
  {
    id: 'up2',
    name: 'AML refresher training record.pdf',
    status: 'verified',
    classification: 'Interview Transcript',
    parties: 'J. Smith (MLRO)',
    confidence: 'medium',
    summary:
      'Interview transcript indicates strong supervision controls and periodic compliance refresh activity.'
  }
];

const REVIEW_REASON_OPTIONS = [
  { value: 'evidence_exists_elsewhere', label: 'Evidence exists elsewhere' },
  { value: 'policy_updated', label: 'Policy updated' },
  { value: 'different_context', label: 'Different context' },
  { value: 'system_error', label: 'System error' },
  { value: 'other', label: 'Other' }
];

const OBSERVATION_SOURCE_OPTIONS = [
  'On-site visit',
  'Interview',
  'Phone call',
  'Email',
  'Other'
];

const FINDING_REQUIREMENT_OPTIONS = [
  'S3.2.1 Practice-wide risk assessment',
  'S3.5.2 Source of funds checks',
  'S3.8.1 Ongoing monitoring',
  'AC2.1 Client account controls'
];

const FOCUS_AREA_OPTIONS = [
  { id: 'aml', label: 'Anti-Money Laundering & CTF' },
  { id: 'accounts', label: 'Accounts Code' },
  { id: 'lenders', label: 'Acting for Lenders / Mortgage Fraud Prevention' },
  { id: 'insurance', label: 'Ancillary Insurance Intermediaries' },
  { id: 'business', label: 'Business Arrangements' },
  { id: 'client-care', label: 'Client Care & Terms of Engagement' },
  { id: 'complaints', label: 'Complaints Code' },
  { id: 'conflicts', label: 'Conflicts of Interest' },
  { id: 'cpd', label: 'CPD (Ongoing Competence)' },
  { id: 'non-authorised', label: 'Dealing with Non-Authorised Persons' },
  { id: 'disclosure', label: 'Disclosure of Profits & Advantage' },
  { id: 'equality', label: 'Equality Code' },
  { id: 'abs', label: 'Licensed Body (ABS) Code' },
  { id: 'management', label: 'Management & Supervision' },
  { id: 'notification', label: 'Notification Code' },
  { id: 'pii', label: 'Professional Indemnity Insurance' },
  { id: 'recognised', label: 'Recognised Body Code' },
  { id: 'transaction', label: 'Transaction Files' },
  { id: 'undertakings', label: 'Undertakings' }
];

const AML_DESK_REVIEW_PRESET = ['aml', 'accounts', 'lenders', 'client-care', 'management'];

const REGGIE_SUGGESTIONS = [
  'Source of funds documentation',
  'What did the MLRO say about training?',
  'Cross-reference bank statements',
  'Overseas transactions'
];

const RECURRING_FINDING_IDS = new Set(['CRIT-003', 'WARN-002']);

const COMPLIANCE_CODE_AREAS = [
  { id: 'aml', name: 'Anti-Money Laundering & CTF', met: '6/9', attention: 3, goodPractice: 1, lead: 1 },
  { id: 'client-care', name: 'Client Care & Terms of Engagement', met: '3/6', attention: 3 },
  { id: 'accounts', name: 'Accounts Code', met: '5/6', attention: 1 },
  { id: 'management', name: 'Management & Supervision', met: '4/5', attention: 1 },
  { id: 'undertakings', name: 'Undertakings', met: '4/4', goodPractice: 1, complete: true },
  { id: 'complaints', name: 'Complaints Code', met: '2/2', complete: true }
];

const NOT_ASSESSED_AREAS = ['Insurance Distribution', 'Acting for Lenders', 'Consumer Duty'];
const VIEWER_CODE_AREA_FILTERS = [
  { id: 'all', label: 'All code areas' },
  ...FOCUS_AREA_OPTIONS.map((area) => ({ id: area.id, label: area.label }))
];

const CODE_AREA_REQUIREMENT_SAMPLES = {
  aml: [
    { id: 'aml-1', label: 'Practice-wide risk assessment current', status: 'non_compliant' },
    { id: 'aml-2', label: 'Source of funds evidence complete', status: 'lead' },
    { id: 'aml-3', label: 'Ongoing monitoring documented', status: 'compliant' }
  ],
  'client-care': [
    { id: 'cc-1', label: 'Terms of engagement issued', status: 'compliant' },
    { id: 'cc-2', label: 'Scope communicated clearly', status: 'non_compliant' },
    { id: 'cc-3', label: 'Fees transparency evidence', status: 'lead' }
  ],
  accounts: [
    { id: 'ac-1', label: 'Client account reconciliations', status: 'compliant' },
    { id: 'ac-2', label: 'Residual balances controls', status: 'non_compliant' }
  ],
  management: [
    { id: 'mg-1', label: 'Supervision process documented', status: 'lead' },
    { id: 'mg-2', label: 'Escalation route clear', status: 'compliant' }
  ],
  undertakings: [{ id: 'un-1', label: 'Undertakings register maintained', status: 'compliant' }],
  complaints: [{ id: 'co-1', label: 'Complaints process visible to clients', status: 'compliant' }]
};

const REQUIREMENT_KEYWORDS = {
  'aml-1': ['risk assessment', 'practice-wide risk assessment', 'pwra'],
  'aml-2': ['source of funds', 'sof'],
  'aml-3': ['monitoring', 'ongoing monitoring'],
  'cc-1': ['terms of engagement', 'client care'],
  'cc-2': ['scope', 'engagement'],
  'cc-3': ['fees', 'transparency'],
  'ac-1': ['reconciliation', 'client account'],
  'ac-2': ['residual', 'balance'],
  'mg-1': ['supervision', 'mlro'],
  'mg-2': ['escalation', 'governance'],
  'un-1': ['undertaking'],
  'co-1': ['complaint', 'complaints']
};

const CODE_AREA_KEYWORDS = {
  aml: [
    'aml',
    'money laundering',
    'source of funds',
    'suspicious activity',
    'sar',
    'sanctions',
    'pep',
    'risk assessment',
    'ctf'
  ],
  'client-care': ['client care', 'terms of engagement', 'engagement letter', 'client communication'],
  complaints: ['complaint', 'complaints', 'ombudsman'],
  management: ['management', 'supervision', 'mlro', 'governance', 'training'],
  accounts: ['accounts code', 'client account', 'reconciliation', 'residual balance', 'ledger'],
  undertakings: ['undertaking', 'undertakings']
};

const CODE_AREA_ALIASES = {
  aml: 'aml',
  'aml ctf': 'aml',
  'anti money laundering': 'aml',
  'anti money laundering ctf': 'aml',
  'anti-money laundering': 'aml',
  'anti-money laundering ctf': 'aml',
  'anti-money laundering & ctf': 'aml',
  complaints: 'complaints',
  'complaints code': 'complaints',
  'client care': 'client-care',
  'client care code': 'client-care',
  'terms of engagement': 'client-care',
  'client care & terms of engagement': 'client-care',
  'accounts code': 'accounts',
  accounts: 'accounts',
  'management supervision': 'management',
  'management & supervision': 'management',
  management: 'management',
  undertakings: 'undertakings'
};

const REPORT_ACTION_DEFAULTS = [
  {
    id: 'ra1',
    action: 'Update PWRA for current regulatory framework',
    codeArea: 'AML',
    deadline: '2026-02-28',
    person: ''
  },
  {
    id: 'ra2',
    action: 'Document SOF procedures for all transactions',
    codeArea: 'AML',
    deadline: '2026-02-28',
    person: ''
  },
  {
    id: 'ra3',
    action: 'Update SAR log format with outcome fields',
    codeArea: 'AML',
    deadline: '2026-02-28',
    person: ''
  },
  {
    id: 'ra4',
    action: 'Update complaints information on website',
    codeArea: 'Complaints',
    deadline: '2026-03-14',
    person: ''
  }
];

const coerceText = (value) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const toCanonicalFilenameKey = (value) => {
  const text = coerceText(value).trim().toLowerCase();
  if (!text) return '';
  const base = text.replace(/\\/g, '/').split('/').pop() ?? '';
  const stem = base.replace(/\.pdf$/i, '');
  return stem.replace(/[^a-z0-9]/g, '');
};

const buildFilenameKeySet = (values) => {
  const keys = new Set();
  values.forEach((entry) => {
    const key = toCanonicalFilenameKey(entry);
    if (key) {
      keys.add(key);
    }
  });
  return keys;
};

const buildDocumentLookupKeys = (documentRow) =>
  buildFilenameKeySet([
    documentRow?.id,
    documentRow?.label,
    documentRow?.name,
    documentRow?.filename,
    documentRow?.pdf
  ]);

const buildUploadLookupKeys = (uploadItem) =>
  buildFilenameKeySet([uploadItem?.name, uploadItem?.filename]);

const createVirtualDocumentFromUpload = (uploadItem) => {
  const filename = coerceText(uploadItem?.filename || uploadItem?.name).trim();
  const stem = filename ? filename.replace(/\.pdf$/i, '') : '';
  const fallbackId = `upload-${toCanonicalFilenameKey(filename || String(Date.now()))}`;
  const id = stem || fallbackId;
  return {
    id,
    label: stem || filename || 'Uploaded document',
    name: filename || stem || 'Uploaded document',
    filename: filename || `${id}.pdf`,
    classification: coerceText(uploadItem?.classification) || 'Unknown',
    parties: coerceText(uploadItem?.parties) || 'Firm',
    confidence: coerceText(uploadItem?.confidence) || 'low',
    status: coerceText(uploadItem?.status) || 'queued',
    summary: coerceText(uploadItem?.summary),
    uploadedOn: coerceText(uploadItem?.addedOn),
    severity: 'pass',
    pdf: filename ? `assets/case-files/${filename}` : undefined,
    overlay: {
      boxes: []
    }
  };
};

const inferFindingCodeArea = (finding) => {
  const referenceText =
    typeof finding?.reference === 'string'
      ? finding.reference
      : typeof finding?.reference === 'object' && finding?.reference
        ? [
            finding.reference.file,
            finding.reference.section,
            finding.reference.text
          ]
            .filter(Boolean)
            .join(' ')
        : '';

  const sourceText =
    typeof finding?.source === 'object' && finding?.source
      ? [
          finding.source.file,
          finding.source.section,
          finding.source.text
        ]
          .filter(Boolean)
          .join(' ')
      : '';

  const haystack = [
    finding?.codeArea,
    finding?.code_area,
    finding?.title,
    finding?.detail,
    finding?.documentId,
    finding?.boxId,
    sourceText,
    referenceText
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack) return '';
  if (haystack.includes('complaint')) return 'complaints';
  if (haystack.includes('undertaking')) return 'undertakings';
  if (haystack.includes('client care') || haystack.includes('engagement')) return 'client-care';
  if (
    haystack.includes('account') ||
    haystack.includes('reconciliation') ||
    haystack.includes('ledger')
  ) {
    return 'accounts';
  }
  if (haystack.includes('management') || haystack.includes('supervision')) return 'management';
  if (
    haystack.includes('aml') ||
    haystack.includes('money laundering') ||
    haystack.includes('ctf') ||
    haystack.includes('source of funds') ||
    haystack.includes('risk assessment') ||
    haystack.includes('sanction') ||
    haystack.includes('pep') ||
    haystack.includes('cdd') ||
    haystack.includes('identity verification') ||
    haystack.includes('passport') ||
    haystack.includes('giftor')
  ) {
    return 'aml';
  }
  return 'aml';
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatShortDisplayDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  return String(value);
};

const suggestClassificationFromFilename = (filename) => {
  const name = String(filename ?? '').toLowerCase();
  if (!name) return 'Other';
  if (name.includes('interview') || name.includes('mlro')) return 'Interview Transcript';
  if (name.includes('bank') || name.includes('statement')) return 'Bank Statement';
  if (name.includes('complaint')) return 'Complaints Procedure';
  if (name.includes('source') || name.includes('fund')) return 'Source of Funds Declaration';
  if (name.includes('policy') || name.includes('aml')) return 'AML Policy';
  if (name.includes('training')) return 'Training Register';
  if (name.includes('cdd')) return 'CDD Records';
  return 'Other';
};

const createPartyRow = () => ({
  id: `party-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  role: ''
});

const formatRiskLevelLabel = (value) => {
  if (!value) return 'Not assessed';
  if (value === 'not-assessed') return 'Not assessed';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const extractIdleDays = (lastActivityValue) => {
  if (typeof lastActivityValue !== 'string') return 0;
  const dayMatch = lastActivityValue.match(/(\d+)\s*day/i);
  if (!dayMatch) return 0;
  const days = Number.parseInt(dayMatch[1], 10);
  return Number.isFinite(days) ? days : 0;
};

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const gateConfig = useMemo(() => {
    const heading = import.meta.env.VITE_ACCESS_GATE_HEADING ?? 'CLC Inspection Tool';
    const supporting = import.meta.env.VITE_ACCESS_GATE_SUPPORTING ?? '';
    return { heading, supporting };
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        upsertUserProfile(user).catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to upsert user profile', error);
        });
      }
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(getFirebaseAuth());
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to sign out', error);
    }
  }, []);

  if (!isAuthReady) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <span className="auth-loading__spinner" />
        <p className="auth-loading__text">Loading workspace...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage gateConfig={gateConfig} />;
  }

  return <WorkspaceApp currentUser={currentUser} onSignOut={handleSignOut} />;
}

function WorkspaceApp({ currentUser, onSignOut }) {
  const currentUserEmail = currentUser?.email ?? '';
  const assetBase = import.meta.env.BASE_URL ?? '/';
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [firestoreDocuments, setFirestoreDocuments] = useState([]);
  const [firestoreFindings, setFirestoreFindings] = useState([]);
  const [firestoreRequirementsByCodeArea, setFirestoreRequirementsByCodeArea] = useState({});
  const [appMode, setAppMode] = useState('dashboard');
  const [teamView, setTeamView] = useState(false);
  const [inspectorOnlyView, setInspectorOnlyView] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardDateFilter, setDashboardDateFilter] = useState('All');
  const [dashboardOutcomeFilter, setDashboardOutcomeFilter] = useState('All');
  const [dashboardInspectorFilter, setDashboardInspectorFilter] = useState('All inspectors');
  const [dashboardCases, setDashboardCases] = useState([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const previousStepRef = useRef(STEP_DOCUMENTS);
  const [showCompletedCases, setShowCompletedCases] = useState(false);
  const [showRecentlyCompleted, setShowRecentlyCompleted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [contextNoteOpen, setContextNoteOpen] = useState(false);
  const [contextNoteDraft, setContextNoteDraft] = useState('');
  const [caseContextNotes, setCaseContextNotes] = useState([]);
  const [isViewerFocusMode, setIsViewerFocusMode] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepUnlocked, setMaxStepUnlocked] = useState(1);
  const [currentCaseMeta, setCurrentCaseMeta] = useState(CASE_META);
  const [isActiveCasePersisted, setIsActiveCasePersisted] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const [docPulse, setDocPulse] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState([]);
  const [severityFilterOpen, setSeverityFilterOpen] = useState(false);
  const [overviewFilterOpen, setOverviewFilterOpen] = useState(false);
  const [viewerTypeFilterOpen, setViewerTypeFilterOpen] = useState(false);
  const [viewerCodeAreaFilterOpen, setViewerCodeAreaFilterOpen] = useState(false);
  const [findingViewFilter, setFindingViewFilter] = useState('all');
  const [viewerCodeAreaFilter, setViewerCodeAreaFilter] = useState('all');
  const [activeDocId, setActiveDocId] = useState('');
  const [activeDocBoxId, setActiveDocBoxId] = useState(null);
  const [showDocBoxes, setShowDocBoxes] = useState(true);
  const [activeFindingId, setActiveFindingId] = useState(null);
  const [viewerOriginStep, setViewerOriginStep] = useState(STEP_OVERVIEW);
  const [docFocusSignal, setDocFocusSignal] = useState(0);
  const [findingDecisions, setFindingDecisions] = useState({});
  const [findingNotes, setFindingNotes] = useState({});
  const [documentNotes, setDocumentNotes] = useState({});
  const [undoDecision, setUndoDecision] = useState(null);
  const [historyItems, setHistoryItems] = useState(INITIAL_HISTORY_ITEMS);
  const [activeMenuFindingId, setActiveMenuFindingId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteTargetFindingId, setNoteTargetFindingId] = useState(null);
  const [inlineRejectFindingId, setInlineRejectFindingId] = useState(null);
  const [inlineRejectReason, setInlineRejectReason] = useState(REVIEW_REASON_OPTIONS[0].value);
  const [inlineRejectNote, setInlineRejectNote] = useState('');
  const [inlineDismissFindingId, setInlineDismissFindingId] = useState(null);
  const [inlineDismissReason, setInlineDismissReason] = useState('');
  const [inlineDismissNote, setInlineDismissNote] = useState('');
  const [deletedFindingIds, setDeletedFindingIds] = useState({});
  const [deleteFindingTargetId, setDeleteFindingTargetId] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('suggestion');
  const [feedbackText, setFeedbackText] = useState('');
  const [documentsPhase, setDocumentsPhase] = useState('upload');
  const [documentWorkspaceTab, setDocumentWorkspaceTab] = useState('findings');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docSearchScope, setDocSearchScope] = useState('document');
  const [docCrossSearchOpen, setDocCrossSearchOpen] = useState(false);
  const [docLevelNoteOpen, setDocLevelNoteOpen] = useState(false);
  const [docLevelNoteDraft, setDocLevelNoteDraft] = useState('');
  const [uploadItems, setUploadItems] = useState(INITIAL_UPLOAD_ITEMS);
  const [reggieOpen, setReggieOpen] = useState(false);
  const [reggieScope, setReggieScope] = useState('all');
  const [reggieInput, setReggieInput] = useState('');
  const [reggieMessages, setReggieMessages] = useState([]);
  const [inspectorFindings, setInspectorFindings] = useState([]);
  const [inspectorObservations, setInspectorObservations] = useState([]);
  const [reportPendingChanges, setReportPendingChanges] = useState(false);
  const [reportNeedsRegeneration, setReportNeedsRegeneration] = useState(true);
  const [reportRegenerateConfirmOpen, setReportRegenerateConfirmOpen] = useState(false);
  const [reportPendingGateOpen, setReportPendingGateOpen] = useState(false);
  const [reportDraftVersion, setReportDraftVersion] = useState(0);
  const [reprocessBannerDismissed, setReprocessBannerDismissed] = useState(false);
  const [uploadAreaCollapsed, setUploadAreaCollapsed] = useState(true);
  const [expandedUploadSummaryId, setExpandedUploadSummaryId] = useState('');
  const [expandedCodeAreaId, setExpandedCodeAreaId] = useState('aml');
  const [expandedOverviewFindingIds, setExpandedOverviewFindingIds] = useState({});
  const [expandedViewerFindingIds, setExpandedViewerFindingIds] = useState({});
  const [overviewRequirementFilter, setOverviewRequirementFilter] = useState({ areaId: '', requirementId: '' });
  const [notAssessedExpanded, setNotAssessedExpanded] = useState(false);
  const [notAssessedAreas, setNotAssessedAreas] = useState(NOT_ASSESSED_AREAS);
  const [documentsNotesExpanded, setDocumentsNotesExpanded] = useState(false);
  const [documentsLogExpanded, setDocumentsLogExpanded] = useState(false);
  const [docsMarkedForReprocess, setDocsMarkedForReprocess] = useState({});
  const [processingLog, setProcessingLog] = useState([
    { id: 'p1', detail: 'Initial processing - 14 new findings across 6 code areas', time: '09:18' },
    { id: 'p2', detail: 'Generate findings run - 3 findings generated, 0 updated', time: '09:19' }
  ]);
  const [composerModal, setComposerModal] = useState({
    open: false,
    type: 'observation',
    step: 1,
    text: '',
    sourceType: OBSERVATION_SOURCE_OPTIONS[0],
    requirement: FINDING_REQUIREMENT_OPTIONS[0],
    polarity: 'non_compliant',
    goodPractice: false,
    evidenceType: 'document',
    evidenceNote: ''
  });
  const [editedReportSections, setEditedReportSections] = useState({
    interviews: false,
    summary: false,
    attention: false,
    goodPractice: false
  });
  const [reportActionItems, setReportActionItems] = useState([]);
  const [caseSetupPracticeName, setCaseSetupPracticeName] = useState('');
  const [caseSetupLicenceNumber, setCaseSetupLicenceNumber] = useState('');
  const [caseSetupHolp, setCaseSetupHolp] = useState('');
  const [caseSetupHofa, setCaseSetupHofa] = useState('');
  const [caseSetupRiskLevel, setCaseSetupRiskLevel] = useState('not-assessed');
  const [caseSetupPreviousInspection, setCaseSetupPreviousInspection] = useState('');
  const [caseSetupConcerns, setCaseSetupConcerns] = useState('');
  const [caseSetupParties, setCaseSetupParties] = useState(() => [createPartyRow()]);
  const [caseSetupQuestionnaireFile, setCaseSetupQuestionnaireFile] = useState('');
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [caseCreateError, setCaseCreateError] = useState('');
  const [selectedFocusAreaIds, setSelectedFocusAreaIds] = useState(
    () => new Set(FOCUS_AREA_OPTIONS.map((area) => area.id))
  );

  useEffect(() => {
    if (appMode !== 'dashboard') return;
    let cancelled = false;

    const loadCases = async () => {
      setIsDashboardLoading(true);
      setDashboardError('');
      try {
        const rows = await listCases();
        if (!cancelled) {
          setDashboardCases(rows);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load dashboard cases from Firestore', error);
        if (!cancelled) {
          setDashboardError('Cannot read cases from Firestore. Check Firestore rules for this signed-in user.');
        }
      } finally {
        if (!cancelled) {
          setIsDashboardLoading(false);
        }
      }
    };

    loadCases();
    return () => {
      cancelled = true;
    };
  }, [appMode]);

  useEffect(() => {
    if (appMode !== 'inspection') return;
    const caseId = currentCaseMeta.caseId?.trim();
    if (!caseId) return;

    let cancelled = false;

    const loadWorkspace = async () => {
      setIsWorkspaceLoading(true);
      try {
        const snapshot = await loadCaseWorkspaceData(caseId);
        if (!snapshot || cancelled) return;

        setCurrentCaseMeta((prev) => ({
          ...prev,
          practiceName: snapshot.caseMetaPatch.practiceName ?? prev.practiceName,
          caseId: snapshot.caseMetaPatch.caseId ?? prev.caseId,
          owner: snapshot.caseMetaPatch.owner ?? prev.owner,
          started: snapshot.caseMetaPatch.started ?? prev.started,
          riskLevel: snapshot.caseMetaPatch.riskLevel ?? prev.riskLevel,
          previousInspection: snapshot.caseMetaPatch.previousInspection ?? prev.previousInspection,
          holp: snapshot.caseMetaPatch.holp ?? prev.holp,
          hofa: snapshot.caseMetaPatch.hofa ?? prev.hofa
        }));

        setIsActiveCasePersisted(Boolean(snapshot.caseExists));

        setFirestoreDocuments(snapshot.documents);
        setFirestoreFindings(snapshot.findings);
        setFirestoreRequirementsByCodeArea(snapshot.requirementsByCodeArea ?? {});
        setFindingDecisions(snapshot.findingDecisions);
        setFindingNotes(snapshot.findingNotes);
        setDocumentNotes(snapshot.documentNotes);
        setCaseContextNotes(snapshot.caseContextNotes);
        setOverviewRequirementFilter({ areaId: '', requirementId: '' });
        setUploadItems(snapshot.uploadItems);
        setHistoryItems(snapshot.historyItems.length > 0 ? snapshot.historyItems : INITIAL_HISTORY_ITEMS);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load case workspace from Firestore', error);
        if (!cancelled) {
          setIsActiveCasePersisted(false);
          setFirestoreRequirementsByCodeArea({});
        }
      } finally {
        if (!cancelled) {
          setIsWorkspaceLoading(false);
        }
      }
    };

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [appMode, currentCaseMeta.caseId]);

  useEffect(() => {
    if (appMode !== 'inspection') return;
    if (currentStep === STEP_OVERVIEW) {
      setFindingViewFilter('all');
      setViewerCodeAreaFilter('all');
      setFilterSeverity([]);
      setSeverityFilterOpen(false);
      setOverviewFilterOpen(false);
      setViewerTypeFilterOpen(false);
      setViewerCodeAreaFilterOpen(false);
    }
  }, [appMode, currentStep]);

  const docViewerRef = useRef(null);
  const docPdfScrollRef = useRef(null);
  const findingRefs = useRef({});
  const pendingDocBoxRef = useRef(null);
  const caseSetupFileInputRef = useRef(null);
  const documentsUploadInputRef = useRef(null);
  const findingMenuRef = useRef(null);
  const severityFilterRef = useRef(null);
  const overviewFilterRef = useRef(null);
  const viewerTypeFilterRef = useRef(null);
  const viewerCodeAreaFilterRef = useRef(null);
  const reportEditableRefs = useRef({
    interviews: [],
    summary: [],
    goodPractice: [],
    attention: []
  });

  useEffect(() => {
    if (!analysisRunning || currentStep !== STEP_PROCESSING) {
      return;
    }

    if (analysisProgress >= 100) {
      const timeout = setTimeout(() => {
        setAnalysisRunning(false);
        setMaxStepUnlocked((prev) => Math.max(prev, STEP_OVERVIEW));
        setCurrentStep(STEP_OVERVIEW);
      }, 500);
      return () => clearTimeout(timeout);
    }

    const timer = setTimeout(() => {
      const jitter = 0.9 + Math.random() * 0.2;
      setAnalysisProgress((prev) =>
        Math.min(100, prev + ANALYSIS_PROGRESS_INCREMENT * jitter)
      );
    }, ANALYSIS_TICK_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [analysisRunning, analysisProgress, currentStep]);

  useEffect(() => {
    const previousStep = previousStepRef.current;
    if (previousStep === STEP_PROCESSING && currentStep !== STEP_PROCESSING && analysisRunning) {
      setAnalysisRunning(false);
      setAnalysisProgress(0);
    }
    previousStepRef.current = currentStep;
  }, [currentStep, analysisRunning]);

  useEffect(() => {
    if (!docPulse) return;
    const timer = setTimeout(() => setDocPulse(null), 1200);
    return () => clearTimeout(timer);
  }, [docPulse]);

  useEffect(() => {
    if (!undoDecision) return;
    const timer = setTimeout(() => setUndoDecision(null), 6000);
    return () => clearTimeout(timer);
  }, [undoDecision]);

  useEffect(() => {
    if (!activeMenuFindingId) return undefined;
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.finding-menu') || target.closest('.finding-more')) return;
      setActiveMenuFindingId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [activeMenuFindingId]);

  useEffect(() => {
    if (!severityFilterOpen) return undefined;
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.filter-dropdown-wrap')) return;
      setSeverityFilterOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [severityFilterOpen]);

  useEffect(() => {
    if (!overviewFilterOpen) return undefined;
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.filter-dropdown-wrap')) return;
      setOverviewFilterOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [overviewFilterOpen]);

  useEffect(() => {
    if (!viewerTypeFilterOpen) return undefined;
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.filter-dropdown-wrap')) return;
      setViewerTypeFilterOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [viewerTypeFilterOpen]);

  useEffect(() => {
    if (!viewerCodeAreaFilterOpen) return undefined;
    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.filter-dropdown-wrap')) return;
      setViewerCodeAreaFilterOpen(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [viewerCodeAreaFilterOpen]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      setActiveMenuFindingId(null);
      setNoteTargetFindingId(null);
      setInlineRejectFindingId(null);
      setInlineDismissFindingId(null);
      setFeedbackOpen(false);
      setContextNoteOpen(false);
      setDocLevelNoteOpen(false);
      setDocCrossSearchOpen(false);
      setSeverityFilterOpen(false);
      setOverviewFilterOpen(false);
      setViewerTypeFilterOpen(false);
      setViewerCodeAreaFilterOpen(false);
      setReportPendingChanges(false);
      setReportPendingGateOpen(false);
      setReportRegenerateConfirmOpen(false);
      setComposerModal((prev) => ({ ...prev, open: false }));
      setDeleteFindingTargetId(null);
      setReggieOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    setMaxStepUnlocked((prev) => (currentStep > prev ? currentStep : prev));
  }, [currentStep]);

  const sampleDocumentsByFilenameKey = useMemo(() => {
    const map = new Map();
    auditDocuments.forEach((documentRow) => {
      buildDocumentLookupKeys(documentRow).forEach((key) => {
        if (key && !map.has(key)) {
          map.set(key, documentRow);
        }
      });
    });
    return map;
  }, []);

  const matchedSampleDocuments = useMemo(() => {
    if (uploadItems.length === 0) {
      return [];
    }
    const matched = [];
    const seenIds = new Set();
    uploadItems.forEach((uploadItem) => {
      const uploadKeys = buildUploadLookupKeys(uploadItem);
      for (const key of uploadKeys) {
        const sampleDoc = sampleDocumentsByFilenameKey.get(key);
        if (sampleDoc && !seenIds.has(sampleDoc.id)) {
          seenIds.add(sampleDoc.id);
          matched.push(sampleDoc);
          break;
        }
      }
    });
    return matched;
  }, [uploadItems, sampleDocumentsByFilenameKey]);

  const caseDocuments = useMemo(() => {
    if (matchedSampleDocuments.length === 0) {
      const seededDocuments = [...firestoreDocuments];
      const seededFilenameKeys = new Set();
      firestoreDocuments.forEach((entry) => {
        buildDocumentLookupKeys(entry).forEach((key) => seededFilenameKeys.add(key));
      });

      uploadItems.forEach((uploadItem) => {
        const uploadKeys = buildUploadLookupKeys(uploadItem);
        const alreadyRepresented = [...uploadKeys].some((key) => seededFilenameKeys.has(key));
        if (alreadyRepresented || uploadKeys.size === 0) {
          return;
        }
        const virtualDoc = createVirtualDocumentFromUpload(uploadItem);
        seededDocuments.push(virtualDoc);
        buildDocumentLookupKeys(virtualDoc).forEach((key) => seededFilenameKeys.add(key));
      });

      return seededDocuments;
    }

    const merged = [...firestoreDocuments];
    const existingIds = new Set(
      firestoreDocuments
        .map((entry) => coerceText(entry?.id).toLowerCase())
        .filter(Boolean)
    );
    const existingFilenameKeys = new Set();
    firestoreDocuments.forEach((entry) => {
      buildDocumentLookupKeys(entry).forEach((key) => existingFilenameKeys.add(key));
    });

    matchedSampleDocuments.forEach((entry) => {
      const sampleId = coerceText(entry?.id).toLowerCase();
      const sampleKeys = buildDocumentLookupKeys(entry);
      const alreadyExistsByName = [...sampleKeys].some((key) => existingFilenameKeys.has(key));
      if (existingIds.has(sampleId) || alreadyExistsByName) {
        return;
      }
      merged.push(entry);
      existingIds.add(sampleId);
      sampleKeys.forEach((key) => existingFilenameKeys.add(key));
    });

    uploadItems.forEach((uploadItem) => {
      const uploadKeys = buildUploadLookupKeys(uploadItem);
      const alreadyRepresented = [...uploadKeys].some((key) => existingFilenameKeys.has(key));
      if (alreadyRepresented || uploadKeys.size === 0) {
        return;
      }
      const virtualDoc = createVirtualDocumentFromUpload(uploadItem);
      merged.push(virtualDoc);
      buildDocumentLookupKeys(virtualDoc).forEach((key) => existingFilenameKeys.add(key));
    });

    return merged;
  }, [firestoreDocuments, matchedSampleDocuments, uploadItems]);

  const sampleDocumentIdsInWorkspace = useMemo(() => {
    const knownSampleIds = new Set(
      auditDocuments
        .map((entry) => coerceText(entry?.id))
        .filter(Boolean)
    );
    return new Set(
      caseDocuments
        .map((entry) => coerceText(entry?.id))
        .filter((id) => knownSampleIds.has(id))
    );
  }, [caseDocuments]);

  const matchedSampleFindings = useMemo(() => {
    if (sampleDocumentIdsInWorkspace.size === 0) {
      return [];
    }
    return auditFindings.filter((finding) =>
      sampleDocumentIdsInWorkspace.has(coerceText(finding?.documentId))
    );
  }, [sampleDocumentIdsInWorkspace]);

  const baseFindings = useMemo(() => {
    if (matchedSampleFindings.length === 0) {
      return firestoreFindings.map((finding) => {
        const explicitCodeArea = coerceText(finding?.codeArea || finding?.code_area).trim();
        if (explicitCodeArea) return finding;
        return { ...finding, codeArea: inferFindingCodeArea(finding) };
      });
    }
    const merged = [];
    const seenKeys = new Set();
    const addFinding = (finding) => {
      const explicitCodeArea = coerceText(finding?.codeArea || finding?.code_area).trim();
      const normalizedFinding = explicitCodeArea
        ? finding
        : { ...finding, codeArea: inferFindingCodeArea(finding) };
      const id = coerceText(finding?.id);
      const composite = `${coerceText(normalizedFinding?.documentId)}::${coerceText(
        normalizedFinding?.boxId
      )}::${coerceText(
        normalizedFinding?.title
      )}`;
      const key = id ? `id:${id}` : `meta:${composite}`;
      if (seenKeys.has(key)) {
        return;
      }
      seenKeys.add(key);
      merged.push(normalizedFinding);
    };

    firestoreFindings.forEach(addFinding);
    matchedSampleFindings.forEach(addFinding);
    return merged;
  }, [firestoreFindings, matchedSampleFindings]);
  const requirementsByCodeArea = useMemo(() => {
    const hasFirestoreRequirements = Object.keys(firestoreRequirementsByCodeArea).length > 0;
    return hasFirestoreRequirements ? firestoreRequirementsByCodeArea : CODE_AREA_REQUIREMENT_SAMPLES;
  }, [firestoreRequirementsByCodeArea]);

  useEffect(() => {
    if (caseDocuments.length === 0) {
      setActiveDocId('');
      setActiveDocBoxId(null);
      return;
    }
    if (!activeDocId || !caseDocuments.some((entry) => entry.id === activeDocId)) {
      const firstDocWithBoxes = caseDocuments.find((entry) => (entry?.overlay?.boxes?.length ?? 0) > 0);
      const firstDoc = firstDocWithBoxes ?? caseDocuments[0];
      setActiveDocId(firstDoc.id);
      setActiveDocBoxId(firstDoc?.overlay?.boxes?.[0]?.id ?? null);
    }
  }, [activeDocId, caseDocuments]);

  const documentsById = useMemo(() => {
    const entries = caseDocuments.map((doc) => [doc.id, doc]);
    return new Map(entries);
  }, [caseDocuments]);

  const allFindings = useMemo(() => [...baseFindings, ...inspectorFindings], [baseFindings, inspectorFindings]);

  const findingByDocAndBox = useMemo(() => {
    const map = new Map();
    allFindings.forEach((finding) => {
      if (finding.documentId && finding.boxId) {
        map.set(`${finding.documentId}:${finding.boxId}`, finding);
      }
    });
    return map;
  }, [allFindings]);

  const activeDocument = documentsById.get(activeDocId) ?? caseDocuments[0] ?? null;
  const activeDocBoxes = activeDocument?.overlay?.boxes ?? [];
  const activeDocMinimapMarkers = useMemo(() => {
    const safeBoxes = activeDocBoxes.filter(
      (box) => box && typeof box === 'object' && typeof box.id === 'string'
    );
    const total = Math.max(safeBoxes.length, 1);
    return safeBoxes.map((box, index) => {
      const key = `${activeDocId}:${box.id}`;
      const finding = findingByDocAndBox.get(key);
      const severity = finding?.severity ?? 'warning';
      const topPercent = Number.isFinite(box.page)
        ? Math.min(96, Math.max(4, (box.page / 20) * 100))
        : Math.min(96, Math.max(4, ((index + 1) / (total + 1)) * 100));
      return { id: box.id, topPercent, severity };
    });
  }, [activeDocBoxes, activeDocId, findingByDocAndBox]);

  useEffect(() => {
    const doc = documentsById.get(activeDocId);
    if (!doc) return;
    const fallbackBox = doc.overlay?.boxes?.[0]?.id ?? null;
    if (!doc.overlay?.boxes?.some((box) => box.id === activeDocBoxId)) {
      setActiveDocBoxId(fallbackBox);
    }
  }, [activeDocId, documentsById, activeDocBoxId]);

  const analysisStageIndex = Math.min(
    AI_PROCESSING_STEPS.length - 1,
    Math.floor((analysisProgress / 100) * AI_PROCESSING_STEPS.length)
  );

  const analysisMessage =
    AI_PROCESSING_MESSAGES[Math.min(AI_PROCESSING_MESSAGES.length - 1, analysisStageIndex)] ??
    AI_PROCESSING_MESSAGES[0];

  const availableFindings = useMemo(
    () => allFindings.filter((finding) => !deletedFindingIds[finding.id]),
    [allFindings, deletedFindingIds]
  );

  const severityCounts = useMemo(() => {
    const counts = {
      critical: 0,
      warning: 0,
      pass: 0,
      best_practice: 0
    };

    for (const finding of availableFindings) {
      if (Object.prototype.hasOwnProperty.call(counts, finding.severity)) {
        counts[finding.severity] += 1;
      }
    }

    return [
      { id: 'critical', label: 'Non-compliant', count: counts.critical },
      { id: 'warning', label: 'Leads', count: counts.warning },
      { id: 'pass', label: 'Compliant', count: counts.pass },
      { id: 'best_practice', label: 'Good Practice', count: counts.best_practice }
    ];
  }, [availableFindings]);

  const findingEvidenceStrengthMap = {
    critical: { key: 'strong', label: 'Strong evidence' },
    warning: { key: 'indicative', label: 'Indicative' },
    best_practice: { key: 'strong', label: 'Strong evidence' },
    pass: { key: 'supported', label: 'Supported' }
  };

  const filteredFindings = availableFindings
    .filter((finding) => (filterSeverity.length === 0 ? true : filterSeverity.includes(finding.severity)))
    .filter((finding) => {
      const state = findingDecisions[finding.id] ?? 'unreviewed';
      const evidenceStrengthKey = findingEvidenceStrengthMap[finding.severity]?.key ?? 'supported';
      if (findingViewFilter === 'all') return true;
      if (findingViewFilter === 'unreviewed') return state === 'unreviewed';
      if (findingViewFilter === 'reviewed') return state !== 'unreviewed';
      if (findingViewFilter === 'leads') return finding.severity === 'warning';
      if (findingViewFilter === 'non_compliant') return finding.severity === 'critical';
      if (findingViewFilter === 'compliant') return finding.severity === 'pass';
      if (findingViewFilter === 'good_practice') return finding.severity === 'best_practice';
      if (findingViewFilter === 'inspector_added') return !finding.reference;
      if (findingViewFilter === 'strong') return evidenceStrengthKey === 'strong';
      if (findingViewFilter === 'supported') return evidenceStrengthKey === 'supported';
      if (findingViewFilter === 'indicative') return evidenceStrengthKey === 'indicative';
      return true;
    });

  const reviewedCount = availableFindings.filter((finding) => Boolean(findingDecisions[finding.id])).length;
  const pendingReviewCount = Math.max(availableFindings.length - reviewedCount, 0);
  const metRequirementsCount = useMemo(
    () =>
      Object.values(requirementsByCodeArea)
        .flat()
        .filter((entry) => entry.status === 'compliant').length,
    [requirementsByCodeArea]
  );
  const goodPracticeAreaCount = useMemo(
    () => {
      const areas = new Set();
      availableFindings.forEach((entry) => {
        if (entry.severity !== 'best_practice') return;
        const codeArea = String(entry.codeArea || entry.code_area || '')
          .trim()
          .toLowerCase();
        if (codeArea) areas.add(codeArea);
      });
      return areas.size;
    },
    [availableFindings]
  );
  const reportStale = reportNeedsRegeneration;
  const summaryCardDetailMap = useMemo(() => {
    const criticalCount = severityCounts.find((entry) => entry.id === 'critical')?.count ?? 0;
    const leadCount = severityCounts.find((entry) => entry.id === 'warning')?.count ?? 0;
    const goodPracticeCount = severityCounts.find((entry) => entry.id === 'best_practice')?.count ?? 0;
    return {
      critical:
        criticalCount > 0 || leadCount > 0
          ? `${criticalCount} critical, ${leadCount} guidance`
          : '0 critical, 0 guidance',
      warning: pendingReviewCount > 0 ? `${pendingReviewCount} awaiting judgment` : 'awaiting judgment',
      pass: metRequirementsCount > 0 ? `${metRequirementsCount} requirements confirmed` : 'none confirmed yet',
      best_practice:
        goodPracticeCount > 0
          ? `across ${Math.max(goodPracticeAreaCount, 1)} code area${goodPracticeAreaCount === 1 ? '' : 's'}`
          : 'none highlighted'
    };
  }, [goodPracticeAreaCount, metRequirementsCount, pendingReviewCount, severityCounts]);
  const severityLabelMap = {
    critical: 'Critical',
    warning: 'Lead',
    pass: 'Compliant',
    best_practice: 'Good practice'
  };
  const reportSeverityLabelMap = {
    critical: 'Critical',
    warning: 'Guidance',
    pass: 'Compliant',
    best_practice: 'Good Practice'
  };
  const activeSeverityLabels = filterSeverity.map((key) => severityLabelMap[key] ?? key);
  const textOf = (value, fallback = '') => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return fallback;
  };

  const codeAreaDisplayMap = useMemo(() => {
    const base = new Map();
    FOCUS_AREA_OPTIONS.forEach((area) => base.set(area.id, area.label));
    COMPLIANCE_CODE_AREAS.forEach((area) => base.set(area.id, area.name));
    return base;
  }, []);

  const normalizeCodeAreaId = useCallback((value) => {
    const raw = textOf(value, '').trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'all') return 'all';

    const normalized = raw.replace(/[^a-z0-9]+/g, ' ').trim();
    if (CODE_AREA_ALIASES[raw]) return CODE_AREA_ALIASES[raw];
    if (CODE_AREA_ALIASES[normalized]) return CODE_AREA_ALIASES[normalized];

    if (raw.includes('aml') || normalized.includes('money laundering') || normalized.includes('ctf')) {
      return 'aml';
    }
    if (normalized.includes('complaint')) return 'complaints';
    if (normalized.includes('client care') || normalized.includes('engagement')) return 'client-care';
    if (normalized.includes('account') || normalized.includes('reconciliation')) return 'accounts';
    if (normalized.includes('management') || normalized.includes('supervision')) return 'management';
    if (normalized.includes('undertaking')) return 'undertakings';

    if (codeAreaDisplayMap.has(raw)) return raw;
    return raw;
  }, [codeAreaDisplayMap]);

  const formatCodeAreaLabel = useCallback(
    (value) => {
      const normalized = normalizeCodeAreaId(value);
      if (!normalized) return 'General';
      if (codeAreaDisplayMap.has(normalized)) return codeAreaDisplayMap.get(normalized);
      return textOf(value, 'General');
    },
    [codeAreaDisplayMap, normalizeCodeAreaId]
  );

  const complianceCodeAreas = useMemo(() => {
    const map = new Map();

    COMPLIANCE_CODE_AREAS.forEach((area) => {
      map.set(area.id, { ...area });
    });

    Object.keys(requirementsByCodeArea).forEach((rawAreaId) => {
      const normalized = normalizeCodeAreaId(rawAreaId) || rawAreaId;
      if (!map.has(normalized)) {
        map.set(normalized, {
          id: normalized,
          name: formatCodeAreaLabel(rawAreaId),
          met: '0/0'
        });
      }
    });

    availableFindings.forEach((finding) => {
      const normalized = normalizeCodeAreaId(textOf(finding.codeArea || finding.code_area, ''));
      if (!normalized) return;
      if (!map.has(normalized)) {
        map.set(normalized, {
          id: normalized,
          name: formatCodeAreaLabel(normalized),
          met: '0/0'
        });
      }
    });

    return Array.from(map.values());
  }, [availableFindings, formatCodeAreaLabel, normalizeCodeAreaId, requirementsByCodeArea]);

  const reportGoodPracticeFindings = useMemo(
    () => availableFindings.filter((finding) => finding.severity === 'best_practice'),
    [availableFindings]
  );

  const reportAttentionFindings = useMemo(
    () => availableFindings.filter((finding) => finding.severity === 'critical' || finding.severity === 'warning'),
    [availableFindings]
  );

  const reportAppendixRows = useMemo(
    () =>
      availableFindings.map((finding, index) => ({
        id: `F-${String(index + 1).padStart(3, '0')}`,
        finding: textOf(finding.title, 'Finding'),
        severity: reportSeverityLabelMap[finding.severity] ?? 'Finding',
        codeArea: formatCodeAreaLabel(textOf(finding.codeArea || finding.code_area, 'General'))
      })),
    [availableFindings, formatCodeAreaLabel]
  );

  const reportCodeAreaSummaries = useMemo(() => {
    const grouped = new Map();
    availableFindings.forEach((finding) => {
      const key = normalizeCodeAreaId(
        textOf(finding.codeArea || finding.code_area, 'general').toLowerCase()
      ) || 'general';
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: formatCodeAreaLabel(key),
          attention: 0,
          goodPractice: 0,
          lead: 0,
          compliant: 0
        });
      }
      const entry = grouped.get(key);
      if (finding.severity === 'critical') entry.attention += 1;
      if (finding.severity === 'warning') entry.lead += 1;
      if (finding.severity === 'best_practice') entry.goodPractice += 1;
      if (finding.severity === 'pass') entry.compliant += 1;
    });
    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableFindings, formatCodeAreaLabel, normalizeCodeAreaId]);

  const reportInterviewLines = useMemo(() => {
    const fromUploads = uploadItems
      .filter((item) =>
        /interview/i.test(textOf(item.classification, '')) ||
        /interview|mlro|holp|hofa/i.test(textOf(item.parties, ''))
      )
      .slice(0, 4)
      .map((item) => `${textOf(item.parties, 'Interviewee')} — source: ${textOf(item.name, 'Interview record')}`);

    if (fromUploads.length > 0) {
      return fromUploads;
    }

    const fromObservations = inspectorObservations
      .filter((obs) => /interview/i.test(textOf(obs.sourceType, '')))
      .slice(0, 4)
      .map((obs) => `${textOf(obs.actor, 'Inspector')} interview note — ${textOf(obs.ts, 'time not recorded')}`);

    return fromObservations;
  }, [uploadItems, inspectorObservations]);

  const reportSectionDefaults = useMemo(() => {
    const total = availableFindings.length;
    const criticalCount = severityCounts.find((entry) => entry.id === 'critical')?.count ?? 0;
    const leadCount = severityCounts.find((entry) => entry.id === 'warning')?.count ?? 0;
    const compliantCount = severityCounts.find((entry) => entry.id === 'pass')?.count ?? 0;
    const goodPracticeCount = severityCounts.find((entry) => entry.id === 'best_practice')?.count ?? 0;
    const codeAreaCount = reportCodeAreaSummaries.length;
    const summary = total
      ? `Of ${total} findings across ${codeAreaCount || 1} code area${codeAreaCount === 1 ? '' : 's'}, ${compliantCount} are compliant, ${goodPracticeCount} are good practice, and ${criticalCount + leadCount} require attention.`
      : 'No findings are currently available for this case.';
    return {
      interviews:
        reportInterviewLines.length > 0
          ? reportInterviewLines
          : ['No interview records are currently linked to this case.'],
      summary: [summary],
      goodPractice:
        reportGoodPracticeFindings.length > 0
          ? reportGoodPracticeFindings.slice(0, 4).map((finding) => textOf(finding.detail, textOf(finding.title, '')))
          : ['No good practice findings are currently mapped.'],
      attention:
        reportAttentionFindings.length > 0
          ? reportAttentionFindings.slice(0, 8).map((finding) => textOf(finding.detail, textOf(finding.title, '')))
          : ['No attention findings are currently mapped.']
    };
  }, [availableFindings, severityCounts, reportCodeAreaSummaries.length, reportGoodPracticeFindings, reportAttentionFindings, reportInterviewLines]);

  const reportActionDefaults = useMemo(() => {
    const in14Days = new Date();
    in14Days.setDate(in14Days.getDate() + 14);
    const defaultDeadline = toIsoDate(in14Days);
    const generated = reportAttentionFindings.slice(0, 6).map((finding, index) => ({
      id: `ra-auto-${finding.id}`,
      action: safeText(finding.title, 'Review and resolve finding'),
      codeArea: formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General')),
      deadline: defaultDeadline,
      person: index === 0 ? (currentCaseMeta.owner || '') : ''
    }));
    return generated.length > 0 ? generated : REPORT_ACTION_DEFAULTS.map((item) => ({ ...item }));
  }, [reportAttentionFindings, formatCodeAreaLabel, currentCaseMeta.owner]);

  const reportInspectionType = useMemo(() => {
    if (uploadItems.length > 0) return 'Desk-based review';
    return 'Inspection type pending';
  }, [uploadItems.length]);

  useEffect(() => {
    if (reportActionItems.length === 0) {
      setReportActionItems(reportActionDefaults.map((item) => ({ ...item })));
    }
  }, [reportActionItems.length, reportActionDefaults]);

  const recurringFindingCount = useMemo(
    () => availableFindings.filter((finding) => RECURRING_FINDING_IDS.has(finding.id)).length,
    [availableFindings]
  );

  const currentCaseOutcome = useMemo(() => {
    const caseRow = dashboardCases.find((entry) => entry.id === currentCaseMeta.caseId);
    return caseRow?.outcome ?? 'in_progress';
  }, [dashboardCases, currentCaseMeta.caseId]);

  const historyTrendRows = useMemo(
    () =>
      reportCodeAreaSummaries.slice(0, 4).map((area) => {
        const total = area.attention + area.lead + area.goodPractice + area.compliant;
        const met = area.compliant + area.goodPractice;
        const trendLabel = area.attention > 0 ? 'Attention needed' : area.lead > 0 ? 'Monitoring' : 'Stable';
        const trendClass = area.attention > 0 ? 'rejected' : area.lead > 0 ? 'dismissed' : 'accepted';
        return {
          id: area.id,
          name: area.name,
          summary: `${met}/${Math.max(total, 1)} aligned · ${area.attention + area.lead} open`,
          trendLabel,
          trendClass
        };
      }),
    [reportCodeAreaSummaries]
  );

  const historyFindingsRows = useMemo(
    () =>
      reportAttentionFindings.slice(0, 6).map((finding) => {
        const decision = findingDecisions[finding.id] ?? 'unreviewed';
        return {
          id: finding.id,
          title: textOf(finding.title, 'Finding'),
          codeArea: formatCodeAreaLabel(textOf(finding.codeArea || finding.code_area, 'General')),
          severity: reportSeverityLabelMap[finding.severity] ?? 'Finding',
          resolution:
            decision === 'accepted'
              ? 'Accepted'
              : decision === 'rejected'
                ? 'Rejected'
                : decision === 'dismissed'
                  ? 'Dismissed'
                  : 'Open',
          recurring: RECURRING_FINDING_IDS.has(finding.id)
        };
      }),
    [reportAttentionFindings, findingDecisions, formatCodeAreaLabel]
  );

  const activeCaseTabId = useMemo(() => {
    if (currentStep === STEP_VIEWER) return null;
    if (currentStep === STEP_OVERVIEW) return 'overview';
    if (currentStep === STEP_REPORT) return 'report';
    if (currentStep === STEP_HISTORY) return 'history';
    return 'documents';
  }, [currentStep]);

  const documentRows = useMemo(() => {
    const uploadByFilenameKey = new Map();
    uploadItems.forEach((item) => {
      buildUploadLookupKeys(item).forEach((key) => {
        if (key && !uploadByFilenameKey.has(key)) {
          uploadByFilenameKey.set(key, item);
        }
      });
    });
    return caseDocuments.map((doc) => {
      const findingsForDoc = allFindings.filter((finding) => finding.documentId === doc.id);
      const unresolvedForDoc = findingsForDoc.filter((finding) => !findingDecisions[finding.id]).length;
      const uploadMatch = [...buildDocumentLookupKeys(doc)]
        .map((key) => uploadByFilenameKey.get(key))
        .find(Boolean);
      const status =
        unresolvedForDoc === 0
          ? 'verified'
          : unresolvedForDoc > 2
            ? 'attention'
            : 'reviewing';
      return {
        id: doc.id,
        label: doc.label,
        filename: doc.filename,
        classification: textOf(uploadMatch?.classification, textOf(doc.classification, 'Unclassified')),
        parties: textOf(uploadMatch?.parties, textOf(doc.parties, 'Firm')),
        confidence: textOf(uploadMatch?.confidence, textOf(doc.confidence, 'medium')),
        uploadedOn: uploadMatch?.addedOn ?? doc.uploadedOn ?? '',
        findingsCount: findingsForDoc.length,
        unresolvedForDoc,
        status
      };
    });
  }, [allFindings, caseDocuments, findingDecisions, uploadItems]);

  const filteredCrossDocResults = useMemo(() => {
    const query = docSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return allFindings
      .filter((finding) => {
        const relatedDoc = documentsById.get(finding.documentId);
        const haystack = [
          finding.title,
          finding.detail,
          relatedDoc?.label,
          finding.source?.text,
          finding.source?.section
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 20);
  }, [allFindings, docSearchQuery, documentsById]);

  const filteredInDocumentResults = useMemo(() => {
    const query = docSearchQuery.trim().toLowerCase();
    if (!query || !activeDocId) return [];
    return allFindings
      .filter((finding) => finding.documentId === activeDocId)
      .filter((finding) => {
        const haystack = [
          finding.title,
          finding.detail,
          finding.source?.text,
          finding.source?.section
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [allFindings, activeDocId, docSearchQuery]);

  const activeDocIndex = useMemo(
    () => caseDocuments.findIndex((doc) => doc.id === activeDocId),
    [activeDocId]
  );

  const formatOutcomeLabel = (outcome) => {
    const value = String(outcome || '').trim().toLowerCase();
    if (value === 'compliant') return 'Compliant';
    if (value === 'generally_compliant') return 'Generally compliant';
    if (value === 'non_compliant') return 'Non-compliant';
    return 'In progress';
  };

  const visibleDashboardCases = useMemo(() => {
    const search = dashboardSearch.trim().toLowerCase();
    return dashboardCases.filter((item) => {
      if (!search) return true;
      const haystack = `${item.practice} ${item.id}`.toLowerCase();
      return haystack.includes(search);
    })
      .filter((item) => (showCompletedCases ? true : item.progress < 100))
      .filter((item) =>
        dashboardOutcomeFilter === 'All'
          ? true
          : dashboardOutcomeFilter === 'In progress'
            ? (item.outcome ?? 'in_progress') === 'in_progress'
            : dashboardOutcomeFilter === 'Compliant'
              ? (item.outcome ?? '') === 'compliant'
              : dashboardOutcomeFilter === 'Generally compliant'
                ? (item.outcome ?? '') === 'generally_compliant'
                : dashboardOutcomeFilter === 'Non-compliant'
                  ? (item.outcome ?? '') === 'non_compliant'
                  : true
      )
      .filter((item) =>
        teamView && dashboardInspectorFilter !== 'All inspectors'
          ? item.inspector === dashboardInspectorFilter
          : true
      )
      .filter((item) =>
        dashboardDateFilter === 'All'
          ? true
          : dashboardDateFilter === 'This week'
            ? item.lastActivity.includes('hour') || item.lastActivity.includes('minute')
            : true
      );
  }, [
    dashboardCases,
    dashboardSearch,
    showCompletedCases,
    dashboardOutcomeFilter,
    teamView,
    dashboardInspectorFilter,
    dashboardDateFilter
  ]);

  const dashboardInspectorOptions = useMemo(() => {
    const values = Array.from(new Set(dashboardCases.map((item) => item.inspector).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [dashboardCases]);

  const teamActiveCaseCount = useMemo(
    () => dashboardCases.filter((item) => item.progress < 100).length,
    [dashboardCases]
  );

  const teamUnreviewedCount = useMemo(
    () => dashboardCases.reduce((total, item) => total + (item.unreviewed ?? 0), 0),
    [dashboardCases]
  );

  const teamIdleOver7DaysCount = useMemo(
    () => dashboardCases.filter((item) => extractIdleDays(item.lastActivity) > 7).length,
    [dashboardCases]
  );

  const queuedUploadCount = useMemo(
    () => uploadItems.filter((item) => item.status !== 'verified').length,
    [uploadItems]
  );

  const findingNoteCount = useMemo(() => Object.keys(findingNotes).length, [findingNotes]);
  const markedDocsCount = useMemo(
    () => Object.values(docsMarkedForReprocess).filter(Boolean).length,
    [docsMarkedForReprocess]
  );

  const pendingReprocessSummary = useMemo(() => {
    const segments = [];
    if (queuedUploadCount > 0) {
      segments.push(
        `${queuedUploadCount} queued document${queuedUploadCount === 1 ? '' : 's'}`
      );
    }
    if (findingNoteCount > 0) {
      segments.push(`${findingNoteCount} note${findingNoteCount === 1 ? '' : 's'} added`);
    }
    if (markedDocsCount > 0) {
      segments.push(`${markedDocsCount} document${markedDocsCount === 1 ? '' : 's'} marked for reprocess`);
    }
    return segments.join(', ');
  }, [queuedUploadCount, findingNoteCount, markedDocsCount]);

  const flattenedDocumentNotes = useMemo(
    () =>
      Object.entries(documentNotes)
        .flatMap(([docId, entries]) =>
          (entries ?? []).map((entry) => ({
            ...entry,
            docId,
            docLabel: documentsById.get(docId)?.label ?? docId
          }))
        )
        .sort((a, b) => (a.id < b.id ? 1 : -1)),
    [documentNotes, documentsById]
  );

  const allUploadsVerified = useMemo(
    () =>
      uploadItems.length > 0 &&
      uploadItems.every(
        (item) => item.status === 'verified' && (item.classification ?? 'Unknown') !== 'Unknown'
      ),
    [uploadItems]
  );
  const verifiedUploadCount = useMemo(
    () => uploadItems.filter((item) => item.status === 'verified').length,
    [uploadItems]
  );
  const unclassifiedUploadCount = useMemo(
    () => uploadItems.filter((item) => (item.classification ?? 'Unknown') === 'Unknown').length,
    [uploadItems]
  );
  const unverifiedUploadCount = useMemo(
    () => uploadItems.filter((item) => item.status !== 'verified').length,
    [uploadItems]
  );
  const confirmableUploadCount = useMemo(
    () =>
      uploadItems.filter(
        (item) => item.status !== 'verified' && (item.classification ?? 'Unknown') !== 'Unknown'
      ).length,
    [uploadItems]
  );

  useEffect(() => {
    if (appMode !== 'inspection' || currentStep !== STEP_DOCUMENTS) return;
    if (!uploadItems.some((item) => item.status === 'queued')) return;

    const timer = setTimeout(() => {
      let changedUploads = [];
      setUploadItems((previousItems) => {
        const nextItems = previousItems.map((item) => {
          if (item.status !== 'queued') return item;
          const nextClassification =
            textOf(item.classification, 'Unknown') === 'Unknown'
              ? suggestClassificationFromFilename(item.name)
              : item.classification;
          const nextItem = {
            ...item,
            status: 'reviewing',
            classification: nextClassification,
            confidence: item.confidence === 'high' ? 'high' : 'medium',
            summary:
              item.summary ||
              `Auto-classified from filename. Please verify and confirm before generating findings.`
          };
          changedUploads.push(nextItem);
          return nextItem;
        });
        return changedUploads.length > 0 ? nextItems : previousItems;
      });

      if (changedUploads.length === 0) return;

      setProcessingLog((previous) => [
        {
          id: `p${Date.now()}-classified`,
          detail: `${changedUploads.length} document${
            changedUploads.length === 1 ? '' : 's'
          } finished classification and now require confirmation`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...previous
      ]);
      setReportNeedsRegeneration(true);

      if (isActiveCasePersisted) {
        Promise.all(
          changedUploads.map((uploadItem) =>
            persistUploadItem({
              caseId: currentCaseMeta.caseId,
              uploadItem,
              user: currentUser
            })
          )
        ).catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to persist auto-classified uploads', error);
        });
      }
    }, 1400);

    return () => clearTimeout(timer);
  }, [
    appMode,
    currentStep,
    uploadItems,
    currentCaseMeta.caseId,
    currentUser,
    isActiveCasePersisted
  ]);

  useEffect(() => {
    setReprocessBannerDismissed(false);
  }, [pendingReprocessSummary]);

  useEffect(() => {
    if (documentWorkspaceTab !== 'findings') {
      setDocCrossSearchOpen(false);
    }
  }, [documentWorkspaceTab]);

  useEffect(() => {
    if (currentStep === STEP_DOCUMENTS) {
      setDocumentsPhase('upload');
    }
  }, [currentStep]);

  useEffect(() => {
    if (filteredFindings.length === 0) {
      setActiveFindingId(null);
      return;
    }
    if (!filteredFindings.some((finding) => finding.id === activeFindingId)) {
      setActiveFindingId(filteredFindings[0].id);
    }
  }, [filteredFindings, activeFindingId]);

  useEffect(() => {
    if (complianceCodeAreas.length === 0) return;
    if (complianceCodeAreas.some((area) => area.id === expandedCodeAreaId)) return;
    setExpandedCodeAreaId(complianceCodeAreas[0].id);
  }, [complianceCodeAreas, expandedCodeAreaId]);

  const totalSteps = INSPECTION_LINEAR_FINAL_STEP;

  const handleCaseTabNavigate = (targetStep) => {
    if (targetStep <= maxStepUnlocked) {
      setCurrentStep(targetStep);
    }
  };

  const handleOpenCase = (caseItem) => {
    const isCompleted = (caseItem?.progress ?? 0) >= 100;
    const hasReviewWork = (caseItem?.unreviewed ?? 0) > 0 || (caseItem?.leads ?? 0) > 0;
    const targetStep = isCompleted
      ? STEP_REPORT
      : hasReviewWork
        ? STEP_OVERVIEW
        : STEP_DOCUMENTS;
    setAppMode('inspection');
    setIsActiveCasePersisted(false);
    setCurrentStep(targetStep);
    setMaxStepUnlocked((prev) => Math.max(prev, totalSteps));
    setDocSearchQuery('');
    setDocCrossSearchOpen(false);
    setNoteTargetFindingId(null);
    setDocLevelNoteOpen(false);
    setFeedbackOpen(false);
    setContextNoteOpen(false);
    setFindingViewFilter('all');
    setViewerCodeAreaFilter('all');
    setFilterSeverity([]);
    setSeverityFilterOpen(false);
    setExpandedCodeAreaId('aml');
    setReportDraftVersion((prev) => prev + 1);
    setReportPendingChanges(false);
    if (targetStep === STEP_DOCUMENTS) {
      setDocumentsPhase('upload');
      setDocumentWorkspaceTab('lifecycle');
    }
    if (targetStep === STEP_OVERVIEW) {
      setDocumentWorkspaceTab('findings');
    }
    if (targetStep === STEP_REPORT) {
      setReportNeedsRegeneration(false);
    } else {
      setReportNeedsRegeneration(true);
    }
    if (caseItem) {
      setCurrentCaseMeta((prev) => ({
        ...prev,
        practiceName: caseItem.practice ?? prev.practiceName,
        caseId: caseItem.id ?? prev.caseId,
        owner: caseItem.inspector ?? prev.owner,
        riskLevel: caseItem.risk ?? prev.riskLevel
      }));
    }
  };

  const workflowTimelineStep =
    appMode === 'dashboard'
      ? 1
      : appMode === 'caseSetup'
        ? 2
        : currentStep === STEP_HISTORY
          ? 7
          : currentStep + 2;

  const setDashboardView = (nextTeamView) => {
    if (inspectorOnlyView && nextTeamView) return;
    setTeamView(nextTeamView);
    setDashboardSearch('');
    setDashboardDateFilter('All');
    setDashboardOutcomeFilter('All');
    setDashboardInspectorFilter('All inspectors');
    setShowCompletedCases(false);
  };

  const handleCreateCase = async () => {
    if (!caseSetupPracticeName.trim() || !caseSetupLicenceNumber.trim() || selectedFocusAreaIds.size === 0) {
      return;
    }
    if (isCreatingCase) return;
    setCaseCreateError('');
    const uncheckedAreas = FOCUS_AREA_OPTIONS.filter((area) => !selectedFocusAreaIds.has(area.id)).map(
      (area) => area.label
    );
    const nextCaseId = caseSetupLicenceNumber.trim();
    const nextPracticeName = caseSetupPracticeName.trim();
    const nextOwner = currentUserEmail || 'Inspector';
    const nextRiskLevel = formatRiskLevelLabel(caseSetupRiskLevel);
    const nextHolp = caseSetupHolp.trim();
    const nextHofa = caseSetupHofa.trim();
    const nextPreviousInspection = caseSetupPreviousInspection || 'N/A';

    setIsCreatingCase(true);
    try {
      await createCaseRecord({
        caseId: nextCaseId,
        practiceName: nextPracticeName,
        owner: nextOwner,
        riskLevel: nextRiskLevel,
        previousInspection: nextPreviousInspection,
        holp: nextHolp,
        hofa: nextHofa,
        user: currentUser
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to create case in Firestore', error);
      setCaseCreateError('Failed to create case in Firestore. Check write permissions in Firestore rules.');
      setIsCreatingCase(false);
      return;
    }

    const nowTs = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDeletedFindingIds({});
    setFindingDecisions({});
    setFindingNotes({});
    setDocumentNotes({});
    setCaseContextNotes([]);
    setInspectorObservations([]);
    setInspectorFindings([]);
    setReportPendingChanges(false);
    setReportNeedsRegeneration(true);
    setEditedReportSections({ interviews: false, summary: false, attention: false, goodPractice: false });
    setReportActionItems(reportActionDefaults.map((item) => ({ ...item })));
    setHistoryItems([
      {
        id: `h-${Date.now()}-created`,
        ts: nowTs,
        detail: `Case created: ${caseSetupPracticeName.trim()}`,
        actor: currentUserEmail || 'Inspector'
      },
      ...INITIAL_HISTORY_ITEMS
    ]);
    setNotAssessedAreas(uncheckedAreas);
    setCurrentCaseMeta((prev) => ({
      ...prev,
      practiceName: nextPracticeName,
      caseId: nextCaseId,
      owner: nextOwner || prev.owner,
      started: new Date().toLocaleDateString(),
      riskLevel: nextRiskLevel,
      previousInspection: nextPreviousInspection,
      holp: nextHolp || prev.holp,
      hofa: nextHofa || prev.hofa
    }));
    setDashboardCases((prev) => [
      {
        id: nextCaseId,
        practice: nextPracticeName,
        started: new Date().toLocaleDateString(),
        progress: 0,
        progressLabel: '0/0 requirements met',
        unreviewed: 0,
        leads: 0,
        goodPractice: 0,
        risk: nextRiskLevel,
        lastActivity: 'Just now',
        inspector: nextOwner,
        status: 'active'
      },
      ...prev.filter((entry) => entry.id !== nextCaseId)
    ]);
    setIsActiveCasePersisted(true);
    setCaseSetupPracticeName('');
    setCaseSetupLicenceNumber('');
    setCaseSetupHolp('');
    setCaseSetupHofa('');
    setCaseSetupRiskLevel('not-assessed');
    setCaseSetupPreviousInspection('');
    setCaseSetupConcerns('');
    setCaseSetupParties([createPartyRow()]);
    setCaseSetupQuestionnaireFile('');
    if (caseSetupFileInputRef.current) {
      caseSetupFileInputRef.current.value = '';
    }
    setSelectedFocusAreaIds(new Set(FOCUS_AREA_OPTIONS.map((area) => area.id)));
    setDocumentWorkspaceTab('lifecycle');
    setDocSearchQuery('');
    setDocCrossSearchOpen(false);
    setDocSearchScope('document');
    setFeedbackOpen(false);
    setContextNoteOpen(false);
    setNoteTargetFindingId(null);
    setInlineRejectFindingId(null);
    setDocLevelNoteOpen(false);
    setReportPendingGateOpen(false);
    setReportRegenerateConfirmOpen(false);
    setReportDraftVersion((prev) => prev + 1);
    setAppMode('inspection');
    setCurrentStep(STEP_DOCUMENTS);
    setMaxStepUnlocked((prev) => Math.max(prev, totalSteps));
    setIsCreatingCase(false);
  };

  const handleFindingDecision = (findingId, nextDecision) => {
    setInlineRejectFindingId((prev) => (prev === findingId ? null : prev));
    setNoteTargetFindingId((prev) => (prev === findingId ? null : prev));
    setInlineDismissFindingId((prev) => (prev === findingId ? null : prev));
    setReportNeedsRegeneration(true);
    setFindingDecisions((prev) => {
      const previousDecision = prev[findingId] ?? null;
      const next = { ...prev, [findingId]: nextDecision };
      if (!nextDecision) {
        delete next[findingId];
      }
      setUndoDecision({
        findingId,
        previousDecision,
        nextDecision
      });
      const targetFinding = allFindings.find((finding) => finding.id === findingId);
      if (targetFinding) {
        const decisionLabel =
          nextDecision === 'rejected'
            ? 'Rejected'
            : nextDecision === 'dismissed'
              ? 'Dismissed as lead'
              : nextDecision === null
                ? 'Cleared decision'
                : 'Accepted';
        setHistoryItems((items) => [
          {
            id: `h${Date.now()}`,
            ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            detail: `${decisionLabel}: ${targetFinding.title}`,
            actor: currentUserEmail || 'Inspector'
          },
          ...items
        ]);
      }
      return next;
    });

    if (isActiveCasePersisted) {
      persistFindingDecision({
        caseId: currentCaseMeta.caseId,
        findingId,
        decision: nextDecision,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist finding decision', error);
      });
    }
  };

  const handleRequestFindingDecision = (findingId, nextDecision) => {
    if (nextDecision === 'accepted' || nextDecision === null) {
      handleFindingDecision(findingId, nextDecision);
      return;
    }
    if (nextDecision === 'rejected') {
      setNoteTargetFindingId(null);
      setInlineDismissFindingId(null);
      setInlineRejectFindingId(findingId);
      setInlineRejectReason(REVIEW_REASON_OPTIONS[0].value);
      setInlineRejectNote('');
      setActiveMenuFindingId(null);
      return;
    }
    if (nextDecision === 'dismissed') {
      setNoteTargetFindingId(null);
      setInlineRejectFindingId(null);
      setInlineDismissFindingId(findingId);
      setInlineDismissReason('');
      setInlineDismissNote('');
      setActiveMenuFindingId(null);
      return;
    }
    setActiveMenuFindingId(null);
  };

  const handleConfirmInlineReject = (findingId) => {
    if (!inlineRejectReason) return;
    if (inlineRejectReason === 'other' && !inlineRejectNote.trim()) return;
    handleFindingDecision(findingId, 'rejected');
    setInlineRejectFindingId(null);
    setInlineRejectReason(REVIEW_REASON_OPTIONS[0].value);
    setInlineRejectNote('');
  };

  const handleOpenAddNote = (findingId, suggestedText = '') => {
    setInlineRejectFindingId(null);
    setInlineDismissFindingId(null);
    setNoteTargetFindingId(findingId);
    const existing = findingNotes[findingId];
    const existingText = typeof existing === 'string' ? existing : existing?.text ?? '';
    setNoteDraft(existingText || suggestedText);
    setActiveMenuFindingId(null);
  };

  const handleSaveFindingNote = () => {
    if (!noteTargetFindingId) return;
    const cleanNote = noteDraft.trim();
    if (!cleanNote) {
      setNoteTargetFindingId(null);
      setNoteDraft('');
      return;
    }
    setFindingNotes((prev) => ({
      ...prev,
      [noteTargetFindingId]: {
        text: cleanNote,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actor: currentUserEmail || 'Inspector'
      }
    }));
    const targetFinding = allFindings.find((finding) => finding.id === noteTargetFindingId);
    if (targetFinding) {
      setHistoryItems((items) => [
        {
          id: `h${Date.now()}`,
          ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          detail: `Note added: ${targetFinding.title}`,
          actor: currentUserEmail || 'Inspector'
        },
        ...items
      ]);
    }
    setReportNeedsRegeneration(true);

    if (isActiveCasePersisted) {
      persistFindingNote({
        caseId: currentCaseMeta.caseId,
        findingId: noteTargetFindingId,
        text: cleanNote,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist finding note', error);
      });
    }

    setNoteTargetFindingId(null);
    setNoteDraft('');
  };

  const handleConfirmInlineDismiss = (findingId) => {
    if (!inlineDismissReason) return;
    if (inlineDismissReason === 'other' && !inlineDismissNote.trim()) return;
    handleFindingDecision(findingId, 'dismissed');
    setInlineDismissFindingId(null);
    setInlineDismissReason('');
    setInlineDismissNote('');
  };

  const handleSubmitFeedback = () => {
    if (!feedbackText.trim()) {
      setFeedbackOpen(false);
      return;
    }
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: `Feedback sent (${feedbackCategory})`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);
    setFeedbackOpen(false);
    setFeedbackText('');
    setFeedbackCategory('suggestion');
  };

  const openDocumentsFilePicker = useCallback(() => {
    documentsUploadInputRef.current?.click();
  }, []);

  const buildUploadItem = useCallback(
    (filename, indexOffset = 0) => {
      const fallbackName = `uploaded-evidence-${uploadItems.length + indexOffset + 1}.pdf`;
      const resolvedName = coerceText(filename).trim() || fallbackName;
      return {
        id: `up${Date.now()}-${indexOffset}-${Math.random().toString(36).slice(2, 7)}`,
        name: resolvedName,
        filename: resolvedName,
        status: 'queued',
        classification: 'Unknown',
        parties: 'Firm',
        confidence: 'low',
        addedOn: toIsoDate(new Date()),
        summary: 'Awaiting classification and inspector verification.'
      };
    },
    [uploadItems.length]
  );

  const addUploadItems = useCallback(
    (filenames = []) => {
      const sourceNames = Array.isArray(filenames) ? filenames : [];
      const newItems =
        sourceNames.length > 0
          ? sourceNames.map((name, index) => buildUploadItem(name, index))
          : [buildUploadItem('', 0)];

      setUploadItems((prev) => [...newItems, ...prev]);
      setReportNeedsRegeneration(true);

      if (isActiveCasePersisted) {
        Promise.all(
          newItems.map((uploadItem) =>
            persistUploadItem({
              caseId: currentCaseMeta.caseId,
              uploadItem,
              user: currentUser
            })
          )
        ).catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to persist new upload item(s)', error);
        });
      }
    },
    [buildUploadItem, currentCaseMeta.caseId, currentUser, isActiveCasePersisted]
  );

  const handleUploadFileSelection = useCallback(
    (event) => {
      const files = Array.from(event.target.files ?? []).filter((file) =>
        /\.pdf$/i.test(coerceText(file?.name)) || file?.type === 'application/pdf'
      );
      if (files.length > 0) {
        addUploadItems(files.map((file) => file.name));
      }
      event.target.value = '';
    },
    [addUploadItems]
  );

  const handleUploadDrop = useCallback(
    (event) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
        /\.pdf$/i.test(coerceText(file?.name)) || file?.type === 'application/pdf'
      );
      if (files.length > 0) {
        addUploadItems(files.map((file) => file.name));
      }
    },
    [addUploadItems]
  );

  const handleUploadFieldChange = (uploadId, field, value) => {
    let updatedItem = null;
    setUploadItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== uploadId) return entry;
        const nextEntry = {
          ...entry,
          [field]: value
        };
        if (field === 'classification') {
          nextEntry.status = value === 'Unknown' ? 'queued' : entry.status === 'verified' ? 'verified' : 'classified';
        }
        updatedItem = nextEntry;
        return nextEntry;
      })
    );
    setReportNeedsRegeneration(true);
    if (isActiveCasePersisted && updatedItem) {
      persistUploadItem({
        caseId: currentCaseMeta.caseId,
        uploadItem: updatedItem,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist upload item edit', error);
      });
    }
  };

  const handleToggleUploadConfirmed = (uploadId) => {
    const target = uploadItems.find((item) => item.id === uploadId);
    if (!target) return;
    if ((target.classification ?? 'Unknown') === 'Unknown') return;

    const nextStatus = target.status === 'verified' ? 'classified' : 'verified';
    const nextItem = { ...target, status: nextStatus };
    setUploadItems((prev) =>
      prev.map((item) => (item.id === uploadId ? nextItem : item))
    );
    setProcessingLog((prev) => [
      {
        id: `p${Date.now()}-${uploadId}`,
        detail:
          nextStatus === 'verified'
            ? `Document confirmed: ${target.name}`
            : `Document unconfirmed: ${target.name}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
    setReportNeedsRegeneration(true);
    if (isActiveCasePersisted) {
      persistUploadItem({
        caseId: currentCaseMeta.caseId,
        uploadItem: nextItem,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist upload confirmation toggle', error);
      });
    }
  };

  const handleConfirmAllUploads = () => {
    const verifiedUploads = uploadItems
      .filter((item) => (item.classification ?? 'Unknown') !== 'Unknown')
      .map((item) => ({ ...item, status: 'verified' }));
    if (verifiedUploads.length === 0) return;

    setUploadItems((prev) =>
      prev.map((item) =>
        (item.classification ?? 'Unknown') === 'Unknown' ? item : { ...item, status: 'verified' }
      )
    );
    setProcessingLog((prev) => [
      {
        id: `p${Date.now()}-all`,
        detail: `${verifiedUploads.length} documents confirmed in bulk`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
    setReportNeedsRegeneration(true);
    if (isActiveCasePersisted) {
      Promise.all(
        verifiedUploads.map((uploadItem) =>
          persistUploadItem({
            caseId: currentCaseMeta.caseId,
            uploadItem,
            user: currentUser
          })
        )
      ).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist bulk upload confirmation', error);
      });
    }
  };

  const handleGenerateFindings = () => {
    if (!allUploadsVerified) return;
    setProcessingLog((prev) => [
      {
        id: `p${Date.now()}`,
        detail: 'Generate findings triggered by inspector',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
    setReportNeedsRegeneration(true);
    setDocumentWorkspaceTab('findings');
    setAnalysisProgress(8);
    setAnalysisRunning(true);
    setCurrentStep(STEP_PROCESSING);
    setMaxStepUnlocked((prev) => Math.max(prev, STEP_PROCESSING));
    if (isActiveCasePersisted) {
      persistGenerateFindingsEvent({
        caseId: currentCaseMeta.caseId,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist generate findings event', error);
      });
    }
  };

  const handleConfirmReportRegenerate = () => {
    setReportRegenerateConfirmOpen(false);
    setEditedReportSections({ interviews: false, summary: false, attention: false, goodPractice: false });
    handleRevertReportSection('summary');
    handleRevertReportSection('goodPractice');
    handleRevertReportSection('attention');
    setReportActionItems(reportActionDefaults.map((item) => ({ ...item })));
    setDocsMarkedForReprocess({});
    setReportPendingChanges(false);
    setReportNeedsRegeneration(false);
    setReportDraftVersion((prev) => prev + 1);
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: 'Report regenerated from latest findings',
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);
  };

  const handleExportReport = () => {
    const totalFindings = availableFindings.length;
    const criticalCount = severityCounts.find((entry) => entry.id === 'critical')?.count ?? 0;
    const leadCount = severityCounts.find((entry) => entry.id === 'warning')?.count ?? 0;
    const compliantCount = severityCounts.find((entry) => entry.id === 'pass')?.count ?? 0;
    const goodPracticeCount = severityCounts.find((entry) => entry.id === 'best_practice')?.count ?? 0;
    const lines = [
      'Council for Licensed Conveyancers',
      'Inspection Report',
      '',
      `Practice: ${currentCaseMeta.practiceName}`,
      `Case: ${currentCaseMeta.caseId}`,
      `Inspector: ${currentCaseMeta.owner}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Summary:',
      `- Total findings: ${totalFindings}`,
      `- Non-compliant: ${criticalCount}`,
      `- Leads: ${leadCount}`,
      `- Compliant: ${compliantCount}`,
      `- Good practice: ${goodPracticeCount}`,
      '',
      'Sections:',
      '- Practice details',
      '- Compliance summary',
      '- Areas of good practice',
      '- Areas requiring attention',
      '- Action plan'
    ];
    if (inspectorObservations.length > 0) {
      lines.push('', 'Inspector Observations:');
      inspectorObservations.slice(0, 8).forEach((obs) => {
        lines.push(`- [${obs.requirement}] ${obs.text} (${obs.sourceType}, ${obs.ts})`);
      });
    }
    if (caseContextNotes.length > 0) {
      lines.push('', 'Case Context Notes:');
      caseContextNotes.slice(0, 8).forEach((note) => {
        lines.push(`- ${note.text} (${note.ts}, ${note.actor})`);
      });
    }
    if (reportActionItems.length > 0) {
      lines.push('', 'Action Plan:');
      reportActionItems.forEach((item) => {
        lines.push(
          `- [${item.codeArea}] ${item.action} | Deadline: ${item.deadline || 'TBD'} | Owner: ${
            item.person || 'Unassigned'
          }`
        );
      });
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `CLC_Inspection_Report_${currentCaseMeta.caseId}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: 'Report export generated',
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);
  };

  const openComposerModal = (type) => {
    setComposerModal({
      open: true,
      type,
      step: 1,
      text: '',
      sourceType: OBSERVATION_SOURCE_OPTIONS[0],
      requirement: FINDING_REQUIREMENT_OPTIONS[0],
      selectedRequirements: [FINDING_REQUIREMENT_OPTIONS[0]],
      polarity: 'non_compliant',
      goodPractice: false,
      evidenceType: 'document',
      evidenceNote: ''
    });
  };

  const closeComposerModal = () => {
    setComposerModal((prev) => ({ ...prev, open: false }));
  };

  const submitComposerModal = () => {
    const label = composerModal.type === 'manual' ? 'Manual finding added' : 'General observation added';
    const cleanedText = composerModal.text.trim();
    if (!cleanedText) return;
    const selectedRequirements =
      composerModal.type === 'observation'
        ? composerModal.selectedRequirements?.length
          ? composerModal.selectedRequirements
          : [FINDING_REQUIREMENT_OPTIONS[0]]
        : [composerModal.requirement];
    if (composerModal.type === 'manual') {
      const title =
        cleanedText.length > 96 ? `${cleanedText.slice(0, 93).trim()}...` : cleanedText;
      const evidenceDocId = activeDocId || caseDocuments[0]?.id || '';
      const generatedId = `inspector-${Date.now()}`;
      const severity =
        composerModal.polarity === 'compliant'
          ? composerModal.goodPractice
            ? 'best_practice'
            : 'pass'
          : 'critical';
      const sectionLabel =
        composerModal.evidenceType === 'document'
          ? activeDocument?.label ?? 'Linked document'
          : 'Case-level observation';
      setInspectorFindings((prev) => [
        {
          id: generatedId,
          severity,
          title,
          detail: cleanedText,
          documentId: evidenceDocId,
          boxId: null,
          source: {
            file: evidenceDocId ? activeDocument?.filename ?? activeDocument?.label : 'Case-level',
            page: evidenceDocId ? 1 : null,
            section: sectionLabel,
            text: composerModal.evidenceNote?.trim() || cleanedText
          },
          reference: `${composerModal.requirement} · ${composerModal.sourceType}`
        },
        ...prev
      ]);
    }
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail:
          composerModal.type === 'observation'
            ? `${label} (${selectedRequirements.length} requirement${
                selectedRequirements.length === 1 ? '' : 's'
              })`
            : `${label} (${composerModal.requirement})`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);
    if (composerModal.type === 'observation') {
      const createdAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const generatedObservations = selectedRequirements.map((requirement, index) => ({
        id: `obs-${Date.now()}-${index}`,
        text: cleanedText,
        requirement,
        sourceType: composerModal.sourceType,
        ts: createdAt,
        actor: currentUserEmail || 'Inspector'
      }));
      setInspectorObservations((prev) => [...generatedObservations, ...prev]);
    }
    setReportNeedsRegeneration(true);
    closeComposerModal();
  };

  const openReggie = (scope = 'all') => {
    setReggieScope(scope);
    setReggieOpen(true);
  };

  const toggleFocusArea = (areaId) => {
    setSelectedFocusAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  const handleSelectAllFocusAreas = () => {
    setSelectedFocusAreaIds(new Set(FOCUS_AREA_OPTIONS.map((area) => area.id)));
  };

  const handleDeselectAllFocusAreas = () => {
    setSelectedFocusAreaIds(new Set());
  };

  const handleApplyAmlPreset = () => {
    setSelectedFocusAreaIds(new Set(AML_DESK_REVIEW_PRESET));
  };

  const setReportEditableRef = (section, index, node) => {
    const bucket = reportEditableRefs.current[section];
    if (!bucket) return;
    bucket[index] = node || null;
  };

  const handleRevertReportSection = (section) => {
    const defaults = reportSectionDefaults[section] ?? [];
    const nodes = reportEditableRefs.current[section] ?? [];
    defaults.forEach((value, idx) => {
      const node = nodes[idx];
      if (node) node.textContent = value;
    });
    setEditedReportSections((prev) => ({ ...prev, [section]: false }));
  };

  const handleAddPartyRow = () => {
    setCaseSetupParties((prev) => [...prev, createPartyRow()]);
  };

  const handleRemovePartyRow = (rowId) => {
    setCaseSetupParties((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length > 0 ? next : [createPartyRow()];
    });
  };

  const handleUpdatePartyRow = (rowId, field, value) => {
    setCaseSetupParties((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handleSendReggie = (manualQuery) => {
    const query = (manualQuery ?? reggieInput).trim();
    if (!query) return;
    const userMessage = { id: `r${Date.now()}-u`, role: 'user', text: query };
    const candidate = filteredCrossDocResults[0];
    const relatedDoc = candidate ? documentsById.get(candidate.documentId) : null;
    const assistantText = candidate
      ? `I found relevant passages. ${relatedDoc?.label ?? 'AML_Policy_2023.pdf'} includes: "${candidate.title}".`
      : 'I found relevant references across this case. Try "source of funds", "training", or "overseas transactions".';
    const assistantMessage = { id: `r${Date.now()}-a`, role: 'assistant', text: assistantText };
    setReggieMessages((prev) => [...prev, userMessage, assistantMessage]);
    setReggieInput('');
  };

  const handleQuickReggiePrompt = (prompt) => {
    handleSendReggie(prompt);
  };

  const handleUndoDecision = () => {
    if (!undoDecision) return;
    setReportNeedsRegeneration(true);
    setFindingDecisions((prev) => {
      const next = { ...prev, [undoDecision.findingId]: undoDecision.previousDecision };
      if (!undoDecision.previousDecision) {
        delete next[undoDecision.findingId];
      }
      return next;
    });
    setUndoDecision(null);
  };

  const handleJumpToEvidencePassage = (finding, passage) => {
    if (!finding) return;
    const targetDocumentId = textOf(passage?.documentId, '') || finding.documentId;
    if (!targetDocumentId) return;
    const targetBoxId = textOf(passage?.boxId, '') || finding.boxId || null;
    handleViewDocument(targetDocumentId, targetBoxId, finding.id, STEP_REPORT);
  };

  const handleToggleFilter = (severity) => {
    setFilterSeverity((prev) =>
      prev.includes(severity) ? prev.filter((item) => item !== severity) : [...prev, severity]
    );
  };

  const handleSelectDocBox = useCallback(
    (boxId, { scrollFinding = true, documentId, origin } = {}) => {
      const targetDocId = documentId ?? activeDocId;
      const doc = documentsById.get(targetDocId);
      const availableBoxes = doc?.overlay?.boxes ?? [];

      if (availableBoxes.length === 0) {
        setActiveDocBoxId(null);
        return;
      }

      const resolvedBoxId =
        boxId && availableBoxes.some((box) => box.id === boxId) ? boxId : availableBoxes[0].id;

      setActiveDocBoxId(resolvedBoxId);
      if (origin !== 'pdf') {
        setDocFocusSignal((prev) => prev + 1);
      }

      const key = `${targetDocId}:${resolvedBoxId}`;
      const match = findingByDocAndBox.get(key);
      if (match && scrollFinding) {
        setActiveFindingId(match.id);
        const node = findingRefs.current[match.id];
        if (node) {
          node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    },
    [activeDocId, documentsById, findingByDocAndBox]
  );

  const handleViewDocument = (
    documentId,
    boxId,
    findingId,
    originStep = viewerOriginStep
  ) => {
    const doc = documentsById.get(documentId);
    const availableBoxes = doc?.overlay?.boxes ?? [];
    const fallbackBox =
      boxId && availableBoxes.some((entry) => entry.id === boxId)
        ? boxId
        : availableBoxes[0]?.id ?? null;
    if (documentId === activeDocId) {
      handleSelectDocBox(fallbackBox, { documentId });
    } else {
      pendingDocBoxRef.current = fallbackBox;
      setActiveDocId(documentId);
      setActiveDocBoxId(fallbackBox ?? null);
    }
    const lookupKey = fallbackBox ? `${documentId}:${fallbackBox}` : null;
    const resolvedFinding = findingId
      ? allFindings.find((item) => item.id === findingId)
      : lookupKey
        ? findingByDocAndBox.get(lookupKey)
        : null;
    setActiveFindingId(resolvedFinding?.id ?? null);
    if (resolvedFinding?.id) {
      setExpandedViewerFindingIds((prev) => ({ ...prev, [resolvedFinding.id]: true }));
    }
    if (resolvedFinding?.id && findingRefs.current[resolvedFinding.id]) {
      findingRefs.current[resolvedFinding.id].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    setDocPulse(documentId);
    if (docViewerRef.current) {
      docViewerRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    setViewerOriginStep(originStep);
    setCurrentStep(STEP_VIEWER);
  };

  const handleSelectDocTab = useCallback(
    (docId) => {
      setActiveDocId(docId);
      setDocCrossSearchOpen(false);
      const doc = documentsById.get(docId);
      const firstBoxId = doc?.overlay?.boxes?.[0]?.id ?? null;
      handleSelectDocBox(firstBoxId, { scrollFinding: false, documentId: docId });
      const firstFinding = allFindings.find((finding) => finding.documentId === docId);
      setActiveFindingId(firstFinding?.id ?? null);
    },
    [documentsById, allFindings, handleSelectDocBox]
  );

  const handleCycleDocument = useCallback(
    (direction) => {
      if (!caseDocuments.length) return;
      const startIndex = activeDocIndex >= 0 ? activeDocIndex : 0;
      const nextIndex = (startIndex + direction + caseDocuments.length) % caseDocuments.length;
      const nextDoc = caseDocuments[nextIndex];
      if (nextDoc) {
        handleSelectDocTab(nextDoc.id);
      }
    },
    [activeDocIndex, handleSelectDocTab]
  );

  const handleSaveDocumentNote = useCallback(() => {
    const cleanNote = docLevelNoteDraft.trim();
    setDocLevelNoteOpen(false);
    if (!cleanNote) {
      setDocLevelNoteDraft('');
      return;
    }
    if (activeDocId) {
      setDocumentNotes((prev) => {
        const existing = prev[activeDocId] ?? [];
        return {
          ...prev,
          [activeDocId]: [
            {
              id: `dn-${Date.now()}`,
              text: cleanNote,
              ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              actor: currentUserEmail || 'Inspector'
            },
            ...existing
          ]
        };
      });
    }
    setReportNeedsRegeneration(true);
    setHistoryItems((items) => [
      {
        id: `h${Date.now()}`,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detail: `Document note added (${activeDocument?.label ?? 'Current document'})`,
        actor: currentUserEmail || 'Inspector'
      },
      ...items
    ]);
    setDocLevelNoteDraft('');
    if (isActiveCasePersisted) {
      persistDocumentNote({
        caseId: currentCaseMeta.caseId,
        documentId: activeDocId,
        text: cleanNote,
        user: currentUser
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist document note', error);
      });
    }
  }, [
    docLevelNoteDraft,
    activeDocId,
    activeDocument?.label,
    currentCaseMeta.caseId,
    currentUser,
    currentUserEmail,
    isActiveCasePersisted
  ]);

  useEffect(() => {
    if (currentStep !== STEP_VIEWER) return;
    const pendingBoxId = pendingDocBoxRef.current;
    pendingDocBoxRef.current = null;
    const nextBoxId = pendingBoxId ?? activeDocBoxes[0]?.id ?? null;
    if (nextBoxId || activeDocBoxes.length === 0) {
      handleSelectDocBox(nextBoxId, { scrollFinding: false });
    }
  }, [currentStep, activeDocBoxes, handleSelectDocBox]);

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

  const findingFilterLabelMap = {
    all: 'All',
    unreviewed: 'Unreviewed',
    reviewed: 'Reviewed',
    leads: 'Leads',
    non_compliant: 'Non-compliant',
    compliant: 'Compliant',
    good_practice: 'Good practice',
    inspector_added: 'Inspector-added',
    strong: 'Strong evidence',
    supported: 'Supported evidence',
    indicative: 'Indicative evidence'
  };
  const findingSeverityBadgeMap = {
    critical: 'CRITICAL',
    warning: 'LEAD',
    best_practice: 'GOOD PRACTICE',
    pass: 'COMPLIANT'
  };

  const renderRiskDots = (riskLabel) => {
    const risk = (riskLabel || '').toLowerCase();
    const filled =
      risk === 'high' ? ['high', 'high', 'high'] : risk === 'medium' ? ['medium', 'medium'] : ['low'];
    return (
      <span className="risk-dots" aria-label={`Risk ${riskLabel}`}>
        {[0, 1, 2].map((idx) => {
          const level = filled[idx];
          return (
            <span
              key={`risk-${riskLabel}-${idx}`}
              className={`risk-dot ${level ? `filled ${level}` : 'empty'}`}
            />
          );
        })}
      </span>
    );
  };

  const renderConfidenceDots = (status) => {
    const map = status === 'attention' ? ['red'] : status === 'reviewing' ? ['amber', 'amber'] : ['green', 'green', 'green'];
    return (
      <span className="confidence-dots" aria-label={`Confidence ${status}`}>
        {[0, 1, 2].map((idx) => (
          <span
            key={`conf-${status}-${idx}`}
            className={`confidence-dot ${map[idx] ? map[idx] : 'empty'}`}
          />
        ))}
      </span>
    );
  };

  const formatReferenceText = (reference) => {
    if (!reference) return '';
    if (typeof reference === 'string') return reference;
    if (typeof reference === 'object') {
      const section = typeof reference.section === 'string' ? reference.section : '';
      const file = typeof reference.file === 'string' ? reference.file : '';
      const page = Number.isFinite(reference.page) ? `p.${reference.page}` : '';
      return [section, file, page].filter(Boolean).join(' · ');
    }
    return String(reference);
  };

  const formatSourceDocumentRef = (source) => {
    if (!source || typeof source !== 'object') return '';
    const file = typeof source.file === 'string' ? source.file : '';
    const page = Array.isArray(source.page)
      ? source.page.filter(Number.isFinite)[0]
      : Number.isFinite(source.page)
        ? source.page
        : null;
    if (!file && !page) return '';
    if (file && page) return `📄 ${file} — page ${page}`;
    if (file) return `📄 ${file}`;
    return `📄 page ${page}`;
  };

  const safeSourceField = (source, field, fallback = '') => {
    if (!source || typeof source !== 'object') return fallback;
    const value = source[field];
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return fallback;
  };

  const safeSourcePageLabel = (source) => {
    if (!source || typeof source !== 'object') return '';
    const value = source.page;
    if (Number.isFinite(value)) return String(value);
    if (Array.isArray(value)) {
      const first = value.find((entry) => Number.isFinite(entry));
      return Number.isFinite(first) ? String(first) : '';
    }
    return '';
  };

  function safeText(value, fallback = '') {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (!value) return fallback;
    if (Array.isArray(value)) {
      const flattened = value
        .map((entry) => safeText(entry, ''))
        .map((entry) => entry.trim())
        .filter(Boolean);
      return flattened.length > 0 ? flattened.join(' · ') : fallback;
    }
    if (typeof value === 'object') {
      const candidates = [value.text, value.excerpt, value.value, value.label, value.name];
      for (const candidate of candidates) {
        const text = safeText(candidate, '');
        if (text) return text;
      }
      return fallback;
    }
    return fallback;
  }

  const buildEvidencePassages = (finding, relatedDocLabel = 'Case document') => {
    const rawPassages = Array.isArray(finding?.evidence_passages)
      ? finding.evidence_passages
      : Array.isArray(finding?.evidencePassages)
        ? finding.evidencePassages
        : [];
    const normalizedPassages = rawPassages
      .map((passage, index) => {
        if (!passage || typeof passage !== 'object') return null;
        const docFile = safeText(
          passage.file || passage.document_name || passage.documentName || passage.document_id,
          relatedDocLabel
        );
        const pageLabel = safeText(passage.page || passage.page_number || passage.pageNumber, '');
        const sectionLabel = safeText(passage.section, '');
        const excerpt = safeText(passage.text || passage.excerpt || passage.snippet, '');
        const boxId = safeText(passage.box_id || passage.boxId, finding?.boxId || '');
        const documentId = safeText(
          passage.document_id || passage.documentId || finding?.documentId,
          finding?.documentId || ''
        );
        return {
          id: safeText(passage.id, `${finding?.id || 'finding'}-passage-${index}`),
          file: docFile,
          page: pageLabel,
          section: sectionLabel,
          excerpt,
          boxId,
          documentId
        };
      })
      .filter(Boolean);

    if (normalizedPassages.length > 0) {
      return normalizedPassages;
    }

    const file = safeSourceField(finding?.source, 'file', relatedDocLabel);
    const page = safeSourcePageLabel(finding?.source);
    const section = safeSourceField(finding?.source, 'section', '');
    const excerpt = safeText(finding?.source?.text, '');

    if (file || page || excerpt || section) {
      return [
        {
          id: `${finding?.id || 'finding'}-source`,
          file: file || relatedDocLabel,
          page,
          section,
          excerpt,
          boxId: finding?.boxId || '',
          documentId: finding?.documentId || ''
        }
      ];
    }

    return [];
  };

  const findingMatchesCodeArea = (finding, areaId) => {
    if (!finding || !areaId) return false;
    const normalizedArea = normalizeCodeAreaId(areaId);
    const explicitCodeArea = normalizeCodeAreaId(
      safeText(finding.codeArea || finding.code_area, '')
    );
    if (explicitCodeArea && explicitCodeArea === normalizedArea) {
      return true;
    }
    if (explicitCodeArea && normalizedArea) {
      if (explicitCodeArea.includes(normalizedArea) || normalizedArea.includes(explicitCodeArea)) {
        return true;
      }
    }
    const keywords = CODE_AREA_KEYWORDS[normalizedArea] ?? [];
    if (keywords.length === 0) return false;
    try {
      const haystack = [
        finding?.reference,
        finding?.title,
        finding?.detail,
        finding?.source?.section,
        finding?.source?.file,
        finding?.source?.text
      ]
        .filter((value) => value !== null && value !== undefined)
        .map((value) => safeText(value, ''))
        .join(' ')
        .toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    } catch (_error) {
      return false;
    }
  };

  const renderDashboard = () => (
    <div className="dashboard-shell">
      <div className="dashboard-header__actions">
        <label className="toggle dashboard-role-toggle">
          <input
            type="checkbox"
            checked={inspectorOnlyView}
            onChange={(event) => {
              const checked = event.target.checked;
              setInspectorOnlyView(checked);
              if (checked) {
                setDashboardView(false);
              }
            }}
          />
          <span>Inspector-only view</span>
        </label>
        <button type="button" className="btn primary" onClick={() => setAppMode('caseSetup')}>
          + New Case
        </button>
      </div>

      {!inspectorOnlyView ? (
        <div className="dashboard-view-toggle">
          <button
            type="button"
            className={`dashboard-view-toggle__btn ${!teamView ? 'active' : ''}`}
            onClick={() => setDashboardView(false)}
          >
            My Cases
          </button>
          <button
            type="button"
            className={`dashboard-view-toggle__btn ${teamView ? 'active' : ''}`}
            onClick={() => setDashboardView(true)}
          >
            Team Cases <span className="tab-count-badge">({dashboardCases.length})</span>
          </button>
        </div>
      ) : (
        <div className="dashboard-inspector-heading">My Cases</div>
      )}

      <div className="dashboard-active-indicator">
        <strong>{teamActiveCaseCount}</strong>
        <span>{teamView && !inspectorOnlyView ? 'team active cases' : 'active cases'}</span>
      </div>

      <div className="dashboard-filters">
        <input
          type="text"
          placeholder="Search by practice name..."
          value={dashboardSearch}
          onChange={(event) => setDashboardSearch(event.target.value)}
        />
        <select value={dashboardDateFilter} onChange={(event) => setDashboardDateFilter(event.target.value)}>
          <option>All</option>
          <option>This week</option>
          <option>This month</option>
          <option>Last 3 months</option>
        </select>
        <select value={dashboardOutcomeFilter} onChange={(event) => setDashboardOutcomeFilter(event.target.value)}>
          <option>All</option>
          <option>In progress</option>
          <option>Compliant</option>
          <option>Generally compliant</option>
          <option>Non-compliant</option>
        </select>
        {teamView && !inspectorOnlyView ? (
          <select
            value={dashboardInspectorFilter}
            onChange={(event) => setDashboardInspectorFilter(event.target.value)}
          >
            <option>All inspectors</option>
            {dashboardInspectorOptions.map((name) => (
              <option key={`inspector-${name}`} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setDashboardSearch('');
            setDashboardDateFilter('All');
            setDashboardOutcomeFilter('All');
            setDashboardInspectorFilter('All inspectors');
            setShowCompletedCases(false);
          }}
        >
          Clear all
        </button>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showCompletedCases}
            onChange={(event) => setShowCompletedCases(event.target.checked)}
          />
          <span>Show completed</span>
        </label>
      </div>

      {teamView && !inspectorOnlyView ? (
        <>
          <div className="team-quick-stats">
            <div>
              <span className="history-summary-label">Team active cases</span>
              <strong>{teamActiveCaseCount}</strong>
            </div>
            <div>
              <span className="history-summary-label">Unreviewed findings</span>
              <strong>{teamUnreviewedCount}</strong>
            </div>
            <div>
              <span className="history-summary-label">Cases idle &gt; 7 days</span>
              <strong>{teamIdleOver7DaysCount}</strong>
            </div>
          </div>
          <div className="dashboard-attention">
            <strong>Attention Needed</strong>
            {dashboardCases
              .filter((item) => item.status !== 'completed')
              .slice(0, 2)
              .map((item) => (
                <button
                  key={`attention-${item.id}`}
                  type="button"
                  className="dashboard-attention-link"
                  onClick={() => handleOpenCase(item)}
                >
                  {item.practice}: {item.unreviewed} unreviewed, {item.leads} leads.
                </button>
              ))}
          </div>
        </>
      ) : null}

      <div className="dashboard-cases">
        {isDashboardLoading ? (
          <div className="alert alert-warning small">Loading cases from Firestore...</div>
        ) : null}
        {dashboardError ? <div className="alert alert-warning small">{dashboardError}</div> : null}
        {visibleDashboardCases.length === 0 ? (
          <div className="edge-empty-card dashboard-empty-card">
            <div className="edge-empty-card__icon">📂</div>
            <h3>No cases match your filters.</h3>
            <p>Try broadening search criteria or clearing filters.</p>
            <button
              type="button"
              className="btn btn-xs secondary"
              onClick={() => {
                setDashboardSearch('');
                setDashboardDateFilter('All');
                setDashboardOutcomeFilter('All');
                setDashboardInspectorFilter('All inspectors');
                setShowCompletedCases(false);
              }}
            >
              Clear all filters
            </button>
          </div>
        ) : null}
        {visibleDashboardCases.map((item) => (
          <button key={item.id} type="button" className="dashboard-case-card" onClick={() => handleOpenCase(item)}>
            <div className="dashboard-case-card__top">
              <h3>{item.practice}</h3>
              <span>{item.id}</span>
            </div>
            <p className="dashboard-case-card__meta">Started: {item.started}</p>
            <div className="dashboard-progress">
              <div className="dashboard-progress__track">
                <div className="dashboard-progress__fill" style={{ width: `${item.progress}%` }} />
              </div>
              <span>{item.progressLabel}</span>
            </div>
            <p className="dashboard-case-card__meta">
              {item.unreviewed} unreviewed · {item.leads} leads · {item.goodPractice} good practice
            </p>
            <p className="dashboard-case-card__meta">
              Risk: {renderRiskDots(item.risk)} {item.risk} · Last activity: {item.lastActivity}
              {teamView ? ` · Inspector: ${item.inspector}` : ''}
            </p>
          </button>
        ))}
      </div>
      <div className="dashboard-recently-completed">
        <button
          type="button"
          className="dashboard-recently-completed__toggle"
          onClick={() => setShowRecentlyCompleted((prev) => !prev)}
        >
          {showRecentlyCompleted ? '▾' : '▸'} Recently Completed ({dashboardCases.filter((item) => item.status === 'completed').length})
        </button>
        {showRecentlyCompleted ? (
          <div className="dashboard-completed-list">
            {dashboardCases.filter((item) => item.status === 'completed').map((item) => (
              <button
                key={`completed-${item.id}`}
                type="button"
                className="dashboard-case-card completed"
                onClick={() => handleOpenCase(item)}
              >
                <div className="dashboard-case-card__top">
                  <h3>{item.practice}</h3>
                  <span>{item.id}</span>
                </div>
                <p className="dashboard-case-card__meta">
                  Outcome:{' '}
                  <span className="completed-outcome-badge">
                    {formatOutcomeLabel(item.outcome)}
                  </span>{' '}
                  · Last activity: {item.lastActivity}
                </p>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderCaseSetup = () => {
    const hasAutoMatch = caseSetupLicenceNumber.trim() === 'CLC-12458';
    const isCreateEnabled =
      caseSetupPracticeName.trim().length > 0 &&
      caseSetupLicenceNumber.trim().length > 0 &&
      selectedFocusAreaIds.size > 0;

    return (
      <div className="case-setup-shell">
        <div className="case-setup-back">
          <button type="button" className="btn ghost" onClick={() => setAppMode('dashboard')}>
            ← Back to Dashboard
          </button>
        </div>
        {caseCreateError ? <div className="alert alert-warning small">{caseCreateError}</div> : null}
        <h1>New Inspection Case</h1>

        <section className="case-setup-section">
          <h3>Practice Details</h3>
          <div className="case-setup-grid">
            <label>
              Practice name <span className="required">*</span>
              <input
                type="text"
                value={caseSetupPracticeName}
                onChange={(event) => setCaseSetupPracticeName(event.target.value)}
                placeholder="Full registered practice name"
              />
            </label>
            <label>
              CLC licence number <span className="required">*</span>
              <input
                type="text"
                value={caseSetupLicenceNumber}
                onChange={(event) => setCaseSetupLicenceNumber(event.target.value)}
                placeholder="CLC-XXXXX"
              />
            </label>
          </div>
          {hasAutoMatch ? (
            <div className="case-setup-match">
              <strong>✓ Previous inspection found: March 2023</strong>
              <p>Hartley &amp; Partners Solicitors. History will be linked automatically.</p>
              <button
                type="button"
                className="btn btn-xs secondary"
                onClick={() => {
                  setCaseSetupPracticeName('Hartley & Partners Solicitors');
                  setCaseSetupHolp('Sarah Chen');
                  setCaseSetupHofa('James Wright');
                  setCaseSetupPreviousInspection('2023-03-12');
                  setCaseSetupRiskLevel('medium');
                }}
              >
                Auto-fill practice details
              </button>
            </div>
          ) : null}
          <div className="case-setup-grid">
            <label>
              Head of Legal Practice (HoLP)
              <input
                type="text"
                value={caseSetupHolp}
                onChange={(event) => setCaseSetupHolp(event.target.value)}
                placeholder="Full name"
              />
            </label>
            <label>
              Head of Finance &amp; Admin (HoFA)
              <input
                type="text"
                value={caseSetupHofa}
                onChange={(event) => setCaseSetupHofa(event.target.value)}
                placeholder="Full name"
              />
            </label>
          </div>
        </section>

        <section className="case-setup-section">
          <h3>Inspection Context</h3>
          <p className="panel-subtitle">Optional fields to improve matching and findings relevance.</p>
          <div className="case-setup-grid">
            <label>
              Risk level
              <select
                value={caseSetupRiskLevel}
                onChange={(event) => setCaseSetupRiskLevel(event.target.value)}
              >
                <option value="not-assessed">Not assessed</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              Previous inspection
              <input
                type="date"
                value={caseSetupPreviousInspection}
                onChange={(event) => setCaseSetupPreviousInspection(event.target.value)}
              />
            </label>
          </div>
          <label>
            Pre-inspection concerns
            <div className="case-setup-textarea-wrap">
              <textarea
                rows={3}
                value={caseSetupConcerns}
                onChange={(event) => setCaseSetupConcerns(event.target.value)}
                placeholder="e.g. MLRO changed 6 months ago, aged balances flagged..."
              />
              <button type="button" className="case-setup-voice-btn" title="Dictate (UI only)" aria-label="Dictate">
                🎤
              </button>
            </div>
          </label>
        </section>

        <section className="case-setup-section">
          <h3>Focus Areas</h3>
          <p className="panel-subtitle">
            Select all code areas in scope for this inspection.
          </p>
          <label>
            Focus areas
            <div className="case-setup-focus-list">
              {FOCUS_AREA_OPTIONS.map((area) => (
                <label key={area.id} className="case-setup-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedFocusAreaIds.has(area.id)}
                    onChange={() => toggleFocusArea(area.id)}
                  />
                  <span>{area.label}</span>
                </label>
              ))}
            </div>
          </label>
          <div className="case-setup-quick-select">
            <button type="button" className="btn btn-xs ghost" onClick={handleSelectAllFocusAreas}>
              Select all
            </button>
            <button type="button" className="btn btn-xs ghost" onClick={handleDeselectAllFocusAreas}>
              Deselect all
            </button>
            <button type="button" className="btn btn-xs secondary" onClick={handleApplyAmlPreset}>
              AML desk review preset
            </button>
          </div>
          {selectedFocusAreaIds.size === 0 ? (
            <p className="case-setup-error">Select at least one focus area.</p>
          ) : null}
        </section>

        <section className="case-setup-section">
          <h3>Known Parties (Optional)</h3>
          <p className="panel-subtitle">
            If the CLC provided a party list, enter it here to improve document matching.
          </p>
          <div className="party-rows">
            {caseSetupParties.map((party) => (
              <div key={party.id} className="party-row">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Party name"
                  value={party.name}
                  onChange={(event) => handleUpdatePartyRow(party.id, 'name', event.target.value)}
                />
                <select
                  className="form-control"
                  value={party.role}
                  onChange={(event) => handleUpdatePartyRow(party.id, 'role', event.target.value)}
                >
                  <option value="">Role...</option>
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="giftor">Giftor</option>
                  <option value="lender">Lender</option>
                  <option value="guarantor">Guarantor</option>
                  <option value="other">Other</option>
                </select>
                <button
                  type="button"
                  className="btn btn-xs ghost party-remove-btn"
                  onClick={() => handleRemovePartyRow(party.id)}
                  title="Remove"
                  aria-label="Remove party row"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-xs ghost" onClick={handleAddPartyRow}>
            + Add party
          </button>
        </section>

        <section className="case-setup-section">
          <h3>Pre-inspection Questionnaire (Optional)</h3>
          <div
            className="upload-area-placeholder clickable"
            role="button"
            tabIndex={0}
            onClick={() => caseSetupFileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer?.files?.[0];
              if (file) {
                setCaseSetupQuestionnaireFile(file.name);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                caseSetupFileInputRef.current?.click();
              }
            }}
          >
            <strong>Drop PDF here or click to upload</strong>
            <p className="panel-subtitle">
              Processed as firm self-assessment context, not checked as policy evidence.
            </p>
            <button
              type="button"
              className="btn btn-xs secondary upload-placeholder-btn"
              onClick={(event) => {
                event.stopPropagation();
                caseSetupFileInputRef.current?.click();
              }}
            >
              Choose file
            </button>
            <input
              ref={caseSetupFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="visually-hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setCaseSetupQuestionnaireFile(file?.name ?? '');
              }}
            />
          </div>
          {caseSetupQuestionnaireFile ? (
            <div className="file-selected-chip">
              <span>📄 {caseSetupQuestionnaireFile}</span>
              <button
                type="button"
                className="btn btn-xs ghost"
                onClick={() => {
                  setCaseSetupQuestionnaireFile('');
                  if (caseSetupFileInputRef.current) {
                    caseSetupFileInputRef.current.value = '';
                  }
                }}
              >
                Remove
              </button>
            </div>
          ) : null}
        </section>

        <div className="action-bar">
          <button type="button" className="btn ghost" onClick={() => setAppMode('dashboard')}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleCreateCase}
            disabled={!isCreateEnabled || isCreatingCase}
          >
            {isCreatingCase ? 'Creating...' : 'Create Inspection Case'}
          </button>
        </div>
      </div>
    );
  };

  const renderComplianceByCodeArea = () => (
    <section className="panel compliance-code-area-panel">
      <div className="section-heading">
        <h2>Compliance by Code Area</h2>
        <button type="button" className="btn btn-xs secondary" onClick={() => openComposerModal('observation')}>
          + Add observation
        </button>
      </div>
      <div className="code-area-list">
        {[...complianceCodeAreas]
          .sort((left, right) => {
            const summarize = (areaId) => {
              const requirementRows = requirementsByCodeArea[areaId] ?? [];
              const areaFindings = availableFindings.filter((finding) =>
                findingMatchesCodeArea(finding, areaId)
              );
              const attentionCount = areaFindings.filter((entry) => entry.severity === 'critical').length;
              const leadCount = areaFindings.filter((entry) => entry.severity === 'warning').length;
              const metRequirements = requirementRows.filter((entry) => entry.status === 'compliant').length;
              return { attentionCount, leadCount, metRequirements, totalRequirements: Math.max(requirementRows.length, 1) };
            };
            const leftStats = summarize(left.id);
            const rightStats = summarize(right.id);
            const leftWeight = leftStats.attentionCount * 100 + leftStats.leadCount * 10;
            const rightWeight = rightStats.attentionCount * 100 + rightStats.leadCount * 10;
            if (rightWeight !== leftWeight) return rightWeight - leftWeight;
            const leftCompliant =
              leftStats.attentionCount === 0 &&
              leftStats.leadCount === 0 &&
              leftStats.metRequirements === leftStats.totalRequirements;
            const rightCompliant =
              rightStats.attentionCount === 0 &&
              rightStats.leadCount === 0 &&
              rightStats.metRequirements === rightStats.totalRequirements;
            if (leftCompliant !== rightCompliant) return leftCompliant ? 1 : -1;
            return left.name.localeCompare(right.name);
          })
          .map((area) => {
          const isExpanded = expandedCodeAreaId === area.id;
          const requirementRows = requirementsByCodeArea[area.id] ?? [];
          const mappedAreaFindings = availableFindings.filter((finding) =>
            findingMatchesCodeArea(finding, area.id)
          );
          const areaFindings = filteredFindings.filter((finding) =>
            findingMatchesCodeArea(finding, area.id)
          );
          const attentionCount = mappedAreaFindings.filter((entry) => entry.severity === 'critical').length;
          const leadCount = mappedAreaFindings.filter((entry) => entry.severity === 'warning').length;
          const goodPracticeCount = mappedAreaFindings.filter((entry) => entry.severity === 'best_practice').length;
          const metRequirements = requirementRows.filter((entry) => entry.status === 'compliant').length;
          const totalRequirements = Math.max(requirementRows.length, 1);
          const metLabel = `${metRequirements}/${totalRequirements}`;
          const isFullyCompliant = attentionCount === 0 && leadCount === 0 && metRequirements === totalRequirements;
          const countParts = [];
          if (attentionCount > 0) countParts.push({ key: 'attention', label: `${attentionCount} attention`, cls: 'count-attention' });
          if (goodPracticeCount > 0) countParts.push({ key: 'good-practice', label: `${goodPracticeCount} good practice`, cls: 'count-gp' });
          if (leadCount > 0) countParts.push({ key: 'lead', label: `${leadCount} lead`, cls: 'count-lead' });
          const activeRequirementId =
            overviewRequirementFilter.areaId === area.id
              ? overviewRequirementFilter.requirementId
              : '';
          const areaFindingsFilteredByRequirement = activeRequirementId
            ? areaFindings.filter((finding) => {
                const keywords = REQUIREMENT_KEYWORDS[activeRequirementId] ?? [];
                if (keywords.length === 0) return true;
                const haystack = [
                  finding?.reference,
                  finding?.title,
                  finding?.detail,
                  finding?.source?.section,
                  finding?.source?.file,
                  finding?.source?.text
                ]
                  .filter((value) => value !== null && value !== undefined)
                  .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
                  .join(' ')
                  .toLowerCase();
                return keywords.some((keyword) => haystack.includes(keyword));
              })
            : areaFindings;

          return (
            <div key={area.id}>
              <div
                className={`code-area-row ${isExpanded ? 'expanded' : ''}`}
                onClick={() => setExpandedCodeAreaId((prev) => (prev === area.id ? '' : area.id))}
              >
                <div className="code-area-chevron">▶</div>
                <div className="code-area-info">
                  <div className="code-area-name">{area.name}</div>
                  <div className="code-area-meta">
                    <div className="code-area-progress" style={{ flex: 1 }}>
                      <div className="progress-track">
                        <div
                          className="progress-bar"
                          style={{
                            width: `${Math.min(100, Math.max(0, (metRequirements / totalRequirements) * 100))}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="code-area-met">{metLabel} met</div>
                    <div className="code-area-counts">
                      {countParts.map((part, index) => (
                        <span key={`${area.id}-${part.key}`} className={part.cls}>
                          {index > 0 ? <span className="sep">·</span> : null}
                          {part.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {isFullyCompliant ? <span className="fully-compliant">✓</span> : null}
              </div>

              {isExpanded ? (
                <div className="expanded-area">
                  <div className="expanded-inner">
                    <div className="requirements-col">
                      <h4>Requirements</h4>
                      {requirementRows.map((req) => (
                        <div
                          key={req.id}
                          className={`req-item ${activeRequirementId === req.id ? 'active-filter' : ''}`}
                          onClick={() =>
                            setOverviewRequirementFilter((prev) =>
                              prev.areaId === area.id && prev.requirementId === req.id
                                ? { areaId: '', requirementId: '' }
                                : { areaId: area.id, requirementId: req.id }
                            )
                          }
                        >
                          <span className={`req-icon ${req.status}`}>
                            {req.status === 'compliant' ? '✓' : req.status === 'non_compliant' ? '✕' : '●'}
                          </span>
                          {req.label}
                        </div>
                      ))}
                    </div>
                    <div className="findings-col">
                      <div className="filter-row">
                        <span className="panel-subtitle">Findings for {area.name}</span>
                        <div className="filter-dropdown-wrap" ref={overviewFilterRef}>
                          <button
                            type="button"
                            className={`filter-dropdown-btn ${
                              findingViewFilter !== 'all' ? 'has-filter' : ''
                            }`}
                            onClick={() => setOverviewFilterOpen((prev) => !prev)}
                            aria-expanded={overviewFilterOpen}
                            aria-haspopup="menu"
                          >
                            Filter: {findingFilterLabelMap[findingViewFilter] ?? 'All'}
                            <span className="dropdown-chevron">▼</span>
                          </button>
                          <div
                            className={`filter-dropdown-panel ${overviewFilterOpen ? 'open' : ''}`}
                            role="menu"
                          >
                            {['all'].map((filterKey) => (
                              <label key={`overview-filter-option-${filterKey}`} className="filter-checkbox">
                                <input
                                  type="checkbox"
                                  checked={findingViewFilter === filterKey}
                                  onChange={() => {
                                    setFindingViewFilter(filterKey);
                                    setOverviewFilterOpen(false);
                                  }}
                                />
                                <span>{findingFilterLabelMap[filterKey]}</span>
                              </label>
                            ))}
                            <div className="filter-dropdown-divider" />
                            {[
                              'unreviewed',
                              'reviewed',
                              'leads',
                              'non_compliant',
                              'compliant',
                              'good_practice',
                              'inspector_added'
                            ].map((filterKey) => (
                              <label key={`overview-filter-option-${filterKey}`} className="filter-checkbox">
                                <input
                                  type="checkbox"
                                  checked={findingViewFilter === filterKey}
                                  onChange={() => {
                                    setFindingViewFilter(filterKey);
                                    setOverviewFilterOpen(false);
                                  }}
                                />
                                <span>{findingFilterLabelMap[filterKey]}</span>
                              </label>
                            ))}
                            <div className="filter-dropdown-divider" />
                            {['strong', 'supported', 'indicative'].map((filterKey) => (
                              <label key={`overview-filter-option-${filterKey}`} className="filter-checkbox">
                                <input
                                  type="checkbox"
                                  checked={findingViewFilter === filterKey}
                                  onChange={() => {
                                    setFindingViewFilter(filterKey);
                                    setOverviewFilterOpen(false);
                                  }}
                                />
                                <span>{findingFilterLabelMap[filterKey]}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      {activeRequirementId ? (
                        <div className="filter-clear visible">
                          <span>
                            Filtering by requirement:{' '}
                            {requirementRows.find((entry) => entry.id === activeRequirementId)?.label ?? activeRequirementId}
                          </span>
                          <button
                            type="button"
                            className="btn btn-xs ghost"
                            onClick={() => setOverviewRequirementFilter({ areaId: '', requirementId: '' })}
                          >
                            Clear
                          </button>
                        </div>
                      ) : null}
                      {areaFindingsFilteredByRequirement.length === 0 ? (
                        <div className="empty-state-inline">
                          <h4>
                            {findingViewFilter === 'all'
                              ? 'No findings currently mapped'
                              : 'No findings match the selected filter'}
                          </h4>
                          <p>
                            {findingViewFilter === 'all'
                              ? 'As processing evolves, this panel will populate with linked findings.'
                              : 'Try switching filter back to All to see every mapped finding.'}
                          </p>
                        </div>
                      ) : (
                        <div className="overview-findings-column">
                          {areaFindingsFilteredByRequirement.map((finding) => (
                            (() => {
                              const reviewState = findingDecisions[finding.id] ?? 'unreviewed';
                              const isFindingExpanded =
                                expandedOverviewFindingIds[finding.id] ??
                                (finding.severity === 'critical');
                              const reviewStatusLabel =
                                reviewState === 'accepted'
                                  ? 'Accepted'
                                  : reviewState === 'rejected'
                                    ? 'Rejected'
                                    : reviewState === 'dismissed'
                                      ? 'Dismissed'
                                      : 'Unreviewed';
                              const reviewStatusSymbol =
                                reviewState === 'accepted'
                                  ? '✓'
                                  : reviewState === 'rejected'
                                    ? '✕'
                                    : reviewState === 'dismissed'
                                      ? '◌'
                                      : '○';
                              const severityLabel =
                                findingSeverityBadgeMap[finding.severity] ?? 'FINDING';
                              const evidenceStrength =
                                findingEvidenceStrengthMap[finding.severity] ?? {
                                  key: 'supported',
                                  label: 'Supported'
                                };
                              const isLeadFinding = finding.severity === 'warning';
                              const isInspectorAdded = !finding.reference;
                              const evidencePassages = buildEvidencePassages(finding);
                              const noteEntry = findingNotes[finding.id];
                              const noteText = typeof noteEntry === 'string' ? noteEntry : noteEntry?.text;
                              return (
                            <article
                              key={`code-area-finding-${area.id}-${finding.id}`}
                              className={`finding-card ${
                                finding.severity === 'warning'
                                  ? 'lead'
                                  : finding.severity === 'best_practice'
                                    ? 'compliant'
                                    : 'noncompliant'
                              } ${isInspectorAdded ? 'inspector-added' : ''} ${
                                isFindingExpanded ? 'expanded' : ''
                              }`}
                            >
                              <div
                                className="finding-card-header"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  setExpandedOverviewFindingIds((prev) => ({
                                    ...prev,
                                    [finding.id]: !isFindingExpanded
                                  }))
                                }
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setExpandedOverviewFindingIds((prev) => ({
                                      ...prev,
                                      [finding.id]: !isFindingExpanded
                                    }));
                                  }
                                }}
                              >
                                <div className="finding-card-content">
                                  <div className="finding-title">
                                    <span className={`finding-severity-label severity-${finding.severity}`}>
                                      {severityLabel}
                                    </span>{' '}
                                    {safeText(finding.title, 'Finding')}
                                    {reviewState === 'unreviewed' ? (
                                      <span className="new-badge">New</span>
                                    ) : null}
                                    {RECURRING_FINDING_IDS.has(finding.id) ? (
                                      <span className="recurring-badge">Previously flagged</span>
                                    ) : null}
                                    <span className="finding-expand-chev">{isFindingExpanded ? '▾' : '▸'}</span>
                                  </div>
                                  <div className="finding-meta">
                                    <code>{formatReferenceText(finding.reference) || finding.id}</code>
                                    <span className="sep">·</span>
                                    <span className={`evidence-badge ${evidenceStrength.key}`}>
                                      {evidenceStrength.label}
                                    </span>
                                    <span className="sep">·</span>
                                    <span className={`source-tag ${isInspectorAdded ? 'inspector' : 'system'}`}>
                                      {finding.reference ? '⚙ System' : '👤 Inspector-added'}
                                    </span>
                                  </div>
                                  <div className="review-status-wrap">
                                    <span className={`review-status ${reviewState}`}>
                                      {reviewStatusSymbol} {reviewStatusLabel}
                                    </span>
                                  </div>
                                </div>
                                <div className="finding-header-actions">
                                  <button
                                    type="button"
                                    className="finding-more"
                                    aria-label="More finding actions"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setActiveMenuFindingId((prev) => (prev === finding.id ? null : finding.id));
                                    }}
                                  >
                                    ⋮
                                  </button>
                                  {activeMenuFindingId === finding.id ? (
                                    <div className="finding-menu" ref={findingMenuRef}>
                                      {reviewState === 'dismissed' ? (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleRequestFindingDecision(finding.id, null);
                                          }}
                                        >
                                          Reopen lead
                                        </button>
                                      ) : null}
                                      {reviewState === 'accepted' ? (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleRequestFindingDecision(finding.id, 'rejected');
                                          }}
                                        >
                                          Change decision
                                        </button>
                                      ) : null}
                                      {reviewState === 'rejected' ? (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleRequestFindingDecision(finding.id, 'accepted');
                                          }}
                                        >
                                          Change decision
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleOpenAddNote(finding.id, safeText(finding.detail, ''));
                                        }}
                                      >
                                        📝 Add note
                                      </button>
                                      {reviewState !== 'dismissed' ? (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleRequestFindingDecision(finding.id, 'dismissed');
                                          }}
                                        >
                                          Dismiss lead
                                        </button>
                                      ) : null}
                                      {!finding.reference ? (
                                        <button
                                          type="button"
                                          className="danger"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setDeleteFindingTargetId(finding.id);
                                            setActiveMenuFindingId(null);
                                          }}
                                        >
                                          Delete finding
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              {isFindingExpanded ? (
                              <div className="finding-card-body">
                                {finding.reference ? (
                                  <div className="finding-section">
                                    <div className="finding-section-label">Regulatory requirement</div>
                                    <div className="finding-quote">{formatReferenceText(finding.reference)}</div>
                                  </div>
                                ) : null}
                                {isLeadFinding ? (
                                  <div className="lead-sections">
                                    <div className="lead-section">
                                      <div className="lead-section-title">What was noticed</div>
                                      <p>{safeText(finding.detail, 'Potential issue identified in current evidence.')}</p>
                                    </div>
                                    <div className="lead-section">
                                      <div className="lead-section-title">Why this could not be confirmed</div>
                                      <p>
                                        Current uploaded material does not provide enough certainty to classify this as a
                                        confirmed finding.
                                      </p>
                                    </div>
                                    <div className="lead-section">
                                      <div className="lead-section-title">Suggested action</div>
                                      <p>
                                        Use &quot;Jump to evidence&quot; and request missing context from the practice before
                                        confirming or dismissing.
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="finding-section">
                                    <div className="finding-section-label">What was found</div>
                                    <p>{safeText(finding.detail, 'No detailed description available yet.')}</p>
                                  </div>
                                )}
                                <div className="finding-section">
                                  <div className="finding-section-label">Evidence</div>
                                  {evidencePassages.length === 0 ? (
                                    <div className="case-level-evidence">Case-level — no document evidence.</div>
                                  ) : (
                                    evidencePassages.map((passage) => (
                                      <div key={`overview-evidence-${finding.id}-${passage.id}`} className="evidence-block">
                                        <div className="evidence-head-row">
                                          <div className="doc-ref">
                                            📄 {passage.file}
                                            {passage.page ? ` — page ${passage.page}` : ''}
                                          </div>
                                          {passage.documentId ? (
                                            <span className="tooltip-wrap">
                                              <button
                                                type="button"
                                                className="jump-link-btn"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleViewDocument(
                                                    passage.documentId,
                                                    passage.boxId || finding.boxId,
                                                    finding.id,
                                                    STEP_OVERVIEW
                                                  );
                                                }}
                                              >
                                                <span className="jump-link">Jump to evidence</span>
                                              </button>
                                              <span className="tooltip-text">Opens Document Viewer</span>
                                            </span>
                                          ) : null}
                                        </div>
                                        {passage.excerpt ? <div className="excerpt">"{passage.excerpt}"</div> : null}
                                        {passage.section ? (
                                          <div className="finding-extra-meta">
                                            <span className="source-tag">{safeText(passage.section, '')}</span>
                                          </div>
                                        ) : null}
                                        {!passage.documentId ? (
                                          <div className="finding-extra-meta">
                                            <span className="source-tag">Case-level evidence</span>
                                          </div>
                                        ) : null}
                                      </div>
                                    ))
                                  )}
                                </div>
                                <div className="finding-section">
                                  <div className="finding-section-label">Evidence strength</div>
                                  <p>
                                    <span className={`evidence-badge ${evidenceStrength.key}`}>
                                      {evidenceStrength.label}
                                    </span>
                                  </p>
                                </div>
                                <div className="action-row finding-actions">
                                  {isLeadFinding && reviewState === 'unreviewed' ? (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-primary overview-action-btn"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRequestFindingDecision(finding.id, 'accepted');
                                        }}
                                      >
                                        ✓ Confirm as finding
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-secondary overview-action-btn"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRequestFindingDecision(finding.id, 'dismissed');
                                        }}
                                      >
                                        ✕ Dismiss
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button type="button" className="btn btn-sm btn-success overview-action-btn" onClick={(event) => { event.stopPropagation(); handleRequestFindingDecision(finding.id, 'accepted'); }}>
                                        ✓ Accept
                                      </button>
                                      <button type="button" className="btn btn-sm btn-secondary overview-action-btn" onClick={(event) => { event.stopPropagation(); handleRequestFindingDecision(finding.id, 'rejected'); }}>
                                        ✕ Reject
                                      </button>
                                    </>
                                  )}
                                  <button type="button" className="btn btn-sm btn-secondary overview-action-btn" onClick={(event) => { event.stopPropagation(); handleOpenAddNote(finding.id, safeText(finding.detail, '')); }}>
                                    📝 Add note
                                  </button>
                                </div>
                                {inlineRejectFindingId === finding.id ? (
                                  <div className="inline-decision-form">
                                    <label className="modal-label" htmlFor={`overview-inline-reject-reason-${finding.id}`}>
                                      Reason category (required)
                                    </label>
                                    <select
                                      id={`overview-inline-reject-reason-${finding.id}`}
                                      className="modal-select"
                                      value={inlineRejectReason}
                                      onChange={(event) => setInlineRejectReason(event.target.value)}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {REVIEW_REASON_OPTIONS.map((option) => (
                                        <option key={`overview-reject-${finding.id}-${option.value}`} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                    <label className="modal-label" htmlFor={`overview-inline-reject-note-${finding.id}`}>
                                      Note {inlineRejectReason === 'other' ? '(required)' : '(optional)'}
                                    </label>
                                    <textarea
                                      id={`overview-inline-reject-note-${finding.id}`}
                                      className="modal-textarea"
                                      value={inlineRejectNote}
                                      onChange={(event) => setInlineRejectNote(event.target.value)}
                                      placeholder="Add detail for this decision..."
                                      onClick={(event) => event.stopPropagation()}
                                    />
                                    <div className="modal-actions">
                                      <button
                                        type="button"
                                        className="btn ghost"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setInlineRejectFindingId(null);
                                          setInlineRejectReason(REVIEW_REASON_OPTIONS[0].value);
                                          setInlineRejectNote('');
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        className="btn primary"
                                        disabled={inlineRejectReason === 'other' && !inlineRejectNote.trim()}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleConfirmInlineReject(finding.id);
                                        }}
                                      >
                                        Confirm rejection
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                                {inlineDismissFindingId === finding.id ? (
                                  <div className="inline-decision-form">
                                    <label className="modal-label" htmlFor={`overview-inline-dismiss-reason-${finding.id}`}>
                                      Reason for dismissal (required)
                                    </label>
                                    <select
                                      id={`overview-inline-dismiss-reason-${finding.id}`}
                                      className="modal-select"
                                      value={inlineDismissReason}
                                      onChange={(event) => setInlineDismissReason(event.target.value)}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <option value="" disabled>
                                        Select a dismissal reason
                                      </option>
                                      {REVIEW_REASON_OPTIONS.map((option) => (
                                        <option key={`overview-dismiss-${finding.id}-${option.value}`} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                    <label className="modal-label" htmlFor={`overview-inline-dismiss-note-${finding.id}`}>
                                      Details {inlineDismissReason === 'other' ? '(required)' : '(optional)'}
                                    </label>
                                    <textarea
                                      id={`overview-inline-dismiss-note-${finding.id}`}
                                      className="modal-textarea"
                                      value={inlineDismissNote}
                                      onChange={(event) => setInlineDismissNote(event.target.value)}
                                      placeholder="Add detail for this dismissal..."
                                      onClick={(event) => event.stopPropagation()}
                                    />
                                    <div className="modal-actions">
                                      <button
                                        type="button"
                                        className="btn ghost"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setInlineDismissFindingId(null);
                                          setInlineDismissReason('');
                                          setInlineDismissNote('');
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        className="btn primary"
                                        disabled={!inlineDismissReason || (inlineDismissReason === 'other' && !inlineDismissNote.trim())}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleConfirmInlineDismiss(finding.id);
                                        }}
                                      >
                                        Confirm dismissal
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                                {noteTargetFindingId === finding.id ? (
                                  <div className="inline-note-form">
                                    <label className="modal-label" htmlFor={`overview-inline-note-${finding.id}`}>
                                      Add note
                                    </label>
                                    <textarea
                                      id={`overview-inline-note-${finding.id}`}
                                      className="modal-textarea"
                                      value={noteDraft}
                                      onChange={(event) => setNoteDraft(event.target.value)}
                                      placeholder="Add context for this finding..."
                                      onClick={(event) => event.stopPropagation()}
                                    />
                                    <div className="modal-actions">
                                      <button
                                        type="button"
                                        className="btn ghost"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setNoteTargetFindingId(null);
                                          setNoteDraft('');
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        className="btn primary"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleSaveFindingNote();
                                        }}
                                      >
                                        Save note
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                                {noteText ? (
                                  <p className="finding-note">
                                    Note: {noteText}
                                    {typeof noteEntry === 'object' && noteEntry?.ts ? (
                                      <span className="finding-note-meta">
                                        {' '}
                                        ({noteEntry.ts} - {noteEntry.actor ?? 'Inspector'})
                                      </span>
                                    ) : null}
                                  </p>
                                ) : null}
                              </div>
                              ) : null}
                            </article>
                              );
                            })()
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => openComposerModal('manual')}
                        >
                          + Add manual finding
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        <div
          className={`not-assessed ${notAssessedExpanded ? 'expanded' : ''}`}
          onClick={() => setNotAssessedExpanded((prev) => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setNotAssessedExpanded((prev) => !prev);
            }
          }}
        >
          <div className="not-assessed-header">
            <span>{notAssessedExpanded ? '▼' : '▶'}</span>
            <span>
              Not Assessed <span className="panel-subtitle">({notAssessedAreas.length})</span>
            </span>
          </div>
          <div className="not-assessed-body">
            {notAssessedAreas.map((entry) => (
              <div key={entry} className="not-assessed-item">
                <span>{entry}</span>
                <span className="panel-subtitle">No evidence in scope</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  const renderFindingsWorkspace = () => {
    if (caseDocuments.length === 0) {
      return (
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon">📄</div>
          <h3>No documents available yet</h3>
          <p>Upload and verify at least one document before opening the document viewer.</p>
          <div className="action-row">
            <button type="button" className="btn btn-sm secondary" onClick={() => setCurrentStep(STEP_DOCUMENTS)}>
              ← Back to Documents
            </button>
          </div>
        </div>
      );
    }

    const viewerBackStep = viewerOriginStep === STEP_DOCUMENTS ? STEP_DOCUMENTS : STEP_OVERVIEW;
    const viewerBackLabel = viewerOriginStep === STEP_DOCUMENTS ? 'Documents' : 'Overview';
    const findingsForActiveDocument = filteredFindings.filter((finding) => {
      if (finding.documentId !== activeDocId) return false;
      if (viewerCodeAreaFilter === 'all') return true;
      return findingMatchesCodeArea(finding, viewerCodeAreaFilter);
    });
    const totalFindingsForActiveDocument = availableFindings.filter(
      (finding) => finding.documentId === activeDocId
    ).length;
    const hiddenForActiveDocument = Math.max(
      totalFindingsForActiveDocument - findingsForActiveDocument.length,
      0
    );

    return (
    <>
      <div className={`split-view findings-view ${isViewerFocusMode ? 'viewer-focus' : ''}`}>
        <div className="panel doc-panel" ref={docViewerRef}>
          <div className="doc-panel-header">
            <div className="doc-panel-header-main">
              <div className="doc-top-nav">
                <div className="doc-top-nav-left">
                  <button
                    type="button"
                    className="doc-breadcrumb-link"
                    onClick={() => setCurrentStep(viewerBackStep)}
                  >
                    ← {viewerBackLabel}
                  </button>
                </div>
                <div className="doc-top-nav-center">
                  Document: {activeDocument?.filename ?? 'No document selected'}
                </div>
                <div className="doc-top-nav-right">
                  <span>
                    Viewing: {Math.max(activeDocIndex + 1, 1)} of {Math.max(caseDocuments.length, 1)}
                  </span>
                  <button type="button" className="btn btn-icon btn-xs secondary" onClick={() => handleCycleDocument(-1)}>
                    ◀
                  </button>
                  <button type="button" className="btn btn-icon btn-xs secondary" onClick={() => handleCycleDocument(1)}>
                    ▶
                  </button>
                </div>
              </div>
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
            </div>
            <div className="overlay-controls">
              <button
                type="button"
                className="btn btn-xs ghost"
                onClick={() => setIsViewerFocusMode((prev) => !prev)}
              >
                {isViewerFocusMode ? 'Exit focus' : 'Focus viewer'}
              </button>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showDocBoxes}
                  onChange={(event) => setShowDocBoxes(event.target.checked)}
                />
                <span>Show highlights</span>
              </label>
            </div>
          </div>
          {activeDocBoxes.length === 0 ? (
            <div className="alert alert-warning small">
              No bounding boxes are available for this document yet.
            </div>
          ) : null}
          <div className="doc-panel-body">
            <div className="pdf-overlay-panel">
              <PdfOverlayViewer
                key={activeDocument?.id || activeDocument?.pdf || 'doc-viewer'}
                pdfUrl={activeDocument?.pdf}
                boxes={activeDocBoxes}
                showBoxes={showDocBoxes}
                activeBoxId={activeDocBoxId}
                onSelectBox={handleSelectDocBox}
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
            <button
              type="button"
              className="btn btn-xs secondary"
              onClick={() => setDocLevelNoteOpen(true)}
            >
              📝 Add note to document
            </button>
            <button type="button" className="btn btn-xs secondary" onClick={() => openReggie('document')}>
              🛡 Ask Reggie about this document
            </button>
            <div className="doc-footer-search">
              <input
                type="text"
                value={docSearchQuery}
                onChange={(event) => {
                  setDocSearchQuery(event.target.value);
                  if (!docCrossSearchOpen) setDocCrossSearchOpen(true);
                }}
                placeholder="Search this document..."
              />
              <button
                type="button"
                className="btn btn-xs ghost"
                onClick={() => setDocCrossSearchOpen((prev) => !prev)}
              >
                {docCrossSearchOpen ? 'Hide' : 'Search'}
              </button>
            </div>
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
              ) : (docSearchScope === 'document'
                ? filteredInDocumentResults.length === 0
                : filteredCrossDocResults.length === 0) ? (
                <p className="panel-subtitle">
                  {docSearchScope === 'document'
                    ? 'No matches found in this document. Try broader terms.'
                    : 'No cross-document matches found. Try broader terms.'}
                </p>
              ) : (
                <div className="docs-search-results compact">
                  {(docSearchScope === 'document' ? filteredInDocumentResults : filteredCrossDocResults).map(
                    (finding) => {
                    const relatedDoc = documentsById.get(finding.documentId);
                    return (
                      <div key={`viewer-search-${finding.id}`} className="docs-search-result">
                        <strong>{safeText(finding.title, 'Finding')}</strong>
                        <p>{relatedDoc?.label ?? 'Document'} · {safeText(finding.detail, '')}</p>
                        {finding.source ? (
                          <p className="finding-doc-ref">{formatSourceDocumentRef(finding.source)}</p>
                        ) : null}
                        <div className="search-result-actions">
                          <button
                            type="button"
                            className="btn btn-xs secondary"
                            onClick={() => handleViewDocument(finding.documentId, finding.boxId, finding.id)}
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
        <div className="panel findings-panel">
          <div className="panel-header">
            <div>
              <h3>Findings for this document</h3>
              <p className="panel-subtitle">
                Findings and leads · {findingsForActiveDocument.length} shown /{' '}
                {totalFindingsForActiveDocument} total
              </p>
            </div>
          </div>
          <div className="filter-row">
            <div className="viewer-filter-row">
              <div className="filter-dropdown-wrap" ref={severityFilterRef}>
                <button
                  type="button"
                  className={`filter-dropdown-btn ${filterSeverity.length > 0 ? 'has-filter' : ''}`}
                  onClick={() => setSeverityFilterOpen((prev) => !prev)}
                >
                  Filter findings {filterSeverity.length > 0 ? `(${filterSeverity.length})` : ''}
                  <span className="dropdown-chevron">{severityFilterOpen ? '▲' : '▼'}</span>
                </button>
                <div className={`filter-dropdown-panel ${severityFilterOpen ? 'open' : ''}`}>
                  {severityCounts.map((item) => (
                    <label key={`severity-filter-${item.id}`} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={filterSeverity.includes(item.id)}
                        onChange={() => handleToggleFilter(item.id)}
                      />
                      <span>{severityLabelMap[item.id] ?? item.label}</span>
                    </label>
                  ))}
                  <div className="filter-dropdown-divider" />
                  <button
                    type="button"
                    className="btn btn-xs ghost"
                    onClick={() => setFilterSeverity([])}
                    disabled={filterSeverity.length === 0}
                  >
                    Clear severity filter
                  </button>
                </div>
              </div>
              <div className="filter-dropdown-wrap" ref={viewerTypeFilterRef}>
                <button
                  type="button"
                  className={`filter-dropdown-btn ${findingViewFilter !== 'all' ? 'has-filter' : ''}`}
                  onClick={() => setViewerTypeFilterOpen((prev) => !prev)}
                  aria-expanded={viewerTypeFilterOpen}
                  aria-haspopup="menu"
                >
                  Type: {findingFilterLabelMap[findingViewFilter] ?? 'All'}
                  <span className="dropdown-chevron">{viewerTypeFilterOpen ? '▲' : '▼'}</span>
                </button>
                <div className={`filter-dropdown-panel ${viewerTypeFilterOpen ? 'open' : ''}`} role="menu">
                  {['all'].map((filterKey) => (
                    <label key={`viewer-filter-option-${filterKey}`} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={findingViewFilter === filterKey}
                        onChange={() => {
                          setFindingViewFilter(filterKey);
                          setViewerTypeFilterOpen(false);
                        }}
                      />
                      <span>{findingFilterLabelMap[filterKey]}</span>
                    </label>
                  ))}
                  <div className="filter-dropdown-divider" />
                  {[
                    'unreviewed',
                    'reviewed',
                    'leads',
                    'non_compliant',
                    'compliant',
                    'good_practice',
                    'inspector_added'
                  ].map((filterKey) => (
                    <label key={`viewer-filter-option-${filterKey}`} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={findingViewFilter === filterKey}
                        onChange={() => {
                          setFindingViewFilter(filterKey);
                          setViewerTypeFilterOpen(false);
                        }}
                      />
                      <span>{findingFilterLabelMap[filterKey]}</span>
                    </label>
                  ))}
                  <div className="filter-dropdown-divider" />
                  {['strong', 'supported', 'indicative'].map((filterKey) => (
                    <label key={`viewer-filter-option-${filterKey}`} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={findingViewFilter === filterKey}
                        onChange={() => {
                          setFindingViewFilter(filterKey);
                          setViewerTypeFilterOpen(false);
                        }}
                      />
                      <span>{findingFilterLabelMap[filterKey]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-dropdown-wrap" ref={viewerCodeAreaFilterRef}>
                <button
                  type="button"
                  className={`filter-dropdown-btn ${viewerCodeAreaFilter !== 'all' ? 'has-filter' : ''}`}
                  onClick={() => setViewerCodeAreaFilterOpen((prev) => !prev)}
                  aria-expanded={viewerCodeAreaFilterOpen}
                  aria-haspopup="menu"
                >
                  Code area:{' '}
                  {VIEWER_CODE_AREA_FILTERS.find((entry) => entry.id === viewerCodeAreaFilter)?.label ??
                    'All code areas'}
                  <span className="dropdown-chevron">{viewerCodeAreaFilterOpen ? '▲' : '▼'}</span>
                </button>
                <div className={`filter-dropdown-panel ${viewerCodeAreaFilterOpen ? 'open' : ''}`} role="menu">
                  {VIEWER_CODE_AREA_FILTERS.map((option, index) => (
                    <div key={`viewer-code-area-option-${option.id}`}>
                      {index === 1 ? <div className="filter-dropdown-divider" /> : null}
                      <label className="filter-checkbox">
                        <input
                          type="checkbox"
                          checked={viewerCodeAreaFilter === option.id}
                          onChange={() => {
                            setViewerCodeAreaFilter(option.id);
                            setViewerCodeAreaFilterOpen(false);
                          }}
                        />
                        <span>{option.label}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {filterSeverity.length > 0 ? (
            <div className="filter-clear visible">
              <span>Active filter: {activeSeverityLabels.join(', ')}</span>
              <button type="button" className="btn btn-xs ghost" onClick={() => setFilterSeverity([])}>
                Clear filters
              </button>
            </div>
          ) : null}
          {findingViewFilter !== 'all' ? (
            <div className="filter-clear visible">
              <span>Type filter: {findingFilterLabelMap[findingViewFilter] ?? findingViewFilter}</span>
              <button type="button" className="btn btn-xs ghost" onClick={() => setFindingViewFilter('all')}>
                Clear
              </button>
            </div>
          ) : null}
          {viewerCodeAreaFilter !== 'all' ? (
            <div className="filter-clear visible">
              <span>
                Code area:{' '}
                {VIEWER_CODE_AREA_FILTERS.find((entry) => entry.id === viewerCodeAreaFilter)?.label ??
                  viewerCodeAreaFilter}
              </span>
              <button type="button" className="btn btn-xs ghost" onClick={() => setViewerCodeAreaFilter('all')}>
                Clear
              </button>
            </div>
          ) : null}
          {hiddenForActiveDocument > 0 ? (
            <div className="filter-hint">{hiddenForActiveDocument} findings hidden by filter.</div>
          ) : null}
          <div className="findings-list">
            {findingsForActiveDocument.length === 0 ? (
              <div className="empty-state-inline">
                <h4>
                  {findingViewFilter === 'all'
                    ? 'No findings currently mapped'
                    : `No ${findingFilterLabelMap[findingViewFilter] ?? 'matching'} findings in this section`}
                </h4>
                <p>
                  {findingViewFilter === 'all'
                    ? 'As processing evolves, this panel will populate with linked findings.'
                    : 'Change finding or code-area filters, or clear severity filters to restore the full list.'}
                </p>
              </div>
            ) : null}
            {findingsForActiveDocument.map((finding) => {
              const relatedDoc = documentsById.get(finding.documentId);
              const isActive = activeFindingId === finding.id;
              const isViewerFindingExpanded =
                expandedViewerFindingIds[finding.id] ??
                (finding.severity === 'critical' || finding.id === findingsForActiveDocument[0]?.id);
              const reviewState = findingDecisions[finding.id] ?? 'unreviewed';
              const noteEntry = findingNotes[finding.id];
              const noteText = typeof noteEntry === 'string' ? noteEntry : noteEntry?.text;
              const isLeadFinding = finding.severity === 'warning';
              const isInspectorAdded = !finding.reference;
              const reviewStatusLabel =
                reviewState === 'accepted'
                  ? 'Accepted'
                  : reviewState === 'rejected'
                    ? 'Rejected'
                    : reviewState === 'dismissed'
                      ? 'Dismissed'
                      : 'Unreviewed';
              const reviewStatusSymbol =
                reviewState === 'accepted'
                  ? '✓'
                  : reviewState === 'rejected'
                    ? '✕'
                    : reviewState === 'dismissed'
                      ? '◌'
                      : '○';
              const severityLabel =
                findingSeverityBadgeMap[finding.severity] ?? 'FINDING';
              const evidenceStrength =
                findingEvidenceStrengthMap[finding.severity] ?? {
                  key: 'supported',
                  label: 'Supported'
                };
              const evidencePassages = buildEvidencePassages(
                finding,
                relatedDoc?.label ?? 'Case document'
              );
              return (
                <article
                  key={finding.id}
                  ref={(node) => {
                    findingRefs.current[finding.id] = node || null;
                  }}
                  className={`finding-item severity-${finding.severity} ${isActive ? 'active' : ''} ${
                    isViewerFindingExpanded ? 'expanded' : ''
                  } ${isInspectorAdded ? 'inspector-added' : ''}`}
                  onClick={() => {
                    setActiveFindingId(finding.id);
                    if (finding.documentId === activeDocId) {
                      handleSelectDocBox(finding.boxId, { documentId: finding.documentId });
                    } else {
                      handleViewDocument(finding.documentId, finding.boxId, finding.id, STEP_OVERVIEW);
                    }
                  }}
                >
                  <div
                    className="finding-card-header viewer"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedViewerFindingIds((prev) => ({
                        ...prev,
                        [finding.id]: !isViewerFindingExpanded
                      }));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        setExpandedViewerFindingIds((prev) => ({
                          ...prev,
                          [finding.id]: !isViewerFindingExpanded
                        }));
                      }
                    }}
                  >
                    <div className="finding-card-content">
                      <div className="finding-title">
                        <span className={`finding-severity-label severity-${finding.severity}`}>
                          {severityLabel}
                        </span>{' '}
                        {safeText(finding.title, 'Finding')}
                        <span className="finding-expand-chev">{isViewerFindingExpanded ? '▾' : '▸'}</span>
                      </div>
                      <div className="finding-meta">
                        <span className="badge">{finding.id}</span>
                        {finding.reference ? (
                          <code>{formatReferenceText(finding.reference)}</code>
                        ) : null}
                        <span className={`evidence-badge ${evidenceStrength.key}`}>
                          {evidenceStrength.label}
                        </span>
                        <span className={`source-tag ${isInspectorAdded ? 'inspector' : 'system'}`}>
                          {finding.reference ? '⚙ System' : '👤 Inspector-added'}
                        </span>
                      </div>
                      <div className="review-status-wrap">
                        <span className={`review-status ${reviewState}`}>
                          {reviewStatusSymbol} {reviewStatusLabel}
                        </span>
                        {reviewState === 'unreviewed' ? <span className="new-badge">New</span> : null}
                        {RECURRING_FINDING_IDS.has(finding.id) ? (
                          <span
                            className="recurring-badge"
                            title={`Previously flagged on ${currentCaseMeta.previousInspection || 'prior inspection'}. Previous status: Open.`}
                          >
                            Previously flagged
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="finding-header-actions">
                      <button
                        type="button"
                        className="finding-more"
                        aria-label="More finding actions"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveMenuFindingId((prev) => (prev === finding.id ? null : finding.id));
                        }}
                      >
                        ⋮
                      </button>
                      {activeMenuFindingId === finding.id ? (
                        <div className="finding-menu" ref={findingMenuRef}>
                          {reviewState === 'dismissed' ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRequestFindingDecision(finding.id, null);
                              }}
                            >
                              Reopen lead
                            </button>
                          ) : null}
                          {reviewState === 'accepted' ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRequestFindingDecision(finding.id, 'rejected');
                              }}
                            >
                              Change decision
                            </button>
                          ) : null}
                          {reviewState === 'rejected' ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRequestFindingDecision(finding.id, 'accepted');
                              }}
                            >
                              Change decision
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenAddNote(finding.id);
                            }}
                          >
                            📝 Add note
                          </button>
                          {reviewState !== 'dismissed' ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRequestFindingDecision(finding.id, 'dismissed');
                              }}
                            >
                              Dismiss lead
                            </button>
                          ) : null}
                          {!finding.reference ? (
                            <button
                              type="button"
                              className="danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteFindingTargetId(finding.id);
                                setActiveMenuFindingId(null);
                              }}
                            >
                              Delete finding
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {isViewerFindingExpanded ? (
                  <>
                  {finding.reference ? (
                    <div className="finding-section">
                      <div className="finding-section-label">Regulatory requirement</div>
                      <div className="finding-quote">{formatReferenceText(finding.reference)}</div>
                    </div>
                  ) : null}
                  {isLeadFinding ? (
                    <div className="lead-sections">
                      <div className="lead-section">
                        <div className="lead-section-title">What was noticed</div>
                        <p>{safeText(finding.detail, 'Potential issue identified in current evidence.')}</p>
                      </div>
                      <div className="lead-section">
                        <div className="lead-section-title">Why this could not be confirmed</div>
                        <p>
                          Current uploaded material does not provide enough certainty to classify this as a confirmed
                          finding.
                        </p>
                      </div>
                      <div className="lead-section">
                        <div className="lead-section-title">Suggested action</div>
                        <p>
                          Request supporting documents or clarification from the practice and then confirm or dismiss.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="finding-section">
                      <div className="finding-section-label">What was found</div>
                      <p>{safeText(finding.detail, 'See linked document for further detail.')}</p>
                    </div>
                  )}
                  <div className="finding-section">
                    <div className="finding-section-label">Evidence</div>
                    {evidencePassages.length === 0 ? (
                      <div className="case-level-evidence">Case-level — no document evidence.</div>
                    ) : (
                      evidencePassages.map((passage) => (
                        <div key={`viewer-evidence-${finding.id}-${passage.id}`} className="evidence-block">
                          <div className="doc-ref">
                            📄 {passage.file}
                            {passage.page ? ` — page ${passage.page}` : ''}
                          </div>
                          {passage.excerpt ? <div className="excerpt">"{passage.excerpt}"</div> : null}
                          <div className="finding-extra-meta">
                            <span className={`source-tag ${isInspectorAdded ? 'inspector' : 'system'}`}>
                              {finding.reference ? 'System-generated' : 'Inspector-added'} ·{' '}
                              {safeText(passage.section, 'Case-level')}
                            </span>
                          </div>
                          {passage.documentId ? (
                            <span className="tooltip-wrap">
                              <button
                                type="button"
                                className="jump-link-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleViewDocument(
                                    passage.documentId,
                                    passage.boxId || finding.boxId,
                                    finding.id
                                  );
                                }}
                              >
                                <span className="jump-link">Jump to evidence</span>
                              </button>
                              <span className="tooltip-text">Jumps to highlighted passage</span>
                            </span>
                          ) : (
                            <div className="finding-extra-meta">
                              <span className="source-tag">Case-level evidence</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {finding.severity === 'warning' && reviewState === 'unreviewed' ? (
                    <div className="lead-sections-inline">
                      <p>
                        <strong>Potential lead:</strong> Evidence may indicate a gap and requires inspector
                        confirmation.
                      </p>
                      <button
                        type="button"
                        className="btn btn-xs primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleViewDocument(finding.documentId, finding.boxId, finding.id);
                        }}
                      >
                        Open Evidence Highlighter
                      </button>
                    </div>
                  ) : null}
                  {noteText ? (
                    <p className="finding-note">
                      Note: {noteText}
                      {typeof noteEntry === 'object' && noteEntry?.ts ? (
                        <span className="finding-note-meta">
                          {' '}
                          ({noteEntry.ts} - {noteEntry.actor ?? 'Inspector'})
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  <div className="finding-actions">
                    {isLeadFinding && reviewState === 'unreviewed' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-xs primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'accepted');
                          }}
                        >
                          Confirm as finding
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'dismissed');
                          }}
                        >
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-xs success"
                          disabled={reviewState === 'accepted'}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'accepted');
                          }}
                        >
                          {reviewState === 'accepted' ? '✓ Accepted' : '✓ Accept'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs ghost"
                          disabled={reviewState === 'rejected'}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestFindingDecision(finding.id, 'rejected');
                          }}
                        >
                          {reviewState === 'rejected' ? '✕ Rejected' : '✕ Reject'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn-xs ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenAddNote(finding.id);
                      }}
                    >
                      📝 Add note
                    </button>
                  </div>
                  {inlineRejectFindingId === finding.id ? (
                    <div className="inline-decision-form">
                      <label className="modal-label" htmlFor={`inline-reject-reason-${finding.id}`}>
                        Reason category (required)
                      </label>
                      <select
                        id={`inline-reject-reason-${finding.id}`}
                        className="modal-select"
                        value={inlineRejectReason}
                        onChange={(event) => setInlineRejectReason(event.target.value)}
                      >
                        {REVIEW_REASON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <label className="modal-label" htmlFor={`inline-reject-note-${finding.id}`}>
                        Note {inlineRejectReason === 'other' ? '(required)' : '(optional)'}
                      </label>
                      <textarea
                        id={`inline-reject-note-${finding.id}`}
                        className="modal-textarea"
                        value={inlineRejectNote}
                        onChange={(event) => setInlineRejectNote(event.target.value)}
                        placeholder="Add detail for this decision..."
                      />
                      <div className="modal-actions">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setInlineRejectFindingId(null);
                            setInlineRejectReason(REVIEW_REASON_OPTIONS[0].value);
                            setInlineRejectNote('');
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn primary"
                          disabled={inlineRejectReason === 'other' && !inlineRejectNote.trim()}
                          onClick={() => handleConfirmInlineReject(finding.id)}
                        >
                          Confirm rejection
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {inlineDismissFindingId === finding.id ? (
                    <div className="inline-decision-form">
                      <label className="modal-label" htmlFor={`inline-dismiss-reason-${finding.id}`}>
                        Reason for dismissal (required)
                      </label>
                      <select
                        id={`inline-dismiss-reason-${finding.id}`}
                        className="modal-select"
                        value={inlineDismissReason}
                        onChange={(event) => setInlineDismissReason(event.target.value)}
                      >
                        <option value="" disabled>
                          Select a dismissal reason
                        </option>
                        {REVIEW_REASON_OPTIONS.map((option) => (
                          <option key={`dismiss-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <label className="modal-label" htmlFor={`inline-dismiss-note-${finding.id}`}>
                        Details {inlineDismissReason === 'other' ? '(required)' : '(optional)'}
                      </label>
                      <textarea
                        id={`inline-dismiss-note-${finding.id}`}
                        className="modal-textarea"
                        value={inlineDismissNote}
                        onChange={(event) => setInlineDismissNote(event.target.value)}
                        placeholder="Add detail for this dismissal..."
                      />
                      <div className="modal-actions">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setInlineDismissFindingId(null);
                            setInlineDismissReason('');
                            setInlineDismissNote('');
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn primary"
                          disabled={!inlineDismissReason || (inlineDismissReason === 'other' && !inlineDismissNote.trim())}
                          onClick={() => handleConfirmInlineDismiss(finding.id)}
                        >
                          Confirm dismissal
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {noteTargetFindingId === finding.id ? (
                    <div className="inline-note-form">
                      <label className="modal-label" htmlFor={`inline-note-${finding.id}`}>
                        Add note
                      </label>
                      <textarea
                        id={`inline-note-${finding.id}`}
                        className="modal-textarea"
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        placeholder="Enter observation..."
                      />
                      <div className="modal-actions">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setNoteTargetFindingId(null);
                            setNoteDraft('');
                          }}
                        >
                          Cancel
                        </button>
                        <button type="button" className="btn primary" onClick={handleSaveFindingNote}>
                          Save note
                        </button>
                      </div>
                    </div>
                  ) : null}
                  </>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </>
    );
  };

  const renderDocumentsLifecycleWorkspace = () => {
    const classificationOptions = [
      'Unknown',
      'AML Policy',
      'Bank Statement',
      'CDD Records',
      'Training Register',
      'Interview Transcript',
      'Complaints Procedure',
      'Fee Estimate',
      'Source of Funds Declaration',
      'Website Evidence',
      'Other'
    ];

    const resolveConfidenceState = (value) => {
      const normalized = String(value ?? '').trim().toLowerCase();
      if (normalized === 'high') return 'verified';
      if (normalized === 'medium') return 'reviewing';
      return 'attention';
    };

    const resolveLinkedDocumentId = (uploadItem) => {
      const uploadKeys = buildUploadLookupKeys(uploadItem);
      if (uploadKeys.size === 0) return '';
      const linked = documentRows.find(
        (row) => [...buildFilenameKeySet([row.id, row.filename, row.label])].some((key) => uploadKeys.has(key))
      );
      return linked?.id ?? '';
    };

    const processingEntries =
      processingLog.length > 0
        ? processingLog
        : [
            {
              id: 'p-empty',
              detail: 'No processing runs logged yet.',
              time: '--:--'
            }
          ];

    return (
      <div className="docs-wireframe">
        <input
          ref={documentsUploadInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="visually-hidden"
          onChange={handleUploadFileSelection}
        />
        <div className="docs-wireframe-phase-switch">
          {DOCUMENT_PHASE_OPTIONS.map((phase) => (
            <label key={phase.id} className="docs-phase-radio">
              <input
                type="radio"
                name="documents-phase"
                checked={documentsPhase === phase.id}
                onChange={() => setDocumentsPhase(phase.id)}
              />
              {phase.label}
            </label>
          ))}
        </div>

        {documentsPhase === 'upload' ? (
          <div className="docs-wireframe-phase">
            {uploadAreaCollapsed ? (
              <button
                type="button"
                className="upload-collapsed"
                onClick={() => setUploadAreaCollapsed(false)}
              >
                + Add more documents
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
                <div className="docs-wireframe-upload-actions">
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
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      setUploadAreaCollapsed(true);
                    }}
                  >
                    Collapse
                  </button>
                </div>
              </div>
            )}

            <div className="section-heading">
              <h2>
                Uploaded Documents{' '}
                <span className="docs-count-inline">({uploadItems.length})</span>
              </h2>
            </div>

            {uploadItems.length === 0 ? (
              <div className="empty-state-inline">
                <h4>No uploads queued</h4>
                <p>Add documents to begin classification and verification.</p>
              </div>
            ) : (
              <table className="table docs-wire-table docs-wire-table--phase-one">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>✓</th>
                    <th>Name</th>
                    <th>Classification</th>
                    <th>Parties</th>
                    <th style={{ width: '100px' }}>Confidence</th>
                    <th style={{ width: '90px' }}>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadItems.flatMap((item) => {
                    const classification = textOf(item.classification, 'Unknown') || 'Unknown';
                    const isClassifying = item.status === 'queued';
                    const isUnknown = classification === 'Unknown';
                    const isVerified = item.status === 'verified';
                    const showSummary = expandedUploadSummaryId === item.id && textOf(item.summary, '');
                    const linkedDocumentId = resolveLinkedDocumentId(item);
                    const confidenceState = resolveConfidenceState(item.confidence);
                    const parties = textOf(item.parties, '')
                      .split(',')
                      .map((entry) => entry.trim())
                      .filter(Boolean);
                    const rowClassName = [
                      !isVerified ? 'row-amber' : '',
                      isUnknown ? 'row-warning' : '',
                      isClassifying ? 'row-classifying' : ''
                    ]
                      .filter(Boolean)
                      .join(' ');

                    const rows = [
                      <tr key={`upload-row-${item.id}`} className={rowClassName}>
                        <td>
                          {isClassifying ? (
                            <span className="doc-status-icon classifying" title="Classifying...">
                              —
                            </span>
                          ) : (
                            <button
                              type="button"
                              className={`doc-status-icon ${isVerified ? 'confirmed' : 'unconfirmed'}`}
                              onClick={() => handleToggleUploadConfirmed(item.id)}
                              title={
                                isUnknown
                                  ? 'Select classification first'
                                  : isVerified
                                    ? 'Click to unconfirm'
                                    : 'Click to confirm'
                              }
                              disabled={isUnknown}
                            >
                              {isVerified ? '✓' : '○'}
                            </button>
                          )}
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {item.summary ? (
                            <button
                              type="button"
                              className="summary-toggle-inline"
                              onClick={() =>
                                setExpandedUploadSummaryId((prev) => (prev === item.id ? '' : item.id))
                              }
                            >
                              {showSummary ? '▼' : '▶'}
                            </button>
                          ) : null}
                          {linkedDocumentId ? (
                            <button
                              type="button"
                              className="table-link-btn"
                              onClick={() => handleViewDocument(linkedDocumentId, null, null, STEP_DOCUMENTS)}
                            >
                              {item.name}
                            </button>
                          ) : (
                            item.name
                          )}
                        </td>
                        <td>
                          {isClassifying ? (
                            <span className="classifying-text">
                              <span className="spinner" />
                              Classifying...
                            </span>
                          ) : (
                            <span className={isUnknown ? 'classification-warning' : ''}>
                              {isUnknown ? <span className="warn-icon">⚠</span> : null}
                              <select
                                className={`classification-select ${isUnknown ? 'is-warning' : ''}`}
                                value={classification}
                                onChange={(event) =>
                                  handleUploadFieldChange(item.id, 'classification', event.target.value)
                                }
                              >
                                {classificationOptions.map((option) => (
                                  <option key={`${item.id}-classification-${option}`} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </span>
                          )}
                        </td>
                        <td>
                          {isClassifying ? (
                            <span className="dash-muted">—</span>
                          ) : (
                            <div className="party-chip-row">
                              {parties.length > 0
                                ? parties.map((party, index) => (
                                    <span key={`${item.id}-party-${party}-${index}`} className="party-chip">
                                      {party}
                                      <button
                                        type="button"
                                        className="chip-remove"
                                        onClick={() => {
                                          const nextParties = parties.filter((_, rowIndex) => rowIndex !== index);
                                          handleUploadFieldChange(
                                            item.id,
                                            'parties',
                                            nextParties.join(', ')
                                          );
                                        }}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))
                                : null}
                              <button
                                type="button"
                                className="party-chip party-add"
                                onClick={() => {
                                  const base = parties.join(', ');
                                  const next = base ? `${base}, Additional party` : 'Additional party';
                                  handleUploadFieldChange(item.id, 'parties', next);
                                }}
                              >
                                + Add
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          {isClassifying || isUnknown ? (
                            <span className="dash-muted">—</span>
                          ) : (
                            renderConfidenceDots(confidenceState)
                          )}
                        </td>
                        <td>
                          {formatShortDisplayDate(
                            item.addedOn ?? currentCaseMeta.started ?? toIsoDate(new Date())
                          )}
                        </td>
                      </tr>
                    ];

                    if (showSummary) {
                      rows.push(
                        <tr key={`upload-summary-${item.id}`} className="summary-row">
                          <td colSpan={6}>
                            <div className="summary-block">{item.summary}</div>
                          </td>
                        </tr>
                      );
                    }

                    return rows;
                  })}
                </tbody>
              </table>
            )}

            <div className="warning-messages">
              {unclassifiedUploadCount > 0 ? (
                <div className="warning-line amber">
                  ⚠ {unclassifiedUploadCount} document
                  {unclassifiedUploadCount === 1 ? '' : 's'} need classification correction
                </div>
              ) : null}
              <div className="warning-line muted">
                ○ {unverifiedUploadCount} document{unverifiedUploadCount === 1 ? '' : 's'} not yet confirmed
              </div>
            </div>

            <div className="bottom-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={confirmableUploadCount === 0}
                onClick={handleConfirmAllUploads}
                title="Confirm all classified rows"
              >
                Confirm all remaining ({confirmableUploadCount})
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!allUploadsVerified}
                onClick={handleGenerateFindings}
                title="All documents must be classified and confirmed before generating findings."
              >
                Generate findings
              </button>
            </div>

            <section className="docs-processing-log">
              <h4>Processing Log</h4>
              {processingEntries.map((entry) => {
                const isInitial = /initial/i.test(entry.detail);
                return (
                  <div key={`phase1-log-${entry.id}`} className="log-entry">
                    <div className={`log-dot ${isInitial ? 'dot-process' : 'dot-update'}`} />
                    <div className="log-text">{entry.detail}</div>
                    <div className="log-time">{entry.time}</div>
                  </div>
                );
              })}
            </section>
          </div>
        ) : (
          <div className="docs-wireframe-phase">
            <div className="section-heading">
              <h2>
                Documents <span className="docs-count-inline">({documentRows.length})</span>
              </h2>
              <div className="section-heading-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDocumentsPhase('upload')}
                >
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
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        <button
                          type="button"
                          className="table-link-btn"
                          onClick={() => handleViewDocument(row.id, null, null, STEP_DOCUMENTS)}
                        >
                          {row.label}
                        </button>
                      </td>
                      <td>{row.classification}</td>
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

            <div className={`expandable-section ${documentsNotesExpanded ? 'expanded' : ''}`}>
              <button
                type="button"
                className="expandable-header"
                onClick={() => setDocumentsNotesExpanded((prev) => !prev)}
              >
                <span className="expandable-chevron">▶</span>
                Document Notes{' '}
                <span className="docs-count-inline">({flattenedDocumentNotes.length})</span>
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
        )}
      </div>
    );
  };

  const renderReggieAssistantWorkspace = () => (
    <section className="panel docs-search-panel">
      <h3>Cross-Document Search</h3>
      <p className="panel-subtitle">
        Regulatory Guidance &amp; Inspection Engine.
      </p>
      <div className="docs-edge-controls">
        <span className="review-pill dismissed">Scope: {reggieScope === 'document' ? 'This document' : 'All documents'}</span>
        <button type="button" className="btn btn-xs ghost" onClick={() => openReggie('all')}>
          Open panel
        </button>
      </div>
      <input
        className="docs-search-input"
        type="text"
        value={docSearchQuery}
        onChange={(event) => setDocSearchQuery(event.target.value)}
        placeholder="Quick search (still available): source of funds, sanctions..."
      />
      {!docSearchQuery.trim() ? (
        <div className="empty-state-inline">
          <h4>I can help you explore this case</h4>
          <p>Use Reggie for guidance or type keywords for direct evidence hits.</p>
        </div>
      ) : filteredCrossDocResults.length === 0 ? (
        <div className="empty-state-inline">
          <h4>No search matches</h4>
          <p>Try broader terms or ask Reggie to suggest alternative phrasing.</p>
        </div>
      ) : (
        <div className="docs-search-results">
          {filteredCrossDocResults.map((finding) => {
            const relatedDoc = documentsById.get(finding.documentId);
            return (
              <div key={finding.id} className="docs-search-result">
                <div className="docs-search-result__meta">
                  <span className="badge">{finding.id}</span>
                  <span className="muted">{relatedDoc?.label ?? 'Document'}</span>
                </div>
                <strong>{safeText(finding.title, 'Finding')}</strong>
                <p>{safeText(finding.detail, '')}</p>
                {finding.source ? (
                  <p className="finding-doc-ref">{formatSourceDocumentRef(finding.source)}</p>
                ) : null}
                <div className="search-result-actions">
                  <button
                    type="button"
                    className="btn btn-xs secondary"
                    onClick={() => {
                      handleViewDocument(
                        finding.documentId,
                        finding.boxId,
                        finding.id,
                        STEP_DOCUMENTS
                      );
                      setDocumentWorkspaceTab('findings');
                    }}
                  >
                    Jump to passage
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs ghost"
                    onClick={() => handleOpenAddNote(finding.id, safeText(finding.detail, ''))}
                  >
                    📝 Add as finding note
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderCaseHeader = () => {
    if (currentStep < 1) return null;
    const openFindings = allFindings.filter((finding) => !findingDecisions[finding.id]).length;
    const totalDocumentsCount = caseDocuments.length;
    const dataSourceLabel = isActiveCasePersisted ? 'Firestore' : 'Draft';
    const caseTabCounts = {
      overview: pendingReviewCount,
      documents: totalDocumentsCount
    };
    return (
      <section className="case-header">
        <div className="case-header__top">
          <div>
            <h2 className="case-header__title">{currentCaseMeta.practiceName}</h2>
            <p className="case-header__meta">
              <code>{currentCaseMeta.caseId}</code> • Risk: {renderRiskDots(currentCaseMeta.riskLevel)} {currentCaseMeta.riskLevel} • Previous:{' '}
              {currentCaseMeta.previousInspection}
            </p>
            <p className="case-header__meta">
              HoLP: {currentCaseMeta.holp} • HoFA: {currentCaseMeta.hofa} • Inspector: {currentCaseMeta.owner}
            </p>
          </div>
          <div className="case-header__stats">
            <span>{openFindings} unreviewed findings</span>
            <span className="panel-subtitle">Data: {dataSourceLabel}</span>
            {currentStep === STEP_VIEWER ? (
              <button
                type="button"
                className="btn btn-xs ghost"
                onClick={() => {
                  setDocumentWorkspaceTab('search');
                  openReggie('all');
                }}
              >
                🔍 Search
              </button>
            ) : null}
          </div>
        </div>
        {pendingReprocessSummary && !reprocessBannerDismissed ? (
          <div className="reprocess-indicator">
            <span>
              Unprocessed changes pending: {pendingReprocessSummary}. Reprocess when ready.
            </span>
            <button
              type="button"
              className="btn btn-xs secondary"
              onClick={() => {
                setReprocessBannerDismissed(true);
                setDocumentWorkspaceTab('lifecycle');
                setDocsMarkedForReprocess({});
                setReportPendingChanges(false);
                setProcessingLog((prev) => [
                  {
                    id: `p${Date.now()}-reprocess`,
                    detail: `Reprocess started (${pendingReprocessSummary})`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  },
                  ...prev
                ]);
                setHistoryItems((items) => [
                  {
                    id: `h${Date.now()}`,
                    ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    detail: `Reprocess requested (${pendingReprocessSummary})`,
                    actor: currentUserEmail || 'Inspector'
                  },
                  ...items
                ]);
                setAnalysisProgress(8);
                setAnalysisRunning(true);
                setCurrentStep(STEP_PROCESSING);
              }}
            >
              Reprocess now
            </button>
          </div>
        ) : null}
        <div className="case-header__tabs" role="tablist" aria-label="Case views">
          {CASE_TABS.map((tab) => {
            const isActive = activeCaseTabId === tab.id;
            const isUnlocked = tab.step <= maxStepUnlocked;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className={`case-tab${isActive ? ' active' : ''}`}
                aria-selected={isActive}
                disabled={!isUnlocked}
                onClick={() => handleCaseTabNavigate(tab.step)}
              >
                {tab.label}
                {Object.prototype.hasOwnProperty.call(caseTabCounts, tab.id) ? (
                  <span className="case-tab-count">({caseTabCounts[tab.id]})</span>
                ) : null}
                {tab.id === 'report' && reportStale && !isActive ? <span className="stale-dot" /> : null}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const renderOverviewWorkspace = () => (
    <div className="stage-card">
      {caseDocuments.length === 0 ? (
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon">🗂️</div>
          <h3>No documents uploaded yet</h3>
          <p>Upload and verify documents to generate findings and populate the Overview.</p>
          <button type="button" className="btn btn-xs secondary" onClick={() => setCurrentStep(STEP_DOCUMENTS)}>
            Go to Documents
          </button>
        </div>
      ) : null}
      {caseDocuments.length > 0 ? (
      <>
      <div className="summary-grid">
        {severityCounts.map((item) => (
          <button
            key={`overview-${item.id}`}
            type="button"
            className={`summary-card severity-${item.id}`}
            onClick={() =>
              setFindingViewFilter(
                item.id === 'critical'
                  ? 'non_compliant'
                  : item.id === 'warning'
                    ? 'leads'
                    : item.id === 'pass'
                      ? 'compliant'
                      : item.id === 'best_practice'
                        ? 'good_practice'
                        : 'all'
              )
            }
          >
            <span className="summary-label">
              {item.id === 'warning'
                ? 'Leads'
                : item.id === 'pass'
                  ? 'Compliant'
                  : item.id === 'best_practice'
                    ? 'Good Practice'
                    : item.label}
            </span>
            <strong className="summary-value">{item.id === 'pass' ? metRequirementsCount : item.count}</strong>
            <span className="summary-helper">{summaryCardDetailMap[item.id] ?? 'documents'}</span>
          </button>
        ))}
      </div>
      {renderComplianceByCodeArea()}
      <div className="action-bar">
        <button type="button" className="btn ghost" onClick={() => setCurrentStep(STEP_DOCUMENTS)}>
          ← Back to Documents
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => setCurrentStep(STEP_REPORT)}
          disabled={!activeDocId || caseDocuments.length === 0}
        >
          Go to Report →
        </button>
      </div>
      </>
      ) : null}
    </div>
  );

  const renderProcessingWorkspace = () => (
    <div className="stage-card processing">
      <div className="processing-icon" aria-hidden="true">
        ⚙
      </div>
      <div>
        <h2>AI Processing in progress</h2>
        <p className="panel-subtitle">{analysisMessage}</p>
      </div>
      <div className="progress-bar-wrapper" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(analysisProgress)}>
        <div className="progress-bar-fill" style={{ width: `${Math.min(100, Math.max(0, analysisProgress))}%` }} />
      </div>
      <p className="progress-status">{Math.round(analysisProgress)}% complete</p>
      {renderProgressSteps(AI_PROCESSING_STEPS, analysisStageIndex)}
      <p className="panel-subtitle">You will be taken to Overview automatically once processing completes.</p>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case STEP_DOCUMENTS:
        return (
          <div className="stage-card">
            {renderDocumentsLifecycleWorkspace()}
          </div>
        );
      case STEP_PROCESSING:
        return renderProcessingWorkspace();
      case STEP_OVERVIEW:
        return renderOverviewWorkspace();
      case STEP_VIEWER:
        return (
          <div className="stage-card doc-viewer-stage">
            {renderFindingsWorkspace()}
          </div>
        );
      case STEP_HISTORY:
        return (
          <div className="stage-card">
            {reportPendingChanges ? (
              <div className="reprocess-indicator">
                <span>
                  ⚠ Unprocessed changes pending
                  {pendingReprocessSummary ? ` — ${pendingReprocessSummary}` : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-xs secondary"
                  onClick={() => {
                    setAnalysisProgress(8);
                    setAnalysisRunning(true);
                    setCurrentStep(STEP_PROCESSING);
                  }}
                >
                  Reprocess now
                </button>
              </div>
            ) : null}
            <h2>Case History</h2>
            <p className="panel-subtitle">
              Timeline of processing and inspector actions for this case.
            </p>
            {historyItems.length === 0 ? (
              <div className="edge-empty-card">
                <div className="edge-empty-card__icon">📋</div>
                <h3>Building your inspection history.</h3>
                <p>This is the first recorded inspection for this practice in-system.</p>
                <p className="panel-subtitle">
                  Previous inspection: {currentCaseMeta.previousInspection || 'Not recorded'}
                </p>
                <ul className="history-coming-list">
                  <li>Side-by-side compliance trend comparison</li>
                  <li>Recurring issue detection across inspections</li>
                  <li>Resolution tracking for action plan items</li>
                  <li>Cross-year timeline activity view</li>
                </ul>
              </div>
            ) : null}
            {historyItems.length > 0 ? (
            <>
              <section className="panel history-trend-card">
                <h3>Compliance trend by code area</h3>
                {historyTrendRows.length === 0 ? (
                  <p className="panel-subtitle">No code area trends yet. Run processing to populate this view.</p>
                ) : (
                  historyTrendRows.map((row) => (
                    <div key={`history-trend-${row.id}`} className="history-trend-row">
                      <span>{row.name}</span>
                      <span className="panel-subtitle">{row.summary}</span>
                      <span className={`review-pill ${row.trendClass}`}>{row.trendLabel}</span>
                    </div>
                  ))
                )}
              </section>
              <section className="panel history-trend-card">
                <h3>Previous findings tracking</h3>
                <div className="docs-table">
                  <div className="docs-table__row docs-table__row--head">
                    <span>Finding</span>
                    <span>Code Area</span>
                    <span>Severity</span>
                    <span>Resolution</span>
                    <span>Pattern</span>
                  </div>
                  {historyFindingsRows.length === 0 ? (
                    <div className="docs-table__row">
                      <span>No findings tracked yet</span>
                      <span>—</span>
                      <span>—</span>
                      <span>—</span>
                      <span>—</span>
                    </div>
                  ) : (
                    historyFindingsRows.map((row) => (
                      <div key={`history-row-${row.id}`} className="docs-table__row">
                        <span>{row.title}</span>
                        <span>{row.codeArea}</span>
                        <span
                          className={`review-pill ${
                            row.severity === 'Critical'
                              ? 'rejected'
                              : row.severity === 'Guidance'
                                ? 'dismissed'
                                : 'accepted'
                          }`}
                        >
                          {row.severity}
                        </span>
                        <span
                          className={`review-pill ${
                            row.resolution === 'Accepted'
                              ? 'accepted'
                              : row.resolution === 'Rejected'
                                ? 'rejected'
                                : row.resolution === 'Dismissed'
                                  ? 'dismissed'
                                  : 'pending'
                          }`}
                        >
                          {row.resolution}
                        </span>
                        <span className={row.recurring ? 'recurring-badge' : 'panel-subtitle'}>
                          {row.recurring ? 'Recurring' : '—'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
              <section className="panel history-trend-card">
                <h3>Last inspection summary</h3>
                <div className="history-summary-grid">
                  <div>
                    <span className="history-summary-label">Date</span>
                    <strong>{currentCaseMeta.previousInspection || 'Not recorded'}</strong>
                  </div>
                  <div>
                    <span className="history-summary-label">Outcome</span>
                    <strong>{formatOutcomeLabel(currentCaseOutcome)}</strong>
                  </div>
                  <div>
                    <span className="history-summary-label">Actions completed</span>
                    <strong>{reviewedCount} / {Math.max(availableFindings.length, 1)}</strong>
                  </div>
                  <div>
                    <span className="history-summary-label">Recurring findings</span>
                    <strong>{recurringFindingCount}</strong>
                  </div>
                </div>
              </section>
              <div className="history-list">
                {historyItems.map((item) => (
                  <div key={item.id} className="history-item">
                    <span className="history-time">{item.ts}</span>
                    <div>
                      <p className="history-detail">{item.detail}</p>
                      <p className="history-actor">{item.actor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
            ) : null}
            <div className="action-bar">
              <button type="button" className="btn ghost" onClick={() => setCurrentStep(STEP_OVERVIEW)}>
                ← Back to Overview
              </button>
              <button type="button" className="btn primary" onClick={() => setCurrentStep(STEP_REPORT)}>
                Open Report →
              </button>
            </div>
          </div>
        );
      case STEP_REPORT:
        return (
          <div className="stage-card report-stage">
            <p className="panel-subtitle">Review status and export inspection outputs.</p>
            {availableFindings.length === 0 ? (
              <div className="edge-empty-card">
                <div className="edge-empty-card__icon">📃</div>
                <h3>No report yet</h3>
                <p>
                  Generate findings from your documents first.
                  <br />
                  The report will be assembled from your reviewed findings.
                </p>
                <p className="empty-state-list-title">What the report will include:</p>
                <ul className="empty-state-list compact">
                  <li>Practice details and inspection context</li>
                  <li>Summary of compliance posture</li>
                  <li>Areas of good practice</li>
                  <li>Areas requiring attention and actions</li>
                  <li>Action plan with deadlines</li>
                </ul>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setCurrentStep(STEP_DOCUMENTS);
                    setDocumentWorkspaceTab('lifecycle');
                  }}
                >
                  Go to Documents tab
                </button>
              </div>
            ) : (
              <>
                {reportPendingChanges ? (
                  <div className="alert-banner warning">
                    There are unprocessed changes from recent document updates.
                    <div className="alert-inline-actions">
                      <button
                        type="button"
                        className="btn btn-xs secondary"
                        onClick={() => setReportPendingGateOpen(true)}
                      >
                        Generate from current findings
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs primary"
                        onClick={() => setReportPendingGateOpen(true)}
                      >
                        Reprocess findings first
                      </button>
                    </div>
                  </div>
                ) : null}
                {reportStale ? (
                  <div className="alert-banner warning">
                    <span>⚠</span> Findings updated since last report generation.
                    <button
                      type="button"
                      className="btn btn-xs primary"
                      onClick={() => setReportRegenerateConfirmOpen(true)}
                    >
                      Regenerate
                    </button>
                  </div>
                ) : null}
                <div className="report-export-row">
                  <button type="button" className="btn primary" onClick={handleExportReport}>
                    Export PDF
                  </button>
                </div>
                <div className="report-card">
                  <div className="report-card-header">
                    <img src={`${assetBase}assets/clc_logo.png`} alt="CLC" />
                    <div>
                      <p className="report-card-header-title">Council for Licensed Conveyancers</p>
                      <p className="report-card-header-subtitle">Inspection Report</p>
                    </div>
                  </div>
              <section
                  key={`report-draft-${reportDraftVersion}`}
                  className="report-structured-panel"
                >
                  <div className="report-section report-section-block">
                    <div className="report-section-head">
                      <h4>1. Practice Details</h4>
                    </div>
                  </div>
                  <div className="report-structured-grid">
                    <div>
                      <label className="modal-label">Practice</label>
                      <p contentEditable suppressContentEditableWarning className="report-editable">
                        {currentCaseMeta.practiceName}
                      </p>
                    </div>
                    <div>
                      <label className="modal-label">Licence</label>
                      <p contentEditable suppressContentEditableWarning className="report-editable">
                        {currentCaseMeta.caseId}
                      </p>
                    </div>
                    <div>
                      <label className="modal-label">Head of Legal Practice</label>
                      <p contentEditable suppressContentEditableWarning className="report-editable">
                        {currentCaseMeta.holp}
                      </p>
                    </div>
                    <div>
                      <label className="modal-label">Head of Finance &amp; Admin</label>
                      <p contentEditable suppressContentEditableWarning className="report-editable">
                        {currentCaseMeta.hofa}
                      </p>
                    </div>
                    <div>
                      <label className="modal-label">Inspection type</label>
                      <p contentEditable suppressContentEditableWarning className="report-editable">
                        {reportInspectionType}
                      </p>
                    </div>
                    <div>
                      <label className="modal-label">Date</label>
                      <p contentEditable suppressContentEditableWarning className="report-editable">
                        {currentCaseMeta.started}
                      </p>
                    </div>
                    <div>
                      <label className="modal-label">Inspector</label>
                      <p contentEditable suppressContentEditableWarning className="report-editable">
                        {currentCaseMeta.owner}
                      </p>
                    </div>
                  </div>
                  <div className={`report-section report-section-block ${editedReportSections.interviews ? 'edited' : ''}`}>
                    <div className={`report-section-head ${editedReportSections.interviews ? 'edited' : ''}`}>
                      <h4>2. Interviews Conducted</h4>
                      <button
                        type="button"
                        className="btn-revert"
                        onClick={() => handleRevertReportSection('interviews')}
                      >
                        ↻ Revert section
                      </button>
                    </div>
                    {reportSectionDefaults.interviews.map((line, index) => (
                      <p
                        key={`report-interview-${index}`}
                        className="report-editable"
                        ref={(node) => setReportEditableRef('interviews', index, node)}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={() =>
                          setEditedReportSections((prev) => ({ ...prev, interviews: true }))
                        }
                      >
                        {line}
                      </p>
                    ))}
                    <p className="panel-subtitle">(auto-populated from upload metadata and observation sources)</p>
                  </div>
                  <div className={`report-section report-section-block ${editedReportSections.summary ? 'edited' : ''}`}>
                    <div className={`report-section-head ${editedReportSections.summary ? 'edited' : ''}`}>
                      <h4>3. Compliance Summary</h4>
                      <button
                        type="button"
                        className="btn-revert"
                        onClick={() => handleRevertReportSection('summary')}
                      >
                        ↻ Revert section
                      </button>
                    </div>
                    <p
                      ref={(node) => setReportEditableRef('summary', 0, node)}
                      contentEditable
                      suppressContentEditableWarning
                      className="report-editable"
                      onInput={() => setEditedReportSections((prev) => ({ ...prev, summary: true }))}
                    >
                      {reportSectionDefaults.summary[0]}
                    </p>
                  </div>
                  <div className={`report-section report-section-block ${editedReportSections.goodPractice ? 'edited' : ''}`}>
                    <div className={`report-section-head ${editedReportSections.goodPractice ? 'edited' : ''}`}>
                      <h4>4. Areas of Good Practice</h4>
                      <button
                        type="button"
                        className="btn-revert"
                        onClick={() => handleRevertReportSection('goodPractice')}
                      >
                        ↻ Revert section
                      </button>
                    </div>
                    {reportGoodPracticeFindings.length === 0 ? (
                      <p
                        ref={(node) => setReportEditableRef('goodPractice', 0, node)}
                        contentEditable
                        suppressContentEditableWarning
                        className="report-editable"
                        onInput={() =>
                          setEditedReportSections((prev) => ({ ...prev, goodPractice: true }))
                        }
                      >
                        {reportSectionDefaults.goodPractice[0]}
                      </p>
                    ) : (
                      reportGoodPracticeFindings.slice(0, 4).map((finding, index) => (
                        <div key={`report-good-${finding.id}`} className="finding-subsection">
                          <p className="report-subheading">
                            {safeText(finding.title, 'Good practice')}
                            <span className="finding-code-ref">
                              {' '}
                              ({formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General'))})
                            </span>
                          </p>
                          <p
                            ref={(node) => setReportEditableRef('goodPractice', index, node)}
                            contentEditable
                            suppressContentEditableWarning
                            className="report-editable"
                            onInput={() =>
                              setEditedReportSections((prev) => ({ ...prev, goodPractice: true }))
                            }
                          >
                            {safeText(finding.detail, safeText(finding.title, 'Good practice finding'))}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className={`report-section report-section-block ${editedReportSections.attention ? 'edited' : ''}`}>
                    <div className={`report-section-head ${editedReportSections.attention ? 'edited' : ''}`}>
                      <h4>5. Areas Requiring Attention</h4>
                      <button
                        type="button"
                        className="btn-revert"
                        onClick={() => handleRevertReportSection('attention')}
                      >
                        ↻ Revert section
                      </button>
                    </div>
                    {reportAttentionFindings.length === 0 ? (
                      <p
                        ref={(node) => setReportEditableRef('attention', 0, node)}
                        contentEditable
                        suppressContentEditableWarning
                        className="report-editable"
                        onInput={() => setEditedReportSections((prev) => ({ ...prev, attention: true }))}
                      >
                        {reportSectionDefaults.attention[0]}
                      </p>
                    ) : (
                      reportAttentionFindings.slice(0, 8).map((finding, index) => {
                        const passages = buildEvidencePassages(finding).slice(0, 3);
                        return (
                          <div key={`report-attn-${finding.id}`}>
                            <p className="report-subheading">
                              {formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General'))}
                            </p>
                            <p
                              ref={(node) => setReportEditableRef('attention', index, node)}
                              contentEditable
                              suppressContentEditableWarning
                              className="report-editable"
                              onInput={() =>
                                setEditedReportSections((prev) => ({ ...prev, attention: true }))
                              }
                            >
                              {safeText(finding.detail, safeText(finding.title, 'Attention finding'))}
                            </p>
                            {passages.length > 0 ? (
                              <p className="report-evidence-links">
                                Evidence refs:{' '}
                                {passages.map((passage, passageIndex) => (
                                  <span key={`report-ev-${finding.id}-${passage.id}`} className="tooltip-wrap">
                                    <button
                                      type="button"
                                      className="inline-link-btn"
                                      onClick={() => handleJumpToEvidencePassage(finding, passage)}
                                      title="Opens Document Viewer"
                                    >
                                      {safeText(passage.file, 'Case document')}
                                      {safeText(passage.page, '') ? ` p.${safeText(passage.page, '')}` : ''}
                                    </button>
                                    <span className="tooltip-text">Opens Document Viewer</span>
                                    {passageIndex < passages.length - 1 ? ' · ' : ''}
                                  </span>
                                ))}
                              </p>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
                <section className="report-section report-action-plan">
                  <div className="report-section-head">
                    <h3>6. Action Plan</h3>
                    <button
                      type="button"
                      className="btn-revert"
                      onClick={() => setReportActionItems(reportActionDefaults.map((item) => ({ ...item })))}
                    >
                      ↻ Revert section
                    </button>
                  </div>
                  <div className="docs-table">
                    <div className="docs-table__row docs-table__row--head">
                      <span aria-hidden="true" />
                      <span>Action</span>
                      <span>Code Area</span>
                      <span>Deadline ℹ</span>
                      <span>Person</span>
                    </div>
                    {reportActionItems.map((item) => (
                      <div key={item.id} className="docs-table__row report-action-row">
                        <span className="report-action-row-handle" title="Reorder action">
                          ≡
                        </span>
                        <span
                          className="report-editable inline"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(event) =>
                            setReportActionItems((prev) =>
                              prev.map((entry) =>
                                entry.id === item.id
                                  ? { ...entry, action: event.currentTarget.textContent || entry.action }
                                  : entry
                              )
                            )
                          }
                        >
                          {item.action}
                        </span>
                        <span>{item.codeArea}</span>
                        <span>
                          <input
                            className="docs-inline-input"
                            type="date"
                            value={/^\d{4}-\d{2}-\d{2}$/.test(item.deadline) ? item.deadline : ''}
                            onChange={(event) =>
                              setReportActionItems((prev) =>
                                prev.map((entry) =>
                                  entry.id === item.id
                                    ? { ...entry, deadline: event.target.value || 'TBD' }
                                    : entry
                                )
                              )
                            }
                          />
                        </span>
                        <span>
                          <input
                            className="docs-inline-input"
                            type="text"
                            placeholder="Assign..."
                            value={item.person}
                            onChange={(event) =>
                              setReportActionItems((prev) =>
                                prev.map((entry) =>
                                  entry.id === item.id ? { ...entry, person: event.target.value } : entry
                                )
                              )
                            }
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-xs secondary report-add-action-btn"
                    onClick={() =>
                      setReportActionItems((prev) => [
                        ...prev,
                        {
                          id: `ra-${Date.now()}`,
                          action: 'New action item',
                          codeArea: reportCodeAreaSummaries[0]?.name ?? 'General',
                          deadline: 'TBD',
                          person: ''
                        }
                      ])
                    }
                  >
                    + Add action
                  </button>
                </section>
                {caseContextNotes.length > 0 ? (
                  <section className="report-context-section">
                    <h3>Case Context Notes</h3>
                    <ul>
                      {caseContextNotes.slice(0, 6).map((note) => (
                        <li key={`report-context-${note.id}`}>
                          {note.text}
                          <span className="panel-subtitle"> ({note.ts} - {note.actor})</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {inspectorObservations.length > 0 ? (
                  <section className="report-observations-section">
                    <h3>Inspector Observations</h3>
                    <ul>
                      {inspectorObservations.slice(0, 5).map((obs) => (
                        <li key={`report-obs-${obs.id}`}>
                          <strong>{obs.requirement}:</strong> {obs.text}
                          <span className="panel-subtitle"> ({obs.sourceType} · {obs.ts})</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                <section className="report-section report-code-area-summary">
                  <div className="report-section-head">
                    <h3>7. Appendix — Detailed Findings</h3>
                    <button type="button" className="btn-revert">
                      ↻ Revert section
                    </button>
                  </div>
                  <div className="report-code-area-list">
                    {reportCodeAreaSummaries.map((area) => {
                      const total = area.attention + area.lead + area.goodPractice + area.compliant;
                      const met = area.compliant + area.goodPractice;
                      return (
                        <div key={`report-${area.id}`} className="report-code-area-row">
                          <strong>
                            <span className="report-code-area-arrow">▶</span> {area.name}
                          </strong>
                          <span className="panel-subtitle">
                            {met}/{Math.max(total, 1)} aligned · {area.attention} attention · {area.goodPractice} good
                            practice{area.lead ? ` · ${area.lead} lead` : ''}
                          </span>
                        </div>
                      );
                    })}
                    <div className="report-code-area-row">
                      <strong>
                        <span className="report-code-area-arrow">▶</span> Not Assessed
                        <span className="panel-subtitle">
                          {' '}
                          ({notAssessedAreas.length} code areas)
                        </span>
                      </strong>
                      <span className="panel-subtitle" />
                    </div>
                  </div>
                  <div className="docs-table report-appendix-table">
                    <div className="docs-table__row docs-table__row--head">
                      <span>Ref</span>
                      <span>Finding</span>
                      <span>Severity</span>
                      <span>Code Area</span>
                    </div>
                    {reportAppendixRows.map((row) => (
                      <div key={row.id} className="docs-table__row">
                        <span>{row.id}</span>
                        <span>{row.finding}</span>
                        <span>{row.severity}</span>
                        <span>{row.codeArea}</span>
                      </div>
                    ))}
                  </div>
                  <p className="panel-subtitle report-appendix-link">
                    See digital case file for complete evidence chain.
                  </p>
                </section>
                <div className="report-footer-brand">
                  <img src={`${assetBase}assets/sumplexity_horizontal_logo.png`} alt="Sumplexity" />
                  <span>Powered by Sumplexity</span>
                </div>
                </div>
              </>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (appMode === 'dashboard') {
    return (
      <div className={`arr-app-shell ${darkMode ? 'dark-mode' : ''}`}>
        <AppHeader
          currentUserEmail={currentUserEmail}
          onSignOut={onSignOut}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
          onOpenAssistant={() => openReggie('all')}
          assistantOpen={reggieOpen}
        />
        <main className="workspace-main">
          <StepTimeline steps={WORKFLOW_STEP_CONFIG} currentStep={workflowTimelineStep} />
          {renderDashboard()}
        </main>
      </div>
    );
  }

  if (appMode === 'caseSetup') {
    return (
      <div className={`arr-app-shell ${darkMode ? 'dark-mode' : ''}`}>
        <AppHeader
          currentUserEmail={currentUserEmail}
          onSignOut={onSignOut}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
          onOpenAssistant={() => openReggie('all')}
          assistantOpen={reggieOpen}
        />
        <main className="workspace-main">
          <StepTimeline steps={WORKFLOW_STEP_CONFIG} currentStep={workflowTimelineStep} />
          {renderCaseSetup()}
        </main>
      </div>
    );
  }

  return (
    <div className={`arr-app-shell ${darkMode ? 'dark-mode' : ''}`}>
      <AppHeader
        currentUserEmail={currentUserEmail}
        onSignOut={onSignOut}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onOpenAssistant={() => openReggie('all')}
        assistantOpen={reggieOpen}
      />
      <main className="workspace-main">
        <StepTimeline steps={WORKFLOW_STEP_CONFIG} currentStep={workflowTimelineStep} />
        {isWorkspaceLoading ? (
          <div className="alert alert-warning small">Syncing case data from Firestore...</div>
        ) : null}
        {!isWorkspaceLoading && appMode === 'inspection' && !isActiveCasePersisted ? (
          <div className="alert alert-warning small">
            Read-only demo mode: this case is not persisted in Firestore yet.
          </div>
        ) : null}
        {renderCaseHeader()}
        {renderStepContent()}
      </main>
      {undoDecision ? (
        <div className="undo-toast" role="status" aria-live="polite">
          <span>
            {undoDecision.nextDecision === 'accepted' ? (
              <>
                Finding <strong>accepted</strong>.
              </>
            ) : undoDecision.nextDecision === 'rejected' ? (
              <>
                Finding <strong>rejected</strong>.
              </>
            ) : undoDecision.nextDecision === 'dismissed' ? (
              <>
                Lead <strong>dismissed</strong>.
              </>
            ) : (
              'Decision cleared.'
            )}
          </span>
          <button type="button" className="undo-link-btn" onClick={handleUndoDecision}>
            Undo
          </button>
        </div>
      ) : null}
      <div className={`feedback-tab ${currentStep === STEP_VIEWER ? 'left' : ''}`}>
        <button type="button" onClick={() => setFeedbackOpen(true)}>
          Feedback
        </button>
      </div>
      {reggieOpen ? (
        <>
          <div className="reggie-backdrop" onClick={() => setReggieOpen(false)} aria-hidden="true" />
          <aside className="reggie-panel" role="dialog" aria-modal="true" aria-label="Reggie assistant">
            <header className="reggie-panel__header">
              <div>
                <h3>Reggie</h3>
                <p>
                  {reggieScope === 'document' ? 'This document' : 'All documents'}
                </p>
              </div>
              <button type="button" className="btn btn-xs ghost" onClick={() => setReggieOpen(false)}>
                Close
              </button>
            </header>
            <div className="reggie-panel__messages">
              {reggieMessages.length === 0 ? (
                <div className="reggie-welcome">
                  <div className="reggie-welcome__icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 2L3 5v5.5C3 15 6.2 18.2 10 19c3.8-.8 7-4 7-8.5V5L10 2z" />
                      <polyline points="6.5,10.5 8.75,12.75 13.5,7.5" />
                    </svg>
                  </div>
                  <p>
                    Regulatory Guidance &amp; Inspection Engine
                    <br />
                    <span>I can help you explore this case</span>
                  </p>
                </div>
              ) : null}
              {reggieMessages.length === 0 ? (
                <div className="reggie-suggestions">
                  {REGGIE_SUGGESTIONS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="reggie-suggestion-chip"
                      onClick={() => handleQuickReggiePrompt(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}
              {reggieMessages.map((message) => (
                <article key={message.id} className={`reggie-message ${message.role}`}>
                  <p>{message.text}</p>
                </article>
              ))}
              {filteredCrossDocResults.slice(0, 2).map((finding) => {
                const relatedDoc = documentsById.get(finding.documentId);
                return (
                  <article key={`reggie-source-${finding.id}`} className="reggie-source-card">
                    <strong>{safeText(finding.title, 'Finding')}</strong>
                    <p>{relatedDoc?.label ?? 'Document'} · {safeSourceField(finding.source, 'section', 'Source excerpt')}</p>
                    <button
                      type="button"
                      className="btn btn-xs ghost"
                      onClick={() => {
                        handleViewDocument(finding.documentId, finding.boxId, finding.id);
                        setReggieOpen(false);
                        setDocumentWorkspaceTab('findings');
                      }}
                    >
                      Jump to evidence
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs secondary"
                      onClick={() => {
                        setReggieOpen(false);
                        openComposerModal('manual');
                        setComposerModal((prev) => ({
                          ...prev,
                          open: true,
                          type: 'manual',
                          text: safeText(finding.detail, safeText(finding.title, '')),
                          evidenceType: 'document',
                          evidenceNote: safeText(finding.source?.text, safeText(finding.detail, ''))
                        }));
                      }}
                    >
                      Add as finding
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="reggie-panel__composer">
              <input
                type="text"
                value={reggieInput}
                onChange={(event) => setReggieInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSendReggie();
                  }
                }}
                placeholder={
                  reggieScope === 'document'
                    ? 'Ask Reggie about this document...'
                    : 'Ask Reggie about this case...'
                }
              />
              <button
                type="button"
                className="btn btn-xs ghost reggie-voice-btn"
                title="Voice input (UI only)"
                aria-label="Voice input"
              >
                🎤
              </button>
              <button type="button" className="btn btn-xs secondary reggie-send-btn" onClick={handleSendReggie} title="Send">
                ➤
              </button>
            </div>
          </aside>
        </>
      ) : null}
      {reportPendingGateOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Unprocessed changes">
            <h3>Unprocessed Changes</h3>
            <p>
              There are unprocessed changes. Would you like to reprocess findings first, or generate
              the report from current findings?
            </p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setReportPendingGateOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setReportPendingGateOpen(false);
                  setReportRegenerateConfirmOpen(true);
                }}
              >
                Generate from current findings
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setReportPendingGateOpen(false);
                  setDocumentWorkspaceTab('lifecycle');
                  setReportPendingChanges(false);
                  setDocsMarkedForReprocess({});
                  setProcessingLog((prev) => [
                    {
                      id: `p${Date.now()}-report-reprocess`,
                      detail: 'Reprocess requested from report pending-changes gate',
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    },
                    ...prev
                  ]);
                  setAnalysisProgress(8);
                  setAnalysisRunning(true);
                  setCurrentStep(STEP_PROCESSING);
                }}
              >
                Reprocess findings first
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {reportRegenerateConfirmOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Regenerate report">
            <h3>Regenerate Report?</h3>
            <p>Regenerating will replace the current report. Any manual edits will be lost. Continue?</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setReportRegenerateConfirmOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={handleConfirmReportRegenerate}>
                Regenerate
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {feedbackOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Share feedback">
            <h3>Share feedback</h3>
            <label className="modal-label" htmlFor="feedback-category">
              Category
            </label>
            <select
              id="feedback-category"
              className="modal-select"
              value={feedbackCategory}
              onChange={(event) => setFeedbackCategory(event.target.value)}
            >
              <option value="bug">Bug</option>
              <option value="suggestion">Suggestion</option>
              <option value="question">Question</option>
              <option value="other">Other</option>
            </select>
            <label className="modal-label" htmlFor="feedback-text">
              Notes
            </label>
            <textarea
              id="feedback-text"
              className="modal-textarea"
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="Tell us what needs improving..."
            />
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setFeedbackOpen(false)}>
                Close
              </button>
              <button type="button" className="btn primary" onClick={handleSubmitFeedback}>
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {contextNoteOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Add case context note">
            <h3>Add case context note</h3>
            <p>This context will be included on the next processing run.</p>
            <textarea
              className="modal-textarea"
              value={contextNoteDraft}
              onChange={(event) => setContextNoteDraft(event.target.value)}
              placeholder="Add context about rejected findings, inspection scope, or known exceptions..."
            />
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setContextNoteOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const cleanNote = contextNoteDraft.trim();
                  if (cleanNote) {
                    setCaseContextNotes((prev) => [
                      {
                        id: `ctx-${Date.now()}`,
                        text: cleanNote,
                        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        actor: currentUserEmail || 'Inspector'
                      },
                      ...prev
                    ]);
                    setHistoryItems((items) => [
                      {
                        id: `h${Date.now()}`,
                        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        detail: 'Case context note updated',
                        actor: currentUserEmail || 'Inspector'
                      },
                      ...items
                    ]);
                    setReportNeedsRegeneration(true);
                    if (isActiveCasePersisted) {
                      persistContextNote({
                        caseId: currentCaseMeta.caseId,
                        text: cleanNote,
                        user: currentUser
                      }).catch((error) => {
                        // eslint-disable-next-line no-console
                        console.error('Failed to persist context note', error);
                      });
                    }
                  }
                  setContextNoteOpen(false);
                  setContextNoteDraft('');
                }}
              >
                Save context
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {composerModal.open ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card modal-card--wide" role="dialog" aria-modal="true" aria-label="Add finding">
            <h3>{composerModal.type === 'manual' ? 'Add Manual Finding' : 'Add General Observation'}</h3>
            {composerModal.step === 1 ? (
              <>
                <label className="modal-label" htmlFor="composer-text">
                  {composerModal.type === 'manual' ? 'Describe the finding' : 'What did you observe?'}
                </label>
                <div className="composer-textarea-wrap">
                  <textarea
                    id="composer-text"
                    className="modal-textarea"
                    value={composerModal.text}
                    onChange={(event) =>
                      setComposerModal((prev) => ({ ...prev, text: event.target.value }))
                    }
                    placeholder={
                      composerModal.type === 'manual'
                        ? 'Describe the finding...'
                        : 'What did you observe?'
                    }
                  />
                  <button type="button" className="composer-voice-btn" title="Dictate (UI only)" aria-label="Dictate">
                    🎤
                  </button>
                </div>
                <label className="modal-label" htmlFor="composer-source">
                  Source type
                </label>
                <select
                  id="composer-source"
                  className="modal-select"
                  value={composerModal.sourceType}
                  onChange={(event) =>
                    setComposerModal((prev) => ({ ...prev, sourceType: event.target.value }))
                  }
                >
                  {OBSERVATION_SOURCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="modal-label">Observation preview</label>
                <div className="composer-preview">
                  {composerModal.text.trim() || 'No observation text entered yet.'}
                </div>
                <label className="modal-label" htmlFor="composer-requirement">
                  Requirement linkage
                </label>
                {composerModal.type === 'observation' ? (
                  <div className="composer-requirements">
                    <p className="composer-requirements__hint">
                      Suggested requirements based on your observation:
                    </p>
                    {FINDING_REQUIREMENT_OPTIONS.map((option) => {
                      const selected = (composerModal.selectedRequirements || []).includes(option);
                      return (
                        <label key={option} className="composer-requirements__item">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) =>
                              setComposerModal((prev) => {
                                const current = new Set(prev.selectedRequirements || []);
                                if (event.target.checked) {
                                  current.add(option);
                                } else {
                                  current.delete(option);
                                }
                                const next = Array.from(current);
                                return {
                                  ...prev,
                                  selectedRequirements:
                                    next.length > 0 ? next : [FINDING_REQUIREMENT_OPTIONS[0]]
                                };
                              })
                            }
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                    <button
                      type="button"
                      className="link-button composer-requirements__add-link"
                      onClick={(event) => event.preventDefault()}
                    >
                      + Add requirement
                    </button>
                  </div>
                ) : (
                  <select
                    id="composer-requirement"
                    className="modal-select"
                    value={composerModal.requirement}
                    onChange={(event) =>
                      setComposerModal((prev) => ({ ...prev, requirement: event.target.value }))
                    }
                  >
                    {FINDING_REQUIREMENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                {composerModal.type === 'observation' ? (
                  <>
                    <label className="modal-label">Polarity</label>
                    <div className="composer-polarity-options">
                      <label className="composer-polarity-option">
                        <input
                          type="radio"
                          name="composer-polarity"
                          checked={composerModal.polarity === 'non_compliant'}
                          onChange={() =>
                            setComposerModal((prev) => ({
                              ...prev,
                              polarity: 'non_compliant',
                              goodPractice: false
                            }))
                          }
                        />
                        <span>Non-compliant - requirement not met</span>
                      </label>
                      <label className="composer-polarity-option">
                        <input
                          type="radio"
                          name="composer-polarity"
                          checked={composerModal.polarity === 'compliant'}
                          onChange={() =>
                            setComposerModal((prev) => ({
                              ...prev,
                              polarity: 'compliant'
                            }))
                          }
                        />
                        <span>Compliant - requirement met</span>
                      </label>
                    </div>
                    {composerModal.polarity === 'compliant' ? (
                      <label className="toggle composer-good-practice-toggle">
                        <input
                          type="checkbox"
                          checked={composerModal.goodPractice}
                          onChange={(event) =>
                            setComposerModal((prev) => ({ ...prev, goodPractice: event.target.checked }))
                          }
                        />
                        <span>Mark as good practice</span>
                      </label>
                    ) : null}
                  </>
                ) : (
                  <>
                    <label className="modal-label" htmlFor="composer-polarity">
                      Polarity
                    </label>
                    <select
                      id="composer-polarity"
                      className="modal-select"
                      value={composerModal.polarity}
                      onChange={(event) =>
                        setComposerModal((prev) => ({
                          ...prev,
                          polarity: event.target.value,
                          goodPractice:
                            event.target.value === 'compliant' ? prev.goodPractice : false
                        }))
                      }
                    >
                      <option value="non_compliant">Non-compliant</option>
                      <option value="compliant">Compliant</option>
                    </select>
                    {composerModal.polarity === 'compliant' ? (
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={composerModal.goodPractice}
                          onChange={(event) =>
                            setComposerModal((prev) => ({ ...prev, goodPractice: event.target.checked }))
                          }
                        />
                        <span>Mark as good practice</span>
                      </label>
                    ) : null}
                  </>
                )}
                {composerModal.type === 'manual' ? (
                  <>
                    <label className="modal-label" htmlFor="composer-evidence">
                      Evidence type
                    </label>
                    <select
                      id="composer-evidence"
                      className="modal-select"
                      value={composerModal.evidenceType}
                      onChange={(event) =>
                        setComposerModal((prev) => ({ ...prev, evidenceType: event.target.value }))
                      }
                    >
                      <option value="document">Document-based</option>
                      <option value="case_level">Case-level</option>
                    </select>
                    <label className="modal-label" htmlFor="composer-evidence-note">
                      Evidence note
                    </label>
                    <textarea
                      id="composer-evidence-note"
                      className="modal-textarea"
                      value={composerModal.evidenceNote}
                      onChange={(event) =>
                        setComposerModal((prev) => ({ ...prev, evidenceNote: event.target.value }))
                      }
                      placeholder={
                        composerModal.evidenceType === 'document'
                          ? 'Describe document passages and why they support this finding...'
                          : 'Describe case-level evidence context (interview, on-site note, missing document, etc.)...'
                      }
                    />
                  </>
                ) : null}
              </>
            )}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={closeComposerModal}>
                Cancel
              </button>
              {composerModal.step === 1 ? (
                <button
                  type="button"
                  className="btn primary"
                  disabled={!composerModal.text.trim()}
                  onClick={() => setComposerModal((prev) => ({ ...prev, step: 2 }))}
                >
                  Next: link requirements →
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setComposerModal((prev) => ({ ...prev, step: 1 }))}
                  >
                    ← Back
                  </button>
                  <button type="button" className="btn primary" onClick={submitComposerModal}>
                    {composerModal.type === 'manual' ? 'Add finding' : 'Add observation'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {deleteFindingTargetId ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Delete finding">
            <h3>Delete finding?</h3>
            <p>This action cannot be undone and removes the finding from current review views.</p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setDeleteFindingTargetId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  const target = allFindings.find((f) => f.id === deleteFindingTargetId);
                  setDeletedFindingIds((prev) => ({ ...prev, [deleteFindingTargetId]: true }));
                  setReportNeedsRegeneration(true);
                  if (target) {
                    setHistoryItems((items) => [
                      {
                        id: `h${Date.now()}`,
                        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        detail: `Finding deleted: ${target.title}`,
                        actor: currentUserEmail || 'Inspector'
                      },
                      ...items
                    ]);
                  }
                  setDeleteFindingTargetId(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
