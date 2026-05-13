import { REQUIREMENT_SEVERITY_BY_ID } from './config.js';

export const coerceText = (value) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

export const textOf = (value, fallback = '') => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

export const safeText = (value, fallback = '') => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!value) return fallback;
  if (Array.isArray(value)) {
    const flattened = value
      .map((entry) => safeText(entry, ''))
      .map((entry) => entry.trim())
      .filter(Boolean);
    return flattened.length > 0 ? flattened.join(' · ') : fallback;
  }
  if (typeof value === 'object') {
    const candidates = [value.text, value.excerpt, value.value, value.label, value.name];
    for (const candidate of candidates) {
      const text = safeText(candidate, '');
      if (text) return text;
    }
    return fallback;
  }
  return fallback;
};

export const toCanonicalFilenameKey = (value) => {
  const text = coerceText(value).trim().toLowerCase();
  if (!text) return '';
  const base = text.replace(/\\/g, '/').split('/').pop() ?? '';
  const stem = base.replace(/\.pdf$/i, '');
  return stem.replace(/[^a-z0-9]/g, '');
};

export const buildFilenameKeySet = (values) => {
  const keys = new Set();
  values.forEach((entry) => {
    const key = toCanonicalFilenameKey(entry);
    if (key) {
      keys.add(key);
    }
  });
  return keys;
};

export const buildDocumentLookupKeys = (documentRow) =>
  buildFilenameKeySet([
    documentRow?.id,
    documentRow?.label,
    documentRow?.name,
    documentRow?.filename,
    documentRow?.pdf
  ]);

export const buildUploadLookupKeys = (uploadItem) =>
  buildFilenameKeySet([uploadItem?.name, uploadItem?.filename]);

export const inferRequirementCodeArea = (requirement) => {
  const value = String(requirement || '').trim().toLowerCase();
  if (!value) return 'aml';
  if (value.startsWith('afl') || value.includes('acting for lender') || (value.includes('lender') && !value.includes('client'))) return 'lenders';
  if (value.startsWith('cmp') || value.includes('complaint')) return 'complaints';
  if (value.startsWith('ac') || value.includes('account')) return 'accounts';
  if (value.startsWith('cc') || value.includes('client care') || value.includes('engagement') || value.includes('costs') || value.includes('fee')) return 'client-care';
  if (value.includes('undertaking')) return 'undertakings';
  if (value.startsWith('mg') || value.includes('management') || value.includes('supervision')) return 'management';
  return 'aml';
};

export const getRequirementSeverity = (requirement) => REQUIREMENT_SEVERITY_BY_ID[requirement] ?? 'warning';

export const isInspectorAddedFinding = (finding) => {
  const origin = String(finding?.origin || '').trim().toLowerCase();
  return finding?.isInspectorAdded === true || origin === 'inspector' || String(finding?.id || '').startsWith('inspector-');
};

export const deriveLegacyFindingSeverity = (finding) => {
  const reviewStatus = String(finding?.reviewStatus || finding?.review_status || '').trim().toLowerCase();
  const rawCertainty = String(finding?.certainty || '').trim().toLowerCase();
  const certainty =
    reviewStatus === 'confirmed' || ((reviewStatus === 'accepted' || reviewStatus === 'rejected') && rawCertainty === 'lead')
      ? 'finding'
      : rawCertainty;
  const polarity = String(finding?.polarity || '').trim().toLowerCase();
  const isGoodPractice = finding?.isGoodPractice === true || finding?.is_good_practice === true;

  if (isGoodPractice) return 'best_practice';
  if (polarity === 'compliant') return 'pass';
  if (certainty === 'lead') return 'warning';

  const fallbackSeverity = String(finding?.severity || '').trim().toLowerCase();
  if (fallbackSeverity === 'best_practice' || fallbackSeverity === 'pass') return fallbackSeverity;
  if (fallbackSeverity === 'warning') return 'critical';
  return fallbackSeverity || 'critical';
};

export const getFindingBucketId = (finding) => deriveLegacyFindingSeverity(finding);

