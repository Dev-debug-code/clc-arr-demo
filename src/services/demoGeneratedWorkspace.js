import { auditDocuments, auditFindings, auditRequirements } from '../data/auditDataset.js';
import {
  buildDocumentLookupKeys,
  buildUploadLookupKeys,
  coerceText,
  getFindingBucketId
} from '../features/inspection/helpers.js';
import {
  formatUploadClassificationLabel,
  normalizeUploadDraft
} from '../utils/documentUploads.js';

const SAMPLE_DOCUMENT_BY_KEY = (() => {
  const map = new Map();
  auditDocuments.forEach((documentRow) => {
    buildDocumentLookupKeys(documentRow).forEach((key) => {
      if (key && !map.has(key)) {
        map.set(key, documentRow);
      }
    });
  });
  return map;
})();

const SAMPLE_FINDINGS_BY_DOCUMENT_ID = (() => {
  const map = new Map();
  auditFindings.forEach((finding) => {
    const documentId = coerceText(finding?.documentId);
    if (!documentId) {
      return;
    }
    const existing = map.get(documentId) ?? [];
    existing.push(finding);
    map.set(documentId, existing);
  });
  return map;
})();

const REQUIREMENT_DEFINITIONS = (() => {
  const map = new Map();
  auditRequirements.forEach((requirement) => {
    const requirementId = coerceText(requirement?.requirementId || requirement?.id);
    if (!requirementId || map.has(requirementId)) {
      return;
    }
    map.set(requirementId, {
      id: requirementId,
      codeArea: coerceText(requirement?.codeArea) || 'aml',
      codeAreaLabel: coerceText(requirement?.codeAreaLabel),
      label: coerceText(requirement?.label) || requirementId,
      content: coerceText(requirement?.content) || coerceText(requirement?.label) || requirementId,
      status: coerceText(requirement?.status) || 'compliant'
    });
  });
  return map;
})();

const REQUIREMENT_STATUS_PRIORITY = {
  non_compliant: 4,
  lead_linked: 3,
  lead: 3,
  compliant: 2,
  good_practice: 1,
  not_assessed: 0
};

function buildUploadDocumentId(uploadItem) {
  const filename = coerceText(uploadItem?.filename || uploadItem?.name);
  return filename ? filename.replace(/\.[^.]+$/u, '') : `upload-${Date.now()}`;
}

function lookupSampleDocument(uploadItem) {
  for (const key of buildUploadLookupKeys(uploadItem)) {
    const match = SAMPLE_DOCUMENT_BY_KEY.get(key);
    if (match) {
      return match;
    }
  }
  return null;
}

function buildDocumentFromUpload(uploadItem) {
  const normalizedUpload = normalizeUploadDraft(uploadItem);
  const sampleDocument = lookupSampleDocument(normalizedUpload);
  const documentId = sampleDocument?.id ?? buildUploadDocumentId(normalizedUpload);
  const filename =
    coerceText(sampleDocument?.filename) ||
    coerceText(normalizedUpload?.filename || normalizedUpload?.name) ||
    `${documentId}.pdf`;

  return {
    id: documentId,
    label:
      coerceText(sampleDocument?.label) ||
      coerceText(sampleDocument?.documentType) ||
      coerceText(sampleDocument?.name) ||
      filename ||
      documentId,
    name:
      coerceText(sampleDocument?.name) ||
      filename ||
      documentId,
    filename,
    classification:
      coerceText(normalizedUpload?.classification) ||
      coerceText(sampleDocument?.classification) ||
      coerceText(sampleDocument?.documentType) ||
      formatUploadClassificationLabel(normalizedUpload) ||
      'Unknown',
    parties:
      coerceText(normalizedUpload?.parties) ||
      coerceText(sampleDocument?.parties) ||
      'Firm',
    confidence:
      coerceText(normalizedUpload?.confidence) ||
      coerceText(sampleDocument?.confidence) ||
      'low',
    classificationConfidence:
      normalizedUpload?.classification_confidence ??
      normalizedUpload?.classificationConfidence ??
      sampleDocument?.classificationConfidence ??
      sampleDocument?.classification_confidence ??
      null,
    processingStatus:
      coerceText(normalizedUpload?.processing_status || normalizedUpload?.processingStatus) ||
      coerceText(sampleDocument?.processingStatus || sampleDocument?.processing_status) ||
      '',
    status:
      coerceText(normalizedUpload?.status) ||
      coerceText(sampleDocument?.status) ||
      'verified',
    confirmed:
      normalizedUpload?.confirmed === true ||
      coerceText(normalizedUpload?.status) === 'verified',
    summary:
      coerceText(normalizedUpload?.summary) ||
      coerceText(sampleDocument?.summary),
    severity:
      coerceText(sampleDocument?.severity) ||
      'pass',
    findings: Array.isArray(sampleDocument?.findings) ? sampleDocument.findings : [],
    overlay: {
      boxes: Array.isArray(sampleDocument?.overlay?.boxes) ? sampleDocument.overlay.boxes : []
    }
  };
}

