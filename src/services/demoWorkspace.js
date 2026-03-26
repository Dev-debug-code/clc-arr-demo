import { auditDocuments, auditFindings } from '../data/auditDataset.js';
import {
  formatUploadClassificationLabel,
  normalizeUploadDraft
} from '../utils/documentUploads.js';

function coerceText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function toCanonicalFilenameKey(value) {
  const text = coerceText(value).trim().toLowerCase();
  if (!text) return '';
  const base = text.replace(/\\/g, '/').split('/').pop() ?? '';
  const stem = base.replace(/\.pdf$/i, '');
  return stem.replace(/[^a-z0-9]/g, '');
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
  return buildFilenameKeySet([uploadItem?.name, uploadItem?.filename]);
}

const SAMPLE_UPLOAD_METADATA_BY_KEY = (() => {
  const map = new Map();
  auditDocuments.forEach((documentRow) => {
    const metadata = {
      classification:
        coerceText(documentRow?.classification) ||
        coerceText(documentRow?.label) ||
        'Other',
      parties: coerceText(documentRow?.parties) || 'Firm',
      confidence: coerceText(documentRow?.confidence) || 'medium',
      summary: coerceText(documentRow?.summary)
    };
    buildDocumentLookupKeys(documentRow).forEach((key) => {
      if (key && !map.has(key)) {
        map.set(key, metadata);
      }
    });
  });
  return map;
})();

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

function lookupSampleUploadMetadata(uploadItemOrFilename) {
  const keys =
    typeof uploadItemOrFilename === 'string'
      ? buildFilenameKeySet([uploadItemOrFilename])
      : buildUploadLookupKeys(uploadItemOrFilename);

  for (const key of keys) {
    const metadata = SAMPLE_UPLOAD_METADATA_BY_KEY.get(key);
    if (metadata) return metadata;
  }
  return null;
}

function lookupSampleDocument(documentRowOrFilename) {
  const keys =
    typeof documentRowOrFilename === 'string'
      ? buildFilenameKeySet([documentRowOrFilename])
      : buildDocumentLookupKeys(documentRowOrFilename);

  for (const key of keys) {
    const sampleDoc = SAMPLE_DOCUMENT_BY_KEY.get(key);
    if (sampleDoc) return sampleDoc;
  }
  return null;
}

function enrichDocumentWithSample(documentRow) {
  const sampleDoc = lookupSampleDocument(documentRow);
  if (!sampleDoc) return documentRow;

  return {
    ...documentRow,
    classification: coerceText(documentRow?.classification) || sampleDoc.classification || 'Unknown',
    label: coerceText(documentRow?.label) || sampleDoc.label || documentRow?.id,
    name: coerceText(documentRow?.name) || sampleDoc.name || documentRow?.filename,
    filename: coerceText(documentRow?.filename) || sampleDoc.filename || documentRow?.name,
    parties: coerceText(documentRow?.parties) || sampleDoc.parties || 'Firm',
    confidence: coerceText(documentRow?.confidence) || sampleDoc.confidence || 'medium',
    summary: coerceText(documentRow?.summary) || sampleDoc.summary || '',
    severity: coerceText(documentRow?.severity) || sampleDoc.severity || 'pass',
    pdf: coerceText(documentRow?.pdf) || sampleDoc.pdf,
    overlay: {
      boxes:
        Array.isArray(sampleDoc?.overlay?.boxes) && sampleDoc.overlay.boxes.length > 0
          ? sampleDoc.overlay.boxes
          : Array.isArray(documentRow?.overlay?.boxes)
            ? documentRow.overlay.boxes
            : []
    }
  };
}

