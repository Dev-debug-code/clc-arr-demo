import { normalizeUploadDraft } from '../../utils/documentUploads.js';

const STAGE_TARGET_DURATION_MS = 5000;
export const ANALYSIS_TICK_INTERVAL_MS = 1500;

const computeProgressIncrement = (duration, interval) => {
  const stepCount = Math.max(Math.round(duration / interval), 1);
  return 100 / stepCount;
};

export const ANALYSIS_PROGRESS_INCREMENT = computeProgressIncrement(
  STAGE_TARGET_DURATION_MS,
  ANALYSIS_TICK_INTERVAL_MS
);

export const ANALYSIS_TICK_INTERVAL = ANALYSIS_TICK_INTERVAL_MS;
export const CASE_META = {
  practiceName: 'Hartley & Partners Solicitors',
  caseId: 'CLC-12458',
  owner: 'Alex Carter',
  started: '12 Feb 2026',
  riskLevel: 'Medium',
  previousInspection: 'March 2023',
  holp: 'Sarah Chen',
  hofa: 'James Wright',
  transactionType: 'purchase',
  actingForLender: false,
  amlTier: 'standard',
  knownParties: []
};

export const STEP_DOCUMENTS = 1;
export const STEP_PROCESSING = 2;
export const STEP_OVERVIEW = 3;
export const STEP_VIEWER = 4;
export const STEP_REPORT = 5;
export const STEP_HISTORY = 6;
export const INSPECTION_LINEAR_FINAL_STEP = STEP_REPORT;

export const WORKFLOW_STEP_CONFIG = [
  { id: 1, title: 'Dashboard', subtitle: 'Choose or resume a case' },
  { id: 2, title: 'Case Setup', subtitle: 'Create the inspection case' },
  { id: 3, title: 'Documents', subtitle: 'Upload and verify evidence' },
  { id: 4, title: 'Review', subtitle: 'Overview, viewer and history' },
  { id: 5, title: 'Report', subtitle: 'Generate and export output' }
];

export const CASE_TABS = [
  { id: 'documents', label: 'Documents', step: STEP_DOCUMENTS },
  { id: 'overview', label: 'Overview', step: STEP_OVERVIEW },
  { id: 'history', label: 'History', step: STEP_HISTORY },
  { id: 'report', label: 'Report', step: STEP_REPORT }
];

export const AI_PROCESSING_STEPS = [
  'Classifying uploaded documents',
  'Extracting structured evidence',
  'Running compliance checks',
  'Linking findings to source passages',
  'Building overview workspace'
];

export const AI_PROCESSING_MESSAGES = [
  'Classifying documents and validating metadata...',
  'Extracting policy clauses, dates and parties...',
  'Running compliance checks across assessed code areas...',
  'Linking evidence highlights to findings and leads...',
  'Preparing overview and reviewer actions...'
];

export const INITIAL_HISTORY_ITEMS = [];

export const DOCUMENT_PHASE_OPTIONS = [
  { id: 'upload', label: 'Phase 1: Upload & Verify' },
  { id: 'manage', label: 'Phase 2: Ongoing Management' }
];

export const INITIAL_UPLOAD_ITEMS = [
  normalizeUploadDraft({
    id: 'up1',
    name: 'Updated sanctions evidence.pdf',
    status: 'queued',
    classification: 'Unknown',
    parties: 'Firm',
    confidence: 'low',
    summary:
      'Potential mismatch between sanctions declaration timing and supporting document chronology.'
  }),
  normalizeUploadDraft({
    id: 'up2',
    name: 'AML refresher training record.pdf',
    status: 'verified',
    classification: 'Interview Transcript',
    parties: 'J. Smith (MLRO)',
    interviewees: [
      {
        id: 'interviewee-up2-1',
        name: 'John Smith',
        role: 'MLRO',
        date: '2026-02-12',
        contextNote: 'Present for AML supervision discussion.'
      }
    ],
    confidence: 'medium',
    summary:
      'Interview transcript indicates strong supervision controls and periodic compliance refresh activity.'
  })
];

export const REVIEW_REASON_OPTIONS = [
  { value: 'evidence_exists_elsewhere', label: 'Evidence exists elsewhere' },
  { value: 'policy_updated', label: 'Policy updated' },
  { value: 'different_context', label: 'Different context applies' },
  { value: 'system_error', label: 'System error' },
  { value: 'other', label: 'Other' }
];

export const DISMISS_REASON_OPTIONS = [
  { value: 'not_applicable', label: 'Not applicable' },
  { value: 'evidence_exists_elsewhere', label: 'Evidence exists elsewhere' },
  { value: 'expected_behaviour', label: 'Expected behaviour' },
  { value: 'other', label: 'Other' }
];

export const OBSERVATION_SOURCE_OPTIONS = [
  'On-site visit',
  'Interview',
  'Phone call',
  'Email',
  'Other'
];

export const FINDING_REQUIREMENT_OPTIONS = [
  'S3.2.1 Practice-wide risk assessment',
  'S3.5.2 Source of funds checks',
  'S3.8.1 Ongoing monitoring',
  'AC2.1 Client account controls'
];