export const getFindingEffectiveCertainty = (finding) => {
  const reviewStatus = String(finding?.reviewStatus || finding?.review_status || '').trim().toLowerCase();
  const certainty = String(finding?.certainty || '').trim().toLowerCase();
  if (
    reviewStatus === 'confirmed' ||
    ((reviewStatus === 'accepted' || reviewStatus === 'rejected') && certainty === 'lead')
  ) {
    return 'finding';
  }

  if (certainty) return certainty;

  return getFindingBucketId(finding) === 'warning' ? 'lead' : 'finding';
};

export const isLeadFindingByTaxonomy = (finding) => getFindingEffectiveCertainty(finding) === 'lead';

export const findingReferencesDocument = (finding, documentId) => {
  const targetDocumentId = coerceText(documentId);
  if (!finding || !targetDocumentId) return false;

  if (coerceText(finding?.documentId) === targetDocumentId) {
    return true;
  }

  const rawPassages = Array.isArray(finding?.evidence_passages)
    ? finding.evidence_passages
    : Array.isArray(finding?.evidencePassages)
      ? finding.evidencePassages
      : [];

  return rawPassages.some((passage) => {
    const passageDocumentId = coerceText(
      passage?.document_id || passage?.documentId || finding?.documentId
    );
    return passageDocumentId === targetDocumentId;
  });
};

export const collectFindingBoxIdsForDocument = (finding, documentId) => {
  const targetDocumentId = coerceText(documentId);
  const ids = new Set();
  if (!finding || !targetDocumentId) {
    return ids;
  }

  const findingDocumentId = coerceText(finding?.documentId);
  const fallbackBoxId = coerceText(finding?.boxId);
  if (findingDocumentId === targetDocumentId && fallbackBoxId) {
    ids.add(fallbackBoxId);
  }

  const rawPassages = Array.isArray(finding?.evidence_passages)
    ? finding.evidence_passages
    : Array.isArray(finding?.evidencePassages)
      ? finding.evidencePassages
      : [];

  rawPassages.forEach((passage) => {
    const passageDocumentId = coerceText(
      passage?.document_id || passage?.documentId || findingDocumentId
    );
    const passageBoxId = coerceText(passage?.box_id || passage?.boxId);
    if (passageDocumentId === targetDocumentId && passageBoxId) {
      ids.add(passageBoxId);
    }
  });

  return ids;
};

export const getFindingPreferredBoxIdForDocument = (finding, documentId) => {
  const relatedBoxIds = Array.from(collectFindingBoxIdsForDocument(finding, documentId));
  if (relatedBoxIds.length > 0) {
    return relatedBoxIds[0];
  }

  return coerceText(finding?.documentId) === coerceText(documentId)
    ? coerceText(finding?.boxId) || null
    : null;
};

export const viewerSelectionsMatch = (left, right) =>
  coerceText(left?.documentId) === coerceText(right?.documentId) &&
  coerceText(left?.boxId) === coerceText(right?.boxId) &&
  coerceText(left?.findingId) === coerceText(right?.findingId);

export const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatShortDisplayDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  return String(value);
};

export const formatTimeLabel = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return String(value);
};

export const toDateInputValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return toIsoDate(parsed);
};

export const suggestClassificationFromFilename = (filename) => {
  const name = String(filename ?? '').toLowerCase();
  if (!name) return 'Other';
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
};

