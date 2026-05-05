import auditCaseDoc from './demoFirestoreDump/case.json';

const documentModules = import.meta.glob('./demoFirestoreDump/documents/*.json', { eager: true });
const findingModules = import.meta.glob('./demoFirestoreDump/findings/*.json', { eager: true });
const requirementModules = import.meta.glob('./demoFirestoreDump/requirements/*.json', { eager: true });

function asJson(moduleValue) {
  return moduleValue?.default ?? moduleValue ?? {};
}

function coerceText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function compareByStableId(left, right) {
  const leftId = coerceText(left?.id || left?.requirementId || left?.filename);
  const rightId = coerceText(right?.id || right?.requirementId || right?.filename);
  return leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: 'base' });
}

function normaliseSeverity(value, fallback = 'pass') {
  const normalized = coerceText(value).toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'warning') return 'warning';
  if (normalized === 'best_practice') return 'best_practice';
  if (normalized === 'pass') return 'pass';
  return fallback;
}

function preferredClassification(classification, documentType) {
  const cleanClassification = coerceText(classification);
  const cleanDocumentType = coerceText(documentType);
  if (cleanClassification && cleanClassification.toLowerCase() !== 'other') {
    return cleanClassification;
  }
  return cleanDocumentType || cleanClassification || 'Unknown';
}

function buildFindingSource(finding) {
  if (finding?.source && typeof finding.source === 'object') {
    return finding.source;
  }

  const firstPassage = Array.isArray(finding?.evidencePassages)
    ? finding.evidencePassages[0]
    : Array.isArray(finding?.evidence_passages)
      ? finding.evidence_passages[0]
      : null;

  if (!firstPassage || typeof firstPassage !== 'object') {
    return null;
  }

  return {
    file: firstPassage.file ?? '',
    page: firstPassage.page ?? 1,
    section: firstPassage.section ?? '',
    text: firstPassage.text ?? ''
  };
}

const rawDocuments = Object.values(documentModules).map(asJson).sort(compareByStableId);
const rawFindings = Object.values(findingModules).map(asJson).sort(compareByStableId);
const rawRequirements = Object.values(requirementModules).map(asJson).sort(compareByStableId);

export const auditRequirements = rawRequirements.map((requirement) => ({
  ...requirement,
  id: coerceText(requirement.requirementId || requirement.id),
  requirementId: coerceText(requirement.requirementId || requirement.id),
  codeArea: coerceText(requirement.codeArea) || 'aml',
  label: coerceText(requirement.label) || coerceText(requirement.requirementId || requirement.id),
  status: coerceText(requirement.status) || 'compliant'
}));

export const auditDocuments = rawDocuments.map((documentRow) => {
  const filename = coerceText(documentRow.filename || documentRow.name || documentRow.id);
  const classification = preferredClassification(documentRow.classification, documentRow.documentType);
  return {
    ...documentRow,
    id: coerceText(documentRow.id || filename.replace(/\.[^.]+$/u, '')) || filename,
    label: coerceText(documentRow.documentType) || classification || filename,
    name: coerceText(documentRow.name) || filename,
    filename,
    classification,
    documentType: coerceText(documentRow.documentType) || classification,
    confidence: coerceText(documentRow.confidence) || 'medium',
    severity: normaliseSeverity(documentRow.severity, 'warning'),
    pdf: filename ? `assets/case-files/${filename}` : undefined,
    overlay: {
      boxes: Array.isArray(documentRow.overlayBoxes) ? documentRow.overlayBoxes : []
    }
  };
});

export const auditFindings = rawFindings.map((finding) => {
  const severity = normaliseSeverity(finding.severity, 'critical');
  const isGoodPractice =
    finding.isGoodPractice === true ||
    finding.is_good_practice === true ||
    severity === 'best_practice';
  const evidencePassages = Array.isArray(finding.evidencePassages)
    ? finding.evidencePassages
    : Array.isArray(finding.evidence_passages)
      ? finding.evidence_passages
      : [];

  return {
    ...finding,
    id: coerceText(finding.id),
    severity,
    codeArea: coerceText(finding.codeArea || finding.code_area) || 'aml',
    title: coerceText(finding.title) || 'Finding',
    detail: coerceText(finding.detail),
    documentId: coerceText(finding.documentId || finding.document_id),
    boxId: coerceText(finding.boxId || finding.box_id || finding.id),
    certainty: coerceText(finding.certainty) || (severity === 'warning' ? 'lead' : 'finding'),
    polarity: coerceText(finding.polarity) || (isGoodPractice ? 'compliant' : 'non_compliant'),
    isGoodPractice,
    is_good_practice: isGoodPractice,
    reviewStatus: coerceText(finding.reviewStatus || finding.review_status) || 'unreviewed',
    source: buildFindingSource(finding),
    evidencePassages,
    evidence_passages: evidencePassages
  };
});

export const auditSummary = {
  summary: {
    critical: auditFindings.filter((finding) => finding.severity === 'critical').length,
    warning: auditFindings.filter((finding) => finding.severity === 'warning').length,
    pass: auditRequirements.filter((requirement) => requirement.status === 'compliant').length,
    best_practice: auditFindings.filter((finding) => finding.severity === 'best_practice').length
  }
};

export const auditCase = auditCaseDoc;

export function buildSummaryCards() {
  const summary = auditSummary.summary;
  return [
    { id: 'critical', label: 'Critical', count: summary.critical ?? 0 },
    { id: 'warning', label: 'Warnings', count: summary.warning ?? 0 },
    { id: 'pass', label: 'Passed', count: summary.pass ?? 0 },
    { id: 'best_practice', label: 'Best Practice', count: summary.best_practice ?? 0 }
  ].filter((card) => typeof card.count === 'number');
}