function createVirtualDocumentFromUpload(uploadItem) {
  const normalizedUploadItem = normalizeUploadDraft(uploadItem);
  const filename = coerceText(uploadItem?.filename || uploadItem?.name).trim();
  const stem = filename ? filename.replace(/\.pdf$/i, '') : '';
  const fallbackId = `upload-${toCanonicalFilenameKey(filename || String(Date.now()))}`;
  const id = stem || fallbackId;
  const sampleMetadata = lookupSampleUploadMetadata(uploadItem);
  return {
    id,
    label: stem || filename || 'Uploaded document',
    name: filename || stem || 'Uploaded document',
    filename: filename || `${id}.pdf`,
    classification:
      formatUploadClassificationLabel(normalizedUploadItem) ||
      sampleMetadata?.classification ||
      'Unknown',
    parties: coerceText(normalizedUploadItem?.parties) || sampleMetadata?.parties || 'Firm',
    confidence: coerceText(normalizedUploadItem?.confidence) || sampleMetadata?.confidence || 'low',
    status: coerceText(normalizedUploadItem?.status) || (sampleMetadata ? 'classified' : 'queued'),
    summary: coerceText(normalizedUploadItem?.summary) || sampleMetadata?.summary || '',
    uploadedOn: coerceText(normalizedUploadItem?.addedOn),
    severity: 'pass',
    pdf: filename ? `assets/case-files/${filename}` : undefined,
    overlay: {
      boxes: []
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

function isInspectorAddedFinding(finding) {
  const origin = String(finding?.origin || '').trim().toLowerCase();
  return finding?.isInspectorAdded === true || origin === 'inspector' || String(finding?.id || '').startsWith('inspector-');
}

export function prepareUploadDraft(uploadItem) {
  const sampleMetadata = lookupSampleUploadMetadata(uploadItem);
  return normalizeUploadDraft({
    ...uploadItem,
    status: coerceText(uploadItem?.status) || (sampleMetadata ? 'classified' : 'queued'),
    classification: coerceText(uploadItem?.classification) || sampleMetadata?.classification || 'Unknown',
    parties: coerceText(uploadItem?.parties) || sampleMetadata?.parties || 'Firm',
    confidence: coerceText(uploadItem?.confidence) || sampleMetadata?.confidence || 'low',
    summary:
      coerceText(uploadItem?.summary) ||
      sampleMetadata?.summary ||
      'Awaiting classification and inspector verification.'
  });
}

export function prepareWorkspaceSnapshot({ documents = [], findings = [], uploadItems = [] }) {
  const sampleDocumentsByFilenameKey = new Map();
  auditDocuments.forEach((documentRow) => {
    buildDocumentLookupKeys(documentRow).forEach((key) => {
      if (key && !sampleDocumentsByFilenameKey.has(key)) {
        sampleDocumentsByFilenameKey.set(key, documentRow);
      }
    });
  });

  const matchedSampleDocuments = [];
  const seenIds = new Set();
  uploadItems.forEach((uploadItem) => {
    const uploadKeys = buildUploadLookupKeys(uploadItem);
    for (const key of uploadKeys) {
      const sampleDoc = sampleDocumentsByFilenameKey.get(key);
      if (sampleDoc && !seenIds.has(sampleDoc.id)) {
        seenIds.add(sampleDoc.id);
        matchedSampleDocuments.push(sampleDoc);
        break;
      }
    }
  });

  const enrichedDocuments = documents.map((entry) => enrichDocumentWithSample(entry));
  let caseDocuments;

  if (matchedSampleDocuments.length === 0) {
    const seededDocuments = [...enrichedDocuments];
    const seededFilenameKeys = new Set();
    enrichedDocuments.forEach((entry) => {
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

    caseDocuments = seededDocuments;
  } else {
    const merged = [...enrichedDocuments];
    const existingIds = new Set(
      enrichedDocuments
        .map((entry) => coerceText(entry?.id).toLowerCase())
        .filter(Boolean)
    );
    const existingFilenameKeys = new Set();
    enrichedDocuments.forEach((entry) => {
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

    caseDocuments = merged;
  }

  const knownSampleIds = new Set(
    auditDocuments
      .map((entry) => coerceText(entry?.id))
      .filter(Boolean)
  );
  const sampleDocumentIdsInWorkspace = new Set(
    caseDocuments
      .map((entry) => coerceText(entry?.id))
      .filter((id) => knownSampleIds.has(id))
  );

  const matchedSampleFindings =
    sampleDocumentIdsInWorkspace.size === 0
      ? []
      : auditFindings.filter((finding) =>
          sampleDocumentIdsInWorkspace.has(coerceText(finding?.documentId))
        );

  const normalizeFinding = (finding) => {
    const explicitCodeArea = coerceText(finding?.codeArea || finding?.code_area).trim();
    if (explicitCodeArea) return finding;
    return { ...finding, codeArea: inferFindingCodeArea(finding) };
  };

  const normalizedFindings = findings.map(normalizeFinding);

  if (matchedSampleFindings.length === 0) {
    return {
      documents: caseDocuments,
      findings: normalizedFindings
    };
  }

  const preservedFindings = normalizedFindings.filter((finding) => {
    const documentId = coerceText(finding?.documentId);
    if (!sampleDocumentIdsInWorkspace.has(documentId)) {
      return true;
    }
    return isInspectorAddedFinding(finding);
  });

  return {
    documents: caseDocuments,
    findings: [...preservedFindings, ...matchedSampleFindings]
  };
}
