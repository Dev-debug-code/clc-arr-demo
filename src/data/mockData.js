export const NAV_TABS = [
  { id: 'intake', label: 'Case Intake', stepRange: [1, 2] },
  { id: 'review', label: 'Review', stepRange: [3, 4] },
  { id: 'reports', label: 'Report', stepRange: [5, 6] }
];

export const STEP_CONFIG = [
  { id: 1, title: 'Documents', subtitle: 'Upload, classify and verify documents' },
  { id: 2, title: 'AI Processing', subtitle: 'Process and classify uploaded evidence' },
  { id: 3, title: 'Overview', subtitle: 'Review findings and leads' },
  { id: 4, title: 'Document Viewer', subtitle: 'Inspect evidence and annotate' },
  { id: 5, title: 'Report', subtitle: 'Review and export output' },
  { id: 6, title: 'Case History', subtitle: 'Review processing and user activity (manual)' }
];

export const ARR_CONNECTION = {
  path: 'case_001/ARR_docs/',
  status: 'Connected to SharePoint',
  icon: '📁',
  lastSynced: '2 minutes ago',
  document: {
    name: 'Annual Regulatory Return 2024',
    filename: 'ARR_2024.pdf',
    questions: 92,
    updated: 'Dec 2024'
  },
  description: 'Extract responses and identify risk areas'
};

export const ARR_PROCESSING_STEPS = [
  'Document structure identified',
  'Questions and responses extracted',
  'Analyzing risk indicators',
  'Mapping source locations',
  'Generating commentary'
];

export const ARR_PROCESSING_MESSAGES = [
  'Processing question 14 of 92…',
  'Processing question 32 of 92…',
  'Processing question 58 of 92…',
  'Processing question 74 of 92…',
  'Processing question 91 of 92…'
];

export const AUDIT_OPTIONS = [
  {
    id: 'aml',
    title: 'AML Compliance Audit',
    selected: true,
    description: 'Focus on matter files and AML policy commitments.',
    stats: '10 matter files • 1 policy',
    arrFlags: ['Q36', 'Q38', 'Q52']
  },
  {
    id: 'cyber',
    title: 'Cyber Security Audit',
    selected: false,
    description: 'Validates cyber policy controls against ARR commitments.',
    stats: '3 evidence docs • 1 policy',
    arrFlags: ['Q72', 'Q83']
  },
  {
    id: 'sanctions',
    title: 'Sanctions Compliance Audit',
    selected: false,
    description: 'Sanctions monitoring aligned with OFSI guidance.',
    stats: '5 checks • 1 policy',
    badge: 'ARR OK'
  }
];

export const AUDIT_CONNECTION = {
  path: 'case_001/AML_checks/',
  status: 'Connected to SharePoint',
  icon: '📁',
  lastSynced: 'Just now',
  meta: '10 documents available'
};

export const AUDIT_PROCESSING_STEPS = [
  'Policy commitments extracted (AML_Policy.pdf)',
  'Cyber policy extracted',
  'Processing matter files (4 of 10)',
  'Cross-referencing against CLC codes',
  'Generating audit findings'
];

export const REPORT_SUMMARY = {
  filename: 'CLC_Inspection_Report_Hartley_12458.pdf',
  pages: 14,
  size: '1.9 MB',
  sections: [
    'Practice details',
    'Interviews conducted',
    'Compliance summary',
    'Areas of good practice',
    'Areas requiring attention',
    'Action plan',
    'Appendix'
  ]
};
