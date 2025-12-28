export const NAV_TABS = [
  { id: 'arr', label: 'ARR Analysis', stepRange: [1, 3] },
  { id: 'audits', label: 'Compliance Audits', stepRange: [4, 6] },
  { id: 'reports', label: 'Reports', stepRange: [7, 7] }
];

export const STEP_CONFIG = [
  { id: 1, title: 'ARR Connection', subtitle: 'Auto-detect ARR document inside workspace' },
  { id: 2, title: 'ARR Processing', subtitle: 'Extraction + risk detection' },
  { id: 3, title: 'ARR Results', subtitle: 'PDF + commentary view' },
  { id: 4, title: 'Audit Selection', subtitle: 'Choose which audits to run' },
  { id: 5, title: 'Audit Processing', subtitle: 'Cross-checking policies and matters' },
  { id: 6, title: 'Audit Findings', subtitle: 'Interactive findings dashboard' },
  { id: 7, title: 'Export Report', subtitle: 'Distribute polished PDF output' }
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

export const ARR_COMMENTARY = [
  {
    id: 'Q36',
    severity: 'critical',
    title: 'Client money reconciliations missing narrative',
    detail:
      'ARR response states reconciliations occurred, but supporting commentary is missing enhanced detail and fall-back procedure.',
    boundingBox: { top: 8, left: 10, width: 76, height: 10 },
    page: 4
  },
  {
    id: 'Q38',
    severity: 'warning',
    title: 'Annual training evidence references 2022 policy',
    detail:
      'Team referenced policy version dated Feb 2022. ARR requires confirmation against post-2023 update with s.23 acknowledgements.',
    boundingBox: { top: 23, left: 12, width: 70, height: 9 },
    page: 4
  },
  {
    id: 'Q52',
    severity: 'warning',
    title: 'Matter sampling doesn’t include higher risk files',
    detail:
      'ARR summary lists only conveyancing files. AML policy mandates one litigation matter per quarter in the sample set.',
    boundingBox: { top: 38, left: 14, width: 68, height: 10 },
    page: 7
  },
  {
    id: 'Q72',
    severity: 'note',
    title: 'Cyber incident response timers look healthy',
    detail:
      'ARR states table-top exercise executed in Aug 2024 with response time under 30 minutes. Noted for cross-reference.',
    boundingBox: { top: 55, left: 10, width: 74, height: 10 },
    page: 11
  }
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
    selected: true,
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

export const FINDING_SUMMARY = [
  { id: 'critical', label: 'Critical', count: 2 },
  { id: 'warning', label: 'Warnings', count: 3 },
  { id: 'pass', label: 'Passed', count: 5 }
];

export const AUDIT_FINDINGS = [
  {
    id: 'AML-001',
    rule: 'AML-001',
    matter: 'Matter_004',
    severity: 'critical',
    title: 'Enhanced due diligence not evidenced',
    detail:
      'Matter references Politically Exposed Person but there is no uploaded approval trail. ARR Q36 flagged the same gap.',
    actions: { policy: 'AML_Policy.pdf', matter: 'Matter_004' }
  },
  {
    id: 'AML-014',
    rule: 'AML-014',
    matter: 'Matter_007',
    severity: 'warning',
    title: 'Missing second reviewer sign-off',
    detail:
      'ARR response promised dual-control for reconciliations above £500k but sampled matter shows only preparer signoff.',
    actions: { policy: 'AML_Policy.pdf', matter: 'Matter_007' }
  },
  {
    id: 'CYB-022',
    rule: 'CYB-022',
    matter: 'Policy',
    severity: 'warning',
    title: 'Incident response workbook outdated',
    detail: 'ARR Q72 references Aug 2024 workshop but cyber policy document is still versioned 2023. ',
    actions: { policy: 'Cyber_Policy.pdf' }
  },
  {
    id: 'AML-020',
    rule: 'AML-020',
    matter: 'Matter_002',
    severity: 'pass',
    title: 'Source of funds documented',
    detail: 'Evidence matched ARR commentary. Included here for completeness.',
    actions: { matter: 'Matter_002' }
  },
  {
    id: 'SAN-004',
    rule: 'SAN-004',
    matter: 'Matter_009',
    severity: 'critical',
    title: 'Sanctions screening overdue',
    detail: 'ARR had no concerns but audit review located a file older than 30 days without screening evidence.',
    actions: { matter: 'Matter_009' }
  }
];

export const DOCUMENT_TABS = [
  {
    id: 'policy',
    label: 'Policy',
    status: 'warning',
    summary: 'AML_Policy.pdf • Updated Jan 2023',
    highlights: [
      'Section 4.2 references monthly reconciliations but lacks cross-signer detail.',
      'Training acknowledgements appended for FY22 only.'
    ]
  },
  ...Array.from({ length: 9 }, (_, index) => {
    const matterIndex = index + 1;
    const severityTemplate = ['pass', 'warning', 'pass', 'critical', 'pass', 'warning', 'critical', 'pass', 'pass'];
    const severity = severityTemplate[index] ?? 'pass';
    return {
      id: `matter_${String(matterIndex).padStart(3, '0')}`,
      label: `Matter_${String(matterIndex).padStart(3, '0')}`,
      status: severity,
      summary: `Client file ${matterIndex.toString().padStart(3, '0')} — Conveyancing`,
      highlights: [
        'Client onboarding pack uploaded.',
        severity === 'critical'
          ? 'Enhanced checks missing supporting file.'
          : severity === 'warning'
            ? 'One outstanding signer acknowledgement.'
            : 'All ARR commitments satisfied.'
      ]
    };
  })
];

export const REPORT_SUMMARY = {
  filename: 'CLC_Audit_Report_Case001.pdf',
  pages: 18,
  size: '2.4 MB',
  sections: ['Executive Summary', 'ARR Analysis', 'AML Findings', 'Cyber Findings', 'Remediation Steps']
};
