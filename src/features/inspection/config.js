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
  practiceName: '',
  caseId: '',
  owner: '',
  status: 'active',
  outcome: 'in_progress',
  started: '',
  riskLevel: 'Not assessed',
  previousInspection: '',
  holp: '',
  hofa: '',
  transactionType: '',
  actingForLender: false,
  amlTier: '',
  knownParties: []
};

export const STEP_CASE_SETUP = 0;
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
  { id: 3, title: 'Documents', subtitle: 'Select and classify evidence' },
  { id: 4, title: 'Findings', subtitle: 'Review findings and linked evidence' },
  { id: 5, title: 'Report', subtitle: 'Generate and export output' }
];

export const CASE_TABS = [
  { id: 'case-setup', label: 'Case Setup', step: STEP_CASE_SETUP },
  { id: 'documents', label: 'Documents', step: STEP_DOCUMENTS },
  { id: 'overview', label: 'Findings', step: STEP_OVERVIEW },
  { id: 'report', label: 'Report', step: STEP_REPORT }
];

export const AI_PROCESSING_STEPS = [
  'Classifying uploaded documents',
  'Extracting structured evidence',
  'Running compliance checks',
  'Linking findings to source passages',
  'Building findings workspace'
];

export const AI_PROCESSING_MESSAGES = [
  'Classifying documents and validating metadata...',
  'Extracting policy clauses, dates and parties...',
  'Running compliance checks across assessed code areas...',
  'Linking evidence highlights to findings and review items...',
  'Preparing findings and reviewer actions...'
];

export const INITIAL_HISTORY_ITEMS = [];

export const DOCUMENT_PHASE_OPTIONS = [
  { id: 'intake', label: '1. Select Documents' },
  { id: 'review', label: '2. Review Classifications' }
];

export const INITIAL_UPLOAD_ITEMS = [];

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
  'aml-1 Borrower identity check',
  'aml-2 Source of funds documentation',
  'aml-3 Enhanced due diligence',
  'aml-4 SOF enquiries and records',
  'aml-5 Outstanding SOF evidence resolution',
  'aml-6 Address evidence current',
  'aml-7 Deposit legitimate source',
  'aml-8 Address records retained',
  'aml-9 Estate distribution SOF evidence',
  'aml-10 Electronic verification transparency',
  'afl-1 Disclosure to lender',
  'afl-3 True purchase price to lender',
  'cc-1 Terms and estimated fees in writing',
  'cc-2 Fee arrangements and changes',
  'cc-3 Significant cost changes',
  'cc-4 How costs will be paid',
  'cmp-1 Complaints procedure',
  'cmp-2 Legal Ombudsman escalation'
];

export const REQUIREMENT_SEVERITY_BY_ID = {
  'aml-1 Borrower identity check': 'critical',
  'aml-2 Source of funds documentation': 'critical',
  'aml-3 Enhanced due diligence': 'critical',
  'aml-4 SOF enquiries and records': 'critical',
  'aml-5 Outstanding SOF evidence resolution': 'critical',
  'aml-6 Address evidence current': 'best_practice',
  'aml-7 Deposit legitimate source': 'best_practice',
  'aml-8 Address records retained': 'best_practice',
  'aml-9 Estate distribution SOF evidence': 'best_practice',
  'aml-10 Electronic verification transparency': 'best_practice',
  'afl-1 Disclosure to lender': 'best_practice',
  'afl-3 True purchase price to lender': 'best_practice',
  'cc-1 Terms and estimated fees in writing': 'best_practice',
  'cc-2 Fee arrangements and changes': 'best_practice',
  'cc-3 Significant cost changes': 'best_practice',
  'cc-4 How costs will be paid': 'best_practice',
  'cmp-1 Complaints procedure': 'best_practice',
  'cmp-2 Legal Ombudsman escalation': 'best_practice'
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
  { id: 'cyber', label: 'Cyber Security & Cyber Essentials' },
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

export const RISK_REGISTER_PRESET = ['aml', 'cyber'];

export const REGGIE_SUGGESTIONS = [
  'Show the most serious findings',
  'Summarise the AML issues',
  'What evidence supports this finding?',
  'Draft a short case summary'
];

export const RECURRING_FINDING_IDS = new Set();

export const COMPLIANCE_CODE_AREAS = [];

export const NOT_ASSESSED_AREAS = [];
export const VIEWER_CODE_AREA_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'aml', label: 'AML & CTF' },
  { id: 'lenders', label: 'Acting for Lenders' },
  { id: 'client-care', label: 'Client Care' },
  { id: 'complaints', label: 'Complaints Code' },
  { id: 'cyber', label: 'Cyber' },
  { id: 'accounts', label: 'Accounts Code' },
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
  leads: 'Requires review',
  non_compliant: 'Non-compliant',
  compliant: 'Compliant',
  good_practice: 'Good Practice',
  inspector_added: 'Inspector-added',
  strong: 'Strong evidence',
  supported: 'Supported evidence',
  indicative: 'Indicative evidence'
};

export const FINDING_SEVERITY_BADGE_MAP = {
  critical: 'Non-compliant',
  warning: 'Requires review',
  best_practice: 'Good practice',
  pass: 'Compliant'
};

export const SEVERITY_LABEL_MAP = {
  critical: 'Non-compliant',
  warning: 'Requires review',
  pass: 'Compliant',
  best_practice: 'Good Practice'
};

export const REPORT_SEVERITY_LABEL_MAP = {
  critical: 'Non-compliant',
  warning: 'Requires review',
  pass: 'Compliant',
  best_practice: 'Good Practice'
};

