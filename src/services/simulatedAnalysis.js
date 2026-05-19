import {
  isUploadIncludedInFindingsGeneration,
  normalizeUploadDraft
} from '../utils/documentUploads.js';
import { auditDocuments } from '../data/auditDataset.js';
import {
  buildDemoGeneratedWorkspace,
  buildDocumentsFromUploads
} from './demoGeneratedWorkspace.js';
import {
  buildDocumentLookupKeys,
  buildUploadLookupKeys
} from '../features/inspection/helpers.js';

function coerceText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
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
    if (match) return match;
  }
  return null;
}

export function suggestClassificationFromFilename(filename) {
  const name = String(filename ?? '').toLowerCase();
  if (!name) return 'Other';
  if ((name.includes('estate') && name.includes('distribution')) || (name.includes('solicitor') && name.includes('distribution'))) {
    return 'Estate Distribution Letter';
  }
  if (name.includes('source') && name.includes('fund') && name.includes('schedule')) {
    return 'Source of Funds Schedule';
  }
  if (name.includes('lender') && name.includes('disclosure') && (name.includes('note') || name.includes('file'))) {
    return 'Lender Disclosure File Note';
  }
  if (name.includes('interview') || name.includes('mlro')) return 'Interview Transcript';
  if ((name.includes('client') && name.includes('care')) || (name.includes('terms') && name.includes('engagement'))) {
    return 'Client Care Letter';
  }
  if (name.includes('pep')) return 'PEP Screening';
  if (name.includes('sanction')) return 'Sanctions Screening';
  if (name.includes('risk') && name.includes('assessment')) return 'Client Risk Assessment';
  if (name.includes('proof') && name.includes('address')) return 'Proof of Address';
  if (name.includes('giftor') && name.includes('id')) return 'Giftor ID Verification';
  if (name.includes('giftor') && name.includes('source')) return 'Giftor Source of Funds';
  if (name.includes('gift') && name.includes('letter')) return 'Gift Letter';
  if (name.includes('identity') || (name.includes('client') && name.includes('id'))) return 'Identity Verification';
  if (name.includes('bank') || name.includes('statement')) return 'Bank Statement';
  if (name.includes('complaint')) return 'Complaints Procedure';
  if (name.includes('source') || name.includes('fund')) return 'Source of Funds Declaration';
  if (name.includes('policy') || name.includes('aml')) return 'AML Policy';
  if (name.includes('training')) return 'Training Register';
  if (name.includes('cdd')) return 'CDD Records';
  return 'Other';
}

export function buildClassificationReason(filename, classification) {
  const cleanFilename = coerceText(filename) || 'document';
  const cleanClassification = coerceText(classification) || 'Unknown';

  if (cleanClassification === 'Other' || cleanClassification === 'Unknown') {
    return `The classifier could not map ${cleanFilename} confidently to a known document type.`;
  }

  return `The classifier matched ${cleanFilename} to ${cleanClassification} using document-name and content cues.`;
}

export function buildSimulatedClassifiedUploads(uploadItems = []) {
  const normalizedUploads = uploadItems.map((item) => normalizeUploadDraft(item));
  const changedUploadIds = [];

  const classifiedUploads = normalizedUploads.map((item) => {
    if (item.status !== 'queued') {
      return normalizeUploadDraft({ ...item, isLocalDraft: false });
    }

    const sampleDocument = lookupSampleDocument(item);
    const suggestedClassification =
      coerceText(sampleDocument?.classification) ||
      suggestClassificationFromFilename(item.name || item.filename);
    changedUploadIds.push(item.id);

    return normalizeUploadDraft({
      ...item,
      isLocalDraft: false,
      status: 'classified',
      confirmed: sampleDocument?.confirmed === true,
      classification: suggestedClassification,
      confidence:
        coerceText(sampleDocument?.confidence) ||
        (suggestedClassification === 'Other' ? 'low' : 'high'),
      classification_confidence:
        sampleDocument?.classificationConfidence ??
        sampleDocument?.classification_confidence ??
        (suggestedClassification === 'Other' ? null : 0.98),
      classificationReason: buildClassificationReason(item.name || item.filename, suggestedClassification),
      summary:
        item.summary ||
        coerceText(sampleDocument?.summary) ||
        `Classification suggests ${suggestedClassification}. Review and confirm before generating findings.`
    });
  });

  return {
    uploadItems: classifiedUploads,
    changedUploads: classifiedUploads.filter((item) => changedUploadIds.includes(item.id)),
    documents: buildDocumentsFromUploads(classifiedUploads)
  };
}

export function buildSimulatedFindingsWorkspace(uploadItems = []) {
  const verifiedUploads = uploadItems
    .map((item) => normalizeUploadDraft(item))
    .filter(
      (item) =>
        isUploadIncludedInFindingsGeneration(item)
    );

  return buildDemoGeneratedWorkspace(verifiedUploads);
}