function buildFindingsForDocuments(documents) {
  const selectedIds = new Set(documents.map((documentRow) => coerceText(documentRow?.id)).filter(Boolean));
  return documents.flatMap((documentRow) => {
    const sourceFindings = SAMPLE_FINDINGS_BY_DOCUMENT_ID.get(coerceText(documentRow?.id)) ?? [];
    return sourceFindings
      .filter((finding) => selectedIds.has(coerceText(finding?.documentId)))
      .map((finding) => {
        const severity = coerceText(finding?.severity).toLowerCase();
        return {
          ...finding,
          codeArea: coerceText(finding?.codeArea || finding?.code_area) || 'aml',
          codeAreaLabel: coerceText(finding?.codeAreaLabel),
          requirementId: coerceText(finding?.requirementId || finding?.requirement_id),
          requirementSeverity:
            severity === 'warning'
              ? 'warning'
              : severity === 'best_practice'
                ? 'best_practice'
                : 'critical',
          reviewStatus: 'unreviewed'
        };
      });
  });
}

function findingToRequirementStatus(finding) {
  const bucket = getFindingBucketId(finding);
  if (bucket === 'critical') return 'non_compliant';
  if (bucket === 'warning') return 'lead_linked';
  if (bucket === 'best_practice') return 'good_practice';
  return 'compliant';
}

function mergeRequirementStatus(currentStatus, nextStatus) {
  const currentPriority = REQUIREMENT_STATUS_PRIORITY[currentStatus] ?? -1;
  const nextPriority = REQUIREMENT_STATUS_PRIORITY[nextStatus] ?? -1;
  return nextPriority > currentPriority ? nextStatus : currentStatus;
}

function buildRequirements(findings) {
  const byId = new Map();

  findings.forEach((finding) => {
    const requirementId = coerceText(finding?.requirementId || finding?.requirement_id);
    if (!requirementId) {
      return;
    }

    const definition = REQUIREMENT_DEFINITIONS.get(requirementId) ?? {
      id: requirementId,
      codeArea: coerceText(finding?.codeArea || finding?.code_area) || 'aml',
      label: requirementId,
      status: 'compliant'
    };

    const nextStatus = findingToRequirementStatus(finding);
    const existing = byId.get(requirementId);

    if (!existing) {
      byId.set(requirementId, {
      id: definition.id,
      codeArea: definition.codeArea,
      codeAreaLabel: definition.codeAreaLabel,
      label: definition.label,
      content: definition.content,
      status: nextStatus
    });
      return;
    }

    byId.set(requirementId, {
      ...existing,
      status: mergeRequirementStatus(existing.status, nextStatus)
    });
  });

  return Array.from(byId.values()).sort((left, right) => {
    const areaCompare = left.codeArea.localeCompare(right.codeArea);
    if (areaCompare !== 0) return areaCompare;
    return left.label.localeCompare(right.label);
  });
}

function groupRequirementsByCodeArea(requirements) {
  return requirements.reduce((accumulator, requirement) => {
    const codeAreaId = coerceText(requirement?.codeArea) || 'aml';
    if (!accumulator[codeAreaId]) {
      accumulator[codeAreaId] = [];
    }
      accumulator[codeAreaId].push({
        id: requirement.id,
        codeAreaLabel: requirement.codeAreaLabel,
        label: requirement.label,
        content: requirement.content,
        status: requirement.status
      });
    return accumulator;
  }, {});
}

export function buildRequirementsFromFindings(findings = []) {
  return buildRequirements(Array.isArray(findings) ? findings : []);
}

export function groupRequirementsForDisplay(requirements = []) {
  return groupRequirementsByCodeArea(Array.isArray(requirements) ? requirements : []);
}

export function buildDocumentsFromUploads(uploadItems = []) {
  const normalizedUploads = uploadItems.map((item) => normalizeUploadDraft(item));
  const documents = [];
  const seenDocumentIds = new Set();

  normalizedUploads.forEach((item) => {
    const documentRow = buildDocumentFromUpload(item);
    const documentId = coerceText(documentRow?.id);
    if (documentId && seenDocumentIds.has(documentId)) {
      return;
    }
    if (documentId) {
      seenDocumentIds.add(documentId);
    }
    documents.push(documentRow);
  });

  return documents;
}

export function buildDemoGeneratedWorkspace(uploadItems = []) {
  const documents = buildDocumentsFromUploads(uploadItems);
  const findings = buildFindingsForDocuments(documents);
  const requirements = buildRequirements(findings);

  return {
    documents,
    findings,
    requirements,
    requirementsByCodeArea: groupRequirementsByCodeArea(requirements)
  };
}
