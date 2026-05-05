import {
  formatUploadClassificationLabel,
  normalizeUploadDraft
} from '../utils/documentUploads.js';
import { auditDocuments } from '../data/auditDataset.js';

function coerceText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function toCanonicalFilenameKey(value) {
  const text = coerceText(value).trim().toLowerCase();
  if (!text) return '';
  const base = text.replace(/\\/g, '/').split('/').pop() ?? '';
  const stem = base.replace(/\.[^.]+$/u, '');
  return stem.replace(/[^a-z0-9]/gu, '');
}

function buildFilenameKeySet(values) {
  const keys = new Set();
  values.forEach((entry) => {
    const key = toCanonicalFilenameKey(entry);
    if (key) {
      keys.add(key);
    }
  });
  return keys;
}

function buildDocumentLookupKeys(documentRow) {
  return buildFilenameKeySet([
    documentRow?.id,
    documentRow?.label,
    documentRow?.name,
    documentRow?.filename,
    documentRow?.pdf
  ]);
}

function buildUploadLookupKeys(uploadItem) {
  return buildFilenameKeySet([uploadItem?.id, uploadItem?.name, uploadItem?.filename]);
}

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

function lookupSampleDocument(uploadItem) {
  for (const key of buildUploadLookupKeys(uploadItem)) {
    const match = SAMPLE_DOCUMENT_BY_KEY.get(key);
    if (match) {
      return match;
    }
  }
  return null;
}

function createVirtualDocumentFromUpload(uploadItem) {
  const normalizedUploadItem = normalizeUploadDraft(uploadItem);
  const sampleDocument = lookupSampleDocument(normalizedUploadItem);
  const filename = coerceText(normalizedUploadItem?.filename || normalizedUploadItem?.name).trim();
  const stem = filename ? filename.replace(/\.[^.]+$/u, '') : '';
  const fallbackId = `upload-${toCanonicalFilenameKey(filename || String(Date.now()))}`;
  const id = coerceText(sampleDocument?.id).trim() || stem || fallbackId;
  return {
    id,
    label:
      coerceText(sampleDocument?.label).trim() ||
      coerceText(sampleDocument?.name).trim() ||
      stem ||
      filename ||
      'Uploaded document',
    name:
      coerceText(sampleDocument?.name).trim() ||
      filename ||
      stem ||
      'Uploaded document',
    filename: coerceText(sampleDocument?.filename).trim() || filename || `${id}.pdf`,
    classification:
      coerceText(sampleDocument?.classification).trim() ||
      formatUploadClassificationLabel(normalizedUploadItem) ||
      'Unknown',
    parties: coerceText(normalizedUploadItem?.parties) || coerceText(sampleDocument?.parties) || 'Firm',
    confidence: coerceText(normalizedUploadItem?.confidence) || coerceText(sampleDocument?.confidence) || 'low',
    status: coerceText(normalizedUploadItem?.status) || 'queued',
    summary: coerceText(normalizedUploadItem?.summary) || coerceText(sampleDocument?.summary),
    uploadedOn: coerceText(normalizedUploadItem?.addedOn) || coerceText(sampleDocument?.uploadedOn),
    severity: coerceText(sampleDocument?.severity) || 'pass',
    pdf:
      coerceText(sampleDocument?.pdf).trim() ||
      (coerceText(sampleDocument?.filename).trim()
        ? `assets/case-files/${coerceText(sampleDocument?.filename).trim()}`
        : filename
          ? `assets/case-files/${filename}`
          : undefined),
    findings: Array.isArray(sampleDocument?.findings) ? sampleDocument.findings : [],
    overlay: {
      boxes: Array.isArray(sampleDocument?.overlay?.boxes) ? sampleDocument.overlay.boxes : []
    }
  };
}