export const REQUIREMENT_SEVERITY_BY_ID = {
  'S3.2.1 Practice-wide risk assessment': 'critical',
  'S3.5.2 Source of funds checks': 'critical',
  'S3.8.1 Ongoing monitoring': 'warning',
  'AC2.1 Client account controls': 'critical'
};

export const MANUAL_CASE_LEVEL_SOURCE_OPTIONS = [
  'On-site observation',
  'Interview',
  'Phone call',
  'Email',
  'Other'
];

export const FOCUS_AREA_OPTIONS = [
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

export const CASE_TRANSACTION_TYPE_OPTIONS = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'sale', label: 'Sale' },
  { value: 'remortgage', label: 'Remortgage' },
  { value: 'transfer', label: 'Transfer / Transfer of Equity' },
  { value: 'other', label: 'Other' }
];

export const CASE_ACTING_FOR_LENDER_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' }
];

export const CASE_AML_TIER_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'enhanced', label: 'Enhanced' },
  { value: 'simplified', label: 'Simplified' }
];

export const AML_DESK_REVIEW_PRESET = ['aml', 'accounts', 'lenders', 'client-care', 'management'];

export const REGGIE_SUGGESTIONS = [
  'Source of funds documentation',
  'What did the MLRO say about training?',
  'Cross-reference bank statements',
  'Overseas transactions'
];

export const RECURRING_FINDING_IDS = new Set(['CRIT-003', 'WARN-002']);

export const COMPLIANCE_CODE_AREAS = [
  { id: 'aml', name: 'Anti-Money Laundering & CTF', met: '6/9', attention: 3, goodPractice: 1, lead: 1 },
  { id: 'client-care', name: 'Client Care & Terms of Engagement', met: '3/6', attention: 3 },
  { id: 'accounts', name: 'Accounts Code', met: '5/6', attention: 1 },
  { id: 'management', name: 'Management & Supervision', met: '4/5', attention: 1 },
  { id: 'undertakings', name: 'Undertakings', met: '4/4', goodPractice: 1, complete: true },
  { id: 'complaints', name: 'Complaints Code', met: '2/2', complete: true }
];

export const NOT_ASSESSED_AREAS = ['Insurance Distribution', 'Acting for Lenders', 'Consumer Duty'];
export const VIEWER_CODE_AREA_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'aml', label: 'AML & CTF' },
  { id: 'accounts', label: 'Accounts Code' },
  { id: 'complaints', label: 'Complaints Code' },
  { id: 'conflicts', label: 'Conflicts of Interest' },
  { id: 'transaction', label: 'Transaction Files' }
];

export const FINDING_EVIDENCE_STRENGTH_MAP = {
  critical: { key: 'strong', label: 'Strong evidence' },
  warning: { key: 'indicative', label: 'Indicative' },
  best_practice: { key: 'strong', label: 'Strong evidence' },
  pass: { key: 'supported', label: 'Supported' }
};

export const FINDING_FILTER_LABEL_MAP = {
  all: 'All',
  unreviewed: 'Unreviewed',
  reviewed: 'Reviewed',
  leads: 'Leads',
  non_compliant: 'Attention',
  compliant: 'Compliant',
  good_practice: 'Good Practice',
  inspector_added: 'Inspector-added',
  strong: 'Strong evidence',
  supported: 'Supported evidence',
  indicative: 'Indicative evidence'
};

export const FINDING_SEVERITY_BADGE_MAP = {
  critical: 'Finding',
  warning: 'Lead',
  best_practice: 'Good practice',
  pass: 'Compliant'
};

export const SEVERITY_LABEL_MAP = {
  critical: 'Critical',
  warning: 'Lead',
  pass: 'Compliant',
  best_practice: 'Good Practice'
};

export const REPORT_SEVERITY_LABEL_MAP = {
  critical: 'Critical',
  warning: 'Guidance',
  pass: 'Compliant',
  best_practice: 'Good Practice'
};

export const CODE_AREA_REQUIREMENT_SAMPLES = {
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

export const REQUIREMENT_KEYWORDS = {
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

export const CODE_AREA_KEYWORDS = {
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

export const CODE_AREA_ALIASES = {
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

export const REPORT_ACTION_DEFAULTS = [
  {
    id: 'ra1',
    action: 'Update PWRA for current regulatory framework',
    codeRef: 'S3.2.1',
    codeArea: 'AML',
    deadline: '2026-02-28',
    person: ''
  },
  {
    id: 'ra2',
    action: 'Document SOF procedures for all transactions',
    codeRef: 'S3.5.2',
    codeArea: 'AML',
    deadline: '2026-02-28',
    person: ''
  },
  {
    id: 'ra3',
    action: 'Update SAR log format with outcome fields',
    codeRef: 'S3.8.1',
    codeArea: 'AML',
    deadline: '2026-02-28',
    person: ''
  },
  {
    id: 'ra4',
    action: 'Update complaints information on website',
    codeRef: 'C4.1.1',
    codeArea: 'Complaints',
    deadline: '2026-03-14',
    person: ''
  }
];