export const createPartyRow = () => ({
  id: `party-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  role: ''
});

export const formatRiskLevelLabel = (value) => {
  if (!value) return 'Not assessed';
  if (value === 'not-assessed') return 'Not assessed';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const normalizeRequirementStatus = (value) => {
  const cleanValue = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (cleanValue === 'lead_linked') return 'lead';
  if (cleanValue === 'good_practice') return 'good_practice';
  if (cleanValue === 'not_applicable') return 'not_applicable';
  if (cleanValue === 'not_assessed') return 'not_assessed';
  if (cleanValue === 'compliant') return 'compliant';
  if (cleanValue === 'non_compliant') return 'non_compliant';
  return 'lead';
};

export const isRequirementMet = (status) => {
  const normalizedStatus = normalizeRequirementStatus(status);
  return normalizedStatus === 'compliant' || normalizedStatus === 'good_practice';
};

export const isRequirementExcluded = (status) => normalizeRequirementStatus(status) === 'not_applicable';

export const isRequirementPendingAssessment = (status) => normalizeRequirementStatus(status) === 'not_assessed';

export const formatReferenceText = (reference) => {
  if (!reference) return '';
  if (typeof reference === 'string') return reference;
  if (typeof reference === 'object') {
    const section = typeof reference.section === 'string' ? reference.section : '';
    const file = typeof reference.file === 'string' ? reference.file : '';
    const page = Number.isFinite(reference.page) ? `p.${reference.page}` : '';
    return [section, file, page].filter(Boolean).join(' · ');
  }
  return String(reference);
};

export const formatSourceDocumentRef = (source) => {
  if (!source || typeof source !== 'object') return '';
  const file = typeof source.file === 'string' ? source.file : '';
  const page = Array.isArray(source.page)
    ? source.page.filter(Number.isFinite)[0]
    : Number.isFinite(source.page)
      ? source.page
      : null;
  if (!file && !page) return '';
  if (file && page) return `📄 ${file} — page ${page}`;
  if (file) return `📄 ${file}`;
  return `📄 page ${page}`;
};

export const safeSourceField = (source, field, fallback = '') => {
  if (!source || typeof source !== 'object') return fallback;
  const value = source[field];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

export const safeSourcePageLabel = (source) => {
  if (!source || typeof source !== 'object') return '';
  const value = source.page;
  if (Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    const first = value.find((entry) => Number.isFinite(entry));
    return Number.isFinite(first) ? String(first) : '';
  }
  return '';
};

export const buildEvidencePassages = (finding, relatedDocLabel = 'Case document') => {
  const rawPassages = Array.isArray(finding?.evidence_passages)
    ? finding.evidence_passages
    : Array.isArray(finding?.evidencePassages)
      ? finding.evidencePassages
      : [];
  const normalizedPassages = rawPassages
    .map((passage, index) => {
      if (!passage || typeof passage !== 'object') return null;
      const docFile = safeText(
        passage.file || passage.document_name || passage.documentName || passage.document_id,
        relatedDocLabel
      );
      const pageLabel = safeText(passage.page || passage.page_number || passage.pageNumber, '');
      const sectionLabel = safeText(passage.section, '');
      const excerpt = safeText(passage.text || passage.excerpt || passage.snippet, '');
      const boxId = safeText(passage.box_id || passage.boxId, finding?.boxId || '');
      const documentId = safeText(
        passage.document_id || passage.documentId || finding?.documentId,
        finding?.documentId || ''
      );
      return {
        id: safeText(passage.id, `${finding?.id || 'finding'}-passage-${index}`),
        file: docFile,
        page: pageLabel,
        section: sectionLabel,
        excerpt,
        boxId,
        documentId
      };
    })
    .filter(Boolean);

  if (normalizedPassages.length > 0) {
    return normalizedPassages;
  }

  const file = safeSourceField(finding?.source, 'file', relatedDocLabel);
  const page = safeSourcePageLabel(finding?.source);
  const section = safeSourceField(finding?.source, 'section', '');
  const excerpt = safeText(finding?.source?.text, '');

  if (file || page || excerpt || section) {
    return [
      {
        id: `${finding?.id || 'finding'}-source`,
        file: file || relatedDocLabel,
        page,
        section,
        excerpt,
        boxId: finding?.boxId || '',
        documentId: finding?.documentId || ''
      }
    ];
  }

  return [];
};

export const extractIdleDays = (lastActivityValue) => {
  if (typeof lastActivityValue !== 'string') return 0;
  const dayMatch = lastActivityValue.match(/(\d+)\s*day/i);
  if (!dayMatch) return 0;
  const days = Number.parseInt(dayMatch[1], 10);
  return Number.isFinite(days) ? days : 0;
};