function enrichDocumentWithUpload(documentRow, uploadItem) {
  if (!uploadItem) {
    return documentRow;
  }

  const normalizedUploadItem = normalizeUploadDraft(uploadItem);
  const filename =
    coerceText(documentRow?.filename).trim() ||
    coerceText(normalizedUploadItem?.filename || normalizedUploadItem?.name).trim();
  const label =
    coerceText(documentRow?.label).trim() ||
    coerceText(documentRow?.name).trim() ||
    filename ||
    documentRow?.id;
  const classification =
    coerceText(documentRow?.classification).trim() ||
    formatUploadClassificationLabel(normalizedUploadItem) ||
    'Unknown';
  const confidence =
    coerceText(documentRow?.confidence).trim() ||
    coerceText(normalizedUploadItem?.confidence).trim() ||
    'medium';

  return {
    ...documentRow,
    label,
    name: coerceText(documentRow?.name).trim() || filename || label,
    filename: filename || documentRow?.id,
    classification,
    parties: coerceText(documentRow?.parties).trim() || coerceText(normalizedUploadItem?.parties).trim() || 'Firm',
    confidence,
    summary: coerceText(documentRow?.summary).trim() || coerceText(normalizedUploadItem?.summary).trim(),
    status: coerceText(documentRow?.status).trim() || coerceText(normalizedUploadItem?.status).trim() || 'verified',
    uploadedOn: coerceText(documentRow?.uploadedOn).trim() || coerceText(normalizedUploadItem?.addedOn).trim(),
    pdf: coerceText(documentRow?.pdf).trim() || (filename ? `assets/case-files/${filename}` : undefined),
    findings: Array.isArray(documentRow?.findings) ? documentRow.findings : [],
    overlay: {
      boxes: Array.isArray(documentRow?.overlay?.boxes) ? documentRow.overlay.boxes : []
    }
  };
}

function inferFindingCodeArea(finding) {
  const referenceText =
    `${coerceText(finding?.reference)} ${coerceText(finding?.title)} ${coerceText(finding?.detail)}`.toLowerCase();
  if (referenceText.includes('complaint')) return 'complaints';
  if (referenceText.includes('client care') || referenceText.includes('engagement')) return 'client-care';
  if (
    referenceText.includes('residual balance') ||
    referenceText.includes('reconciliation') ||
    referenceText.includes('client account')
  ) {
    return 'accounts';
  }
  if (referenceText.includes('undertaking')) return 'undertakings';
  if (referenceText.includes('management') || referenceText.includes('supervision')) return 'management';
  if (
    referenceText.includes('aml') ||
    referenceText.includes('money laundering') ||
    referenceText.includes('source of funds') ||
    referenceText.includes('passport') ||
    referenceText.includes('giftor')
  ) {
    return 'aml';
  }
  return 'aml';
}

function normalizeFinding(finding) {
  const explicitCodeArea = coerceText(finding?.codeArea || finding?.code_area).trim();
  if (explicitCodeArea) return finding;
  return { ...finding, codeArea: inferFindingCodeArea(finding) };
}

export function prepareUploadDraft(uploadItem) {
  return normalizeUploadDraft(uploadItem);
}

export function prepareWorkspaceSnapshot({ documents = [], findings = [], uploadItems = [] }) {
  const normalizedUploads = uploadItems.map((item) => normalizeUploadDraft(item));
  const uploadsByKey = new Map();

  normalizedUploads.forEach((uploadItem) => {
    buildUploadLookupKeys(uploadItem).forEach((key) => {
      if (key && !uploadsByKey.has(key)) {
        uploadsByKey.set(key, uploadItem);
      }
    });
  });

  const caseDocuments = [];
  const existingDocumentIds = new Set();
  const existingFilenameKeys = new Set();

  documents.forEach((documentRow) => {
    const documentId = coerceText(documentRow?.id).trim().toLowerCase();
    if (documentId && existingDocumentIds.has(documentId)) {
      return;
    }

    let matchedUpload = null;
    for (const key of buildDocumentLookupKeys(documentRow)) {
      existingFilenameKeys.add(key);
      if (!matchedUpload && uploadsByKey.has(key)) {
        matchedUpload = uploadsByKey.get(key);
      }
    }

    caseDocuments.push(enrichDocumentWithUpload(documentRow, matchedUpload));
    if (documentId) {
      existingDocumentIds.add(documentId);
    }
  });

  normalizedUploads.forEach((uploadItem) => {
    const uploadKeys = buildUploadLookupKeys(uploadItem);
    const alreadyRepresented = [...uploadKeys].some((key) => existingFilenameKeys.has(key));
    if (alreadyRepresented || uploadKeys.size === 0) {
      return;
    }

    const virtualDoc = createVirtualDocumentFromUpload(uploadItem);
    caseDocuments.push(virtualDoc);
    buildDocumentLookupKeys(virtualDoc).forEach((key) => existingFilenameKeys.add(key));
    const virtualId = coerceText(virtualDoc?.id).trim().toLowerCase();
    if (virtualId) {
      existingDocumentIds.add(virtualId);
    }
  });

  return {
    documents: caseDocuments,
    findings: findings.map(normalizeFinding)
  };
}
