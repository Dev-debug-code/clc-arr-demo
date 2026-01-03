import summaryDocument from './caseFiles/summary_document.json';
import policyDoc from './caseFiles/00_Firm_AML_Policy.json';
import clientIdDoc from './caseFiles/01_Client_ID_Verification.json';
import proofAddressDoc from './caseFiles/02_Proof_of_Address.json';
import riskAssessmentDoc from './caseFiles/03_Client_Risk_Assessment.json';
import sofDeclarationDoc from './caseFiles/04_Source_of_Funds_Declaration.json';
import bankStatementsDoc from './caseFiles/05_Bank_Statements_Client.json';
import giftLetterDoc from './caseFiles/06_Gift_Letter.json';
import giftorIdDoc from './caseFiles/07_Giftor_ID_Verification.json';
import giftorSofDoc from './caseFiles/08_Giftor_Source_of_Funds.json';
import sanctionsDoc from './caseFiles/09_Sanctions_Screening.json';
import pepDoc from './caseFiles/10_PEP_Screening.json';

const rawDocuments = [
  policyDoc,
  clientIdDoc,
  proofAddressDoc,
  riskAssessmentDoc,
  sofDeclarationDoc,
  bankStatementsDoc,
  giftLetterDoc,
  giftorIdDoc,
  giftorSofDoc,
  sanctionsDoc,
  pepDoc
];

const severityMap = {
  critical: 'critical',
  warning: 'warning',
  pass: 'pass',
  best_practice: 'best_practice',
  note: 'note'
};

function normaliseSeverity(value, fallback = 'pass') {
  const key = (value || '').toLowerCase();
  return severityMap[key] ?? fallback;
}

function buildOverlayBoxes(doc) {
  if (!Array.isArray(doc.findings)) return [];
  return doc.findings
    .map((finding, index) => {
      const bbox = finding?.source?.bbox;
      if (!Array.isArray(bbox) || bbox.length !== 4) {
        return null;
      }
      const page = Number.isFinite(finding?.source?.page) ? finding.source.page : 1;
      const id = finding.id ?? `${doc.file_id || doc.filename}-box-${index + 1}`;
      return {
        id,
        bbox,
        pageno: page,
        category: finding?.source?.section ?? doc.document_type,
        severity: normaliseSeverity(finding?.type, doc.severity),
        title: finding.title ?? doc.document_type,
        details: finding.deviation ?? finding?.source?.text ?? ''
      };
    })
    .filter(Boolean);
}

export const auditDocuments = rawDocuments.map((doc) => ({
  ...doc,
  id: doc.file_id ?? doc.filename,
  label: doc.document_type ?? doc.file_id ?? doc.filename,
  severity: normaliseSeverity(doc.severity, 'pass'),
  pdf: `assets/case-files/${doc.filename}`,
  overlay: {
    boxes: buildOverlayBoxes(doc)
  }
}));

export const auditFindings = rawDocuments.flatMap((doc) => {
  if (!Array.isArray(doc.findings) || doc.findings.length === 0) {
    return [];
  }
  return doc.findings.map((finding, index) => {
    const derivedId = finding.id ?? `${doc.file_id || doc.filename}-finding-${index + 1}`;
    return {
      id: derivedId,
      severity: normaliseSeverity(finding.type, doc.severity),
      title: finding.title ?? doc.document_type,
      detail: finding.deviation ?? finding?.source?.text ?? '',
      documentId: doc.file_id ?? doc.filename,
      boxId: finding.id ?? derivedId,
      source: finding.source,
      reference: finding.reference
    };
  });
});

export const auditSummary = summaryDocument;

export function buildSummaryCards() {
  const summary = summaryDocument?.summary ?? {};
  const cards = [
    { id: 'critical', label: 'Critical', count: summary.critical ?? 0 },
    { id: 'warning', label: 'Warnings', count: summary.warning ?? 0 },
    { id: 'pass', label: 'Passed', count: summary.pass ?? 0 },
    { id: 'best_practice', label: 'Best Practice', count: summary.best_practice ?? 0 }
  ];
  return cards.filter((card) => typeof card.count === 'number');
}