export const CODE_AREA_REQUIREMENT_SAMPLES = {
  aml: [
    { id: 'aml-2', label: 'Source-of-funds documentation retained', status: 'non_compliant' },
    { id: 'aml-3', label: 'Enhanced due diligence for higher risk', status: 'non_compliant' },
    { id: 'aml-5', label: 'Outstanding SOF evidence resolved', status: 'non_compliant' },
    { id: 'aml-6', label: 'Address evidence current and valid', status: 'compliant' },
    { id: 'aml-7', label: 'Deposit from legitimate source', status: 'good_practice' },
    { id: 'aml-8', label: 'Address records copied and retained', status: 'compliant' },
    { id: 'aml-9', label: 'Estate distribution SOF evidence', status: 'compliant' },
    { id: 'aml-10', label: 'Electronic verification transparency', status: 'compliant' }
  ],
  lenders: [
    { id: 'aml-1', label: 'Borrower identity original documents', status: 'non_compliant' },
    { id: 'afl-1', label: 'Terms permit lender disclosure', status: 'compliant' },
    { id: 'afl-3', label: 'True purchase price to lender', status: 'compliant' }
  ],
  'client-care': [
    { id: 'cc-1', label: 'Terms and estimated fees in writing', status: 'compliant' },
    { id: 'cc-2', label: 'Fee arrangements and changes', status: 'compliant' },
    { id: 'cc-3', label: 'Significant cost changes told promptly', status: 'compliant' },
    { id: 'cc-4', label: 'How costs will be paid agreed', status: 'compliant' }
  ],
  complaints: [
    { id: 'cmp-1', label: 'Complaints procedure in writing', status: 'compliant' },
    { id: 'cmp-2', label: 'Legal Ombudsman escalation details', status: 'compliant' }
  ],
  accounts: [
    { id: 'ac-1', label: 'Client account reconciliations', status: 'compliant' },
    { id: 'ac-2', label: 'Residual balances controls', status: 'compliant' }
  ],
  management: [
    { id: 'mg-1', label: 'Supervision process documented', status: 'compliant' },
    { id: 'mg-2', label: 'Escalation route clear', status: 'compliant' }
  ],
  undertakings: [{ id: 'un-1', label: 'Undertakings register maintained', status: 'compliant' }]
};

export const REQUIREMENT_KEYWORDS = {
  'aml-1': ['identity', 'borrower identity', 'original documents'],
  'aml-2': ['source of funds', 'sof', 'documentation retained'],
  'aml-3': ['enhanced due diligence', 'higher risk', 'cdd'],
  'aml-4': ['source of funds enquiries', 'evidence copies', 'recorded'],
  'aml-5': ['outstanding', 'sof evidence', 'resolved', 'relied upon'],
  'aml-6': ['address evidence', 'current', 'proof of address'],
  'aml-7': ['deposit', 'legitimate source', 'good practice'],
  'aml-8': ['address records', 'copied', 'retained'],
  'aml-9': ['estate distribution', 'sof evidence', 'retained'],
  'aml-10': ['electronic verification', 'transparent', 'checks carried out', 'identity'],
  'afl-1': ['disclosure', 'lender', 'terms of engagement'],
  'afl-3': ['purchase price', 'lender', 'true price'],
  'cc-1': ['terms of engagement', 'estimated fees', 'writing'],
  'cc-2': ['fee arrangements', 'changes'],
  'cc-3': ['costs', 'changes', 'projected'],
  'cc-4': ['costs', 'agreed', 'payment'],
  'cmp-1': ['complaint', 'procedure', 'timeframes'],
  'cmp-2': ['ombudsman', 'escalation', 'legal ombudsman'],
  'ac-1': ['reconciliation', 'client account'],
  'ac-2': ['residual', 'balance'],
  'mg-1': ['supervision', 'mlro'],
  'mg-2': ['escalation', 'governance'],
  'un-1': ['undertaking']
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
  cyber: ['cyber', 'cyber essentials', 'information security', 'phishing', 'firewall'],
  lenders: ['lender', 'mortgage fraud', 'acting for lenders', 'disclosure to lender', 'purchase price'],
  'client-care': ['client care', 'terms of engagement', 'engagement letter', 'client communication', 'fee estimate', 'costs'],
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
  cyber: 'cyber',
  'cyber security': 'cyber',
  'cyber essentials': 'cyber',
  lenders: 'lenders',
  'acting for lenders': 'lenders',
  'acting-for-lenders': 'lenders',
  'acting for lenders & mortgage fraud': 'lenders',
  'acting for lenders and prevention and detection of mortgage fraud': 'lenders',
  'mortgage fraud': 'lenders',
  complaints: 'complaints',
  'complaints code': 'complaints',
  'code of conduct': 'complaints',
  'code-of-conduct': 'complaints',
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
    action: 'Complete outstanding SOF evidence before relying on funds',
    codeRef: 'AML Procedure 20',
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
  },
  {
    id: 'ra5',
    action: 'Remind fee-earners of lender disclosure obligations',
    codeRef: 'AFL Section 9',
    codeArea: 'Acting for Lenders',
    deadline: '2026-03-14',
    person: ''
  },
  {
    id: 'ra6',
    action: 'Ensure client care letters include Legal Ombudsman escalation details',
    codeRef: 'COC 6.k',
    codeArea: 'Complaints',
    deadline: '2026-03-14',
    person: ''
  }
];
