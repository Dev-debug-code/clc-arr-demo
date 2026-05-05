import { auditDocuments, auditFindings } from "./demo-dataset.mjs";
import { CODE_AREA_REQUIREMENT_SAMPLES } from "../src/features/inspection/config.js";
import {
  buildDocumentLookupKeys,
  buildUploadLookupKeys,
  coerceText,
  getFindingBucketId
} from "../src/features/inspection/helpers.js";
import {
  formatUploadClassificationLabel,
  normalizeUploadDraft
} from "../src/utils/documentUploads.js";

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

const FINDING_REQUIREMENT_OVERRIDES = {
  "CRIT-001": {
    id: "aml-risk-classification",
    codeArea: "aml",
    label: "Overseas clients are classified at the correct risk level",
    status: "non_compliant"
  },
  "CRIT-002": {
    id: "aml-identity-match",
    codeArea: "aml",
    label: "Identity evidence matches the client",
    status: "non_compliant"
  },
  "CRIT-003": {
    id: "aml-policy-guidance",
    codeArea: "aml",
    label: "AML policy aligns with current guidance",
    status: "non_compliant"
  },
  "WARN-001": {
    id: "aml-bank-statement-period",
    codeArea: "aml",
    label: "Bank statements cover the required period",
    status: "lead"
  },
  "WARN-002": {
    id: "aml-giftor-source-of-wealth",
    codeArea: "aml",
    label: "Giftor source of wealth is evidenced",
    status: "lead"
  },
  "BP-001": {
    id: "aml-enhanced-due-diligence",
    codeArea: "aml",
    label: "Enhanced due diligence exceeds the baseline requirement",
    status: "good_practice"
  }
};

const REQUIREMENT_DEFINITIONS = (() => {
  const map = new Map();
  Object.entries(CODE_AREA_REQUIREMENT_SAMPLES).forEach(([codeArea, rows]) => {
    rows.forEach((row) => {
      const requirementId = coerceText(row?.id);
      if (!requirementId || map.has(requirementId)) {
        return;
      }
      map.set(requirementId, {
        id: requirementId,
        codeArea,
        label: coerceText(row?.label) || requirementId,
        status: coerceText(row?.status) || "compliant"
      });
    });
  });
  Object.values(FINDING_REQUIREMENT_OVERRIDES).forEach((entry) => {
    if (!entry?.id || map.has(entry.id)) {
      return;
    }
    map.set(entry.id, {
      id: entry.id,
      codeArea: entry.codeArea,
      label: entry.label,
      status: entry.status
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
  return filename ? filename.replace(/\.[^.]+$/u, "") : `upload-${Date.now()}`;
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
    label: coerceText(sampleDocument?.label) || coerceText(sampleDocument?.name) || filename || documentId,
    name: coerceText(sampleDocument?.name) || filename || documentId,
    filename,
    classification:
      coerceText(normalizedUpload?.classification) ||
      coerceText(sampleDocument?.classification) ||
      formatUploadClassificationLabel(normalizedUpload) ||
      "Unknown",
    parties: coerceText(normalizedUpload?.parties) || coerceText(sampleDocument?.parties) || "Firm",
    confidence: coerceText(normalizedUpload?.confidence) || coerceText(sampleDocument?.confidence) || "low",
    classificationConfidence:
      normalizedUpload?.classification_confidence ??
      normalizedUpload?.classificationConfidence ??
      sampleDocument?.classificationConfidence ??
      null,
    processingStatus:
      coerceText(normalizedUpload?.processing_status || normalizedUpload?.processingStatus) ||
      coerceText(sampleDocument?.processingStatus) ||
      "",
    status: coerceText(normalizedUpload?.status) || coerceText(sampleDocument?.status) || "verified",
    confirmed: normalizedUpload?.confirmed === true || coerceText(normalizedUpload?.status) === "verified",
    summary: coerceText(normalizedUpload?.summary) || coerceText(sampleDocument?.summary),
    severity: coerceText(sampleDocument?.severity) || "pass",
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
        const override = FINDING_REQUIREMENT_OVERRIDES[coerceText(finding?.id)] ?? null;
        return {
          ...finding,
          codeArea: override?.codeArea ?? finding.codeArea,
          requirementId: override?.id ?? finding.requirementId ?? finding.requirement_id ?? "",
          requirementSeverity:
            override?.status === "lead"
              ? "warning"
              : override?.status === "good_practice"
                ? "best_practice"
                : "critical",
          reviewStatus: "unreviewed"
        };
      });
  });
}

function findingToRequirementStatus(finding) {
  const bucket = getFindingBucketId(finding);
  if (bucket === "critical") return "non_compliant";
  if (bucket === "warning") return "lead_linked";
  if (bucket === "best_practice") return "good_practice";
  return "compliant";
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
      codeArea: coerceText(finding?.codeArea || finding?.code_area) || "aml",
      label: requirementId,
      status: "compliant"
    };

    const nextStatus = findingToRequirementStatus(finding);
    const existing = byId.get(requirementId);

    if (!existing) {
      byId.set(requirementId, {
        id: definition.id,
        codeArea: definition.codeArea,
        label: definition.label,
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
    const codeAreaId = coerceText(requirement?.codeArea) || "aml";
    if (!accumulator[codeAreaId]) {
      accumulator[codeAreaId] = [];
    }
    accumulator[codeAreaId].push({
      id: requirement.id,
      label: requirement.label,
      status: requirement.status
    });
    return accumulator;
  }, {});
}

export function buildDemoGeneratedWorkspace(uploadItems = []) {
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

  const findings = buildFindingsForDocuments(documents);
  const requirements = buildRequirements(findings);

  return {
    documents,
    findings,
    requirements,
    requirementsByCodeArea: groupRequirementsByCodeArea(requirements)
  };
}
