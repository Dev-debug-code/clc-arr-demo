import { requestJson, requestRaw } from '../api/httpClient.js';
import {
  getUploadClassificationPersistenceValue,
  normalizeUploadDraft
} from '../../utils/documentUploads.js';

function toIsoDateLabel(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toTimeLabel(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toFindingSeverity(item) {
  const reviewStatus = String(item?.review_status || item?.reviewStatus || '').trim().toLowerCase();
  const rawCertainty = String(item?.certainty || '').trim().toLowerCase();
  const certainty =
    reviewStatus === 'confirmed' || ((reviewStatus === 'accepted' || reviewStatus === 'rejected') && rawCertainty === 'lead')
      ? 'finding'
      : rawCertainty;
  const polarity = String(item?.polarity || '').trim().toLowerCase();
  const isGoodPractice = item?.is_good_practice === true || item?.isGoodPractice === true;

  if (isGoodPractice) return 'best_practice';
  if (polarity === 'compliant') return 'pass';
  if (certainty === 'lead') return 'warning';
  return 'critical';
}

function toRequirementStatus(status) {
  const value = String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (value === 'met' || value === 'compliant') return 'compliant';
  if (value === 'not_met' || value === 'non_compliant') return 'non_compliant';
  if (value === 'lead_linked') return 'lead';
  if (value === 'good_practice') return 'good_practice';
  if (value === 'not_applicable') return 'not_applicable';
  if (value === 'not_assessed') return 'not_assessed';
  return 'lead';
}

function toDecision(reviewStatus) {
  const value = String(reviewStatus || '').trim().toLowerCase();
  if (value === 'accepted') return 'accepted';
  if (value === 'confirmed') return 'accepted';
  if (value === 'rejected') return 'rejected';
  if (value === 'dismissed') return 'dismissed';
  return null;
}

function normalizeObservationSource(value) {
  const cleanValue = String(value || '').trim().toLowerCase();
  if (!cleanValue) return 'other';

  const lookup = {
    'on-site visit': 'on_site_visit',
    onsite: 'on_site_visit',
    'on site': 'on_site_visit',
    interview: 'interview',
    'phone call': 'phone_call',
    phone: 'phone_call',
    email: 'email',
    'missing document': 'missing_document',
    'cross-document pattern': 'cross_document_pattern',
    'cross document pattern': 'cross_document_pattern',
    'external intelligence': 'external_intelligence',
    other: 'other'
  };

  return lookup[cleanValue] || cleanValue.replace(/[^a-z0-9]+/g, '_');
}

function normalizeEvidencePassagesForRequest(finding) {
  const rawPassages = Array.isArray(finding?.evidencePassages)
    ? finding.evidencePassages
    : Array.isArray(finding?.evidence_passages)
      ? finding.evidence_passages
      : [];

  const normalizedPassages = rawPassages
    .map((passage) => {
      if (!passage || typeof passage !== 'object') return null;

      const documentId = String(passage?.document_id || passage?.documentId || '').trim();
      const page = Number.isFinite(passage?.page)
        ? passage.page
        : Array.isArray(passage?.pages) && Number.isFinite(passage.pages[0])
          ? passage.pages[0]
          : Number.isFinite(passage?.pageNumber)
            ? passage.pageNumber
            : null;
      const bboxes = Array.isArray(passage?.bboxes) ? passage.bboxes : [];
      const textDescription = String(
        passage?.text_description || passage?.textDescription || passage?.text || passage?.excerpt || ''
      ).trim();

      if (!documentId && bboxes.length === 0 && !textDescription) return null;

      return {
        document_id: documentId || null,
        page,
        bboxes,
        text_description: textDescription || null
      };
    })
    .filter(Boolean);

  if (normalizedPassages.length > 0) {
    return normalizedPassages;
  }

  const fallbackDocumentId = String(finding?.documentId || '').trim();
  const fallbackText = String(finding?.detail || finding?.source?.text || '').trim();
  const fallbackPage = Number.isFinite(finding?.source?.page) ? finding.source.page : null;

  if (!fallbackDocumentId && !fallbackText) {
    return [];
  }

  return [
    {
      document_id: fallbackDocumentId || null,
      page: fallbackPage,
      bboxes: [],
      text_description: fallbackText || null
    }
  ];
}

function normalizeCodeAreaId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function normalizeCodeRef(value) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  return /[A-Za-z]?\d+(?:\.\d+)+/.test(clean) ? clean : null;
}

function mapDashboardCase(entry) {
  const requirementsMet = Number(entry?.summary?.requirements_met || 0);
  const requirementsTotal = Number(entry?.summary?.requirements_total || 0);
  const progress = requirementsTotal > 0 ? Math.round((requirementsMet / requirementsTotal) * 100) : 0;
  const inspectorId = entry?.inspector?.id || '';
  const inspectorName = entry?.inspector?.name || '';

  return {
    id: entry?.id || '',
    practice: entry?.practice_name || 'Unknown practice',
    started: toIsoDateLabel(entry?.started_at),
    progress,
    progressLabel: `${requirementsMet}/${requirementsTotal} requirements met`,
    unreviewed: Number(entry?.summary?.non_compliant_count || 0),
    leads: Number(entry?.summary?.leads_count || 0),
    goodPractice: Number(entry?.summary?.good_practice_count || 0),
    risk: entry?.risk_level || 'Not assessed',
    lastActivity: toIsoDateLabel(entry?.last_activity_at),
    inspector: inspectorName,
    inspectorId,
    assignedInspectorUserId: inspectorId,
    status: entry?.status || 'active',
    outcome: entry?.outcome || (entry?.status === 'completed' ? 'compliant' : 'in_progress')
  };
}

function mapHighlightsToBoxes(highlights = []) {
  const boxes = [];
  const primaryItemBox = new Map();

  highlights.forEach((highlight, highlightIndex) => {
    const itemId = String(highlight?.item_id || '').trim();
    const page = Number(highlight?.page || 1);
    const bboxes = Array.isArray(highlight?.bboxes) ? highlight.bboxes : [];
    const first = bboxes[0];
    if (!first || !itemId) return;

    const x = Number(first.x);
    const y = Number(first.y);
    const w = Number(first.w);
    const h = Number(first.h);
    if (![x, y, w, h].every(Number.isFinite)) return;

    const id = `${itemId}-${page}-${highlightIndex}`;
    boxes.push({
      id,
      bbox: [x, y, x + w, y + h],
      page,
      pageno: Math.max(page - 1, 0),
      title: itemId,
      severity: 'warning',
      details: highlight?.text_snippet || ''
    });

    if (!primaryItemBox.has(itemId)) {
      primaryItemBox.set(itemId, { boxId: id, page });
    }
  });

  return { boxes, primaryItemBox };
}

async function loadDocumentContent(caseId, documentId) {
  try {
    return await requestJson(`/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/content`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[apiProvider] Document content unavailable for ${documentId}`, error);
    return null;
  }
}

function slugifyClassification(value) {
  const text = String(value || '').trim();
  if (!text || text.toLowerCase() === 'unknown') return null;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function mapReviewAction({ decision, reason, reasonNote, previousDecision, finding }) {
  const cleanReason = String(reason || finding?.reviewReason || '').trim();
  const cleanReasonNote = String(reasonNote || finding?.reviewReasonNote || '').trim();
  const certainty = String(finding?.certainty || '').trim().toLowerCase();
  const reviewStatus = String(finding?.reviewStatus || finding?.review_status || '').trim().toLowerCase();
  const isLead = certainty === 'lead' && !['confirmed', 'accepted', 'rejected'].includes(reviewStatus);
  const changeFrom =
    previousDecision && previousDecision !== decision
      ? { change_from: previousDecision }
      : {};

  if (decision === 'accepted') {
    if (isLead) {
      return {
        action: 'confirm',
        polarity: finding?.polarity === 'compliant' ? 'compliant' : 'non_compliant',
        is_good_practice:
          finding?.polarity === 'compliant' &&
          (finding?.isGoodPractice === true || finding?.is_good_practice === true),
        evidence_passages: normalizeEvidencePassagesForRequest(finding)
      };
    }
    return { action: 'accept', ...changeFrom };
  }
  if (decision === 'rejected') {
    return {
      action: 'reject',
      reason: cleanReason || 'evidence_exists_elsewhere',
      reason_note: cleanReasonNote || null,
      ...changeFrom
    };
  }
  if (decision === 'dismissed') {
    return {
      action: 'dismiss',
      reason: cleanReason || 'not_applicable',
      reason_note: cleanReasonNote || null,
      ...changeFrom
    };
  }
  return {
    action: 'unreviewed',
    undo: true
  };
}

function isTemporaryReportActionId(value) {
  const clean = String(value || '').trim().toLowerCase();
  if (!clean) return true;
  return clean.startsWith('ra-auto-') || /^ra-\d+/.test(clean);
}

function extractFilenameFromContentDisposition(value) {
  const text = String(value || '');
  if (!text) return null;
  const utf8Match = text.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/"/g, ''));
    } catch {
      return utf8Match[1].replace(/"/g, '');
    }
  }
  const basicMatch = text.match(/filename=\"?([^\";]+)\"?/i);
  return basicMatch?.[1] || null;
}

const FOCUS_AREA_SLUG_MAP = {
  aml: 'aml_ctf',
  accounts: 'accounts',
  lenders: 'acting_for_lenders',
  insurance: 'ancillary_insurance_intermediaries',
  business: 'business_arrangements',
  'client-care': 'client_care',
  complaints: 'complaints',
  conflicts: 'conflicts_of_interest',
  cpd: 'cpd_ongoing_competence',
  'non-authorised': 'dealing_with_non_authorised_persons',
  disclosure: 'disclosure_of_profits_and_advantage',
  equality: 'equality_code',
  abs: 'licensed_body_abs_code',
  management: 'management_supervision',
  notification: 'notification_code',
  pii: 'professional_indemnity_insurance',
  recognised: 'recognised_body_code',
  transaction: 'transaction_files',
  undertakings: 'undertakings'
};

function mapFocusAreaSlug(value) {
  const cleanValue = String(value || '').trim();
  if (!cleanValue) return '';
  return FOCUS_AREA_SLUG_MAP[cleanValue] || cleanValue;
}

function mapSearchResultRow(row, index) {
  const id = String(row?.id || row?.item_id || row?.finding_id || `search-${index}`).trim();
  const documentId = String(row?.document_id || row?.doc_id || '').trim();
  const boxId = String(row?.box_id || row?.highlight_id || row?.item_id || '').trim() || null;
  const page = Array.isArray(row?.pages) ? row.pages[0] : row?.page;
  const section = row?.section || row?.code_ref || row?.requirement || '';
  const detail = row?.text || row?.text_snippet || row?.snippet || row?.summary || '';
  const title = row?.title || row?.finding_title || row?.item_title || section || 'Search result';
  const codeArea = normalizeCodeAreaId(row?.code_area || row?.codeArea || row?.code_area_slug || '');
  const certainty = String(row?.certainty || '').trim().toLowerCase() || 'finding';
  const polarity = row?.polarity === 'compliant' ? 'compliant' : 'non_compliant';
  const isGoodPractice =
    row?.is_good_practice === true ||
    row?.isGoodPractice === true ||
    (polarity === 'compliant' && row?.badge === 'good_practice');
  const reviewStatus = String(row?.review_status || row?.reviewStatus || '').trim().toLowerCase() || 'unreviewed';

  return {
    id,
    severity: toFindingSeverity({
      certainty,
      polarity,
      is_good_practice: isGoodPractice,
      review_status: reviewStatus
    }),
    title,
    detail,
    documentId,
    boxId,
    codeArea,
    certainty,
    polarity,
    isGoodPractice,
    reviewStatus,
    evidencePassages: [
      {
        id: `${id}-p0`,
        document_id: documentId,
        document_name: row?.document_name || row?.filename || '',
        file: row?.document_name || row?.filename || '',
        page,
        section,
        text: detail,
        box_id: boxId
      }
    ],
    source: {
      file: row?.document_name || row?.filename || '',
      page,
      section,
      text: detail
    },
    evidenceStrength: row?.evidence_strength || null,
    reference: section
  };
}

export async function listCases() {
  const payload = await requestJson('/cases');
  const rows = Array.isArray(payload?.cases) ? payload.cases : [];
  return rows.map(mapDashboardCase);
}

export function prepareUploadDraft(uploadItem) {
  return normalizeUploadDraft(uploadItem);
}

export function prepareWorkspaceSnapshot({ documents = [], findings = [] }) {
  return {
    documents,
    findings
  };
}

export async function lookupPracticeByLicenceNumber(licenceNumber) {
  const cleanLicenceNumber = String(licenceNumber || '').trim();
  if (!cleanLicenceNumber) {
    return { match: false };
  }

  const query = encodeURIComponent(cleanLicenceNumber);
  const tryLookup = async (queryKey) => {
    const payload = await requestJson(`/practices/lookup?${queryKey}=${query}`);
    const practice = payload?.practice || payload?.data?.practice || null;
    const hasMatch = payload?.match ?? Boolean(practice);
    return hasMatch && practice ? { match: true, practice } : { match: false };
  };

  try {
    return await tryLookup('licence_number');
  } catch (error) {
    if (error?.status === 404) return { match: false };
    if (error?.status !== 400) throw error;
  }

  // Fallback for alternate spelling that some backends use.
  return tryLookup('license_number');
}

export async function searchCase({ caseId, query, scope = 'all', documentId }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanQuery = String(query || '').trim();
  if (!cleanCaseId || !cleanQuery) {
    return { supported: true, results: [] };
  }

  const payloadBody = {
    query: cleanQuery
  };
  if (scope === 'document' && documentId) {
    payloadBody.document_id = documentId;
  }

  try {
    const payload = await requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/search`, {
      method: 'POST',
      body: payloadBody
    });

    const rows = Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.matches)
        ? payload.matches
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.findings)
            ? payload.findings
            : [];

    return {
      supported: true,
      results: rows.map(mapSearchResultRow)
    };
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return { supported: false, results: [] };
    }
    throw error;
  }
}

export async function loadCaseWorkspaceData(caseId) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId) return null;

  const payload = await requestJson(`/cases/${encodeURIComponent(cleanCaseId)}`);

  const documentsRaw = Array.isArray(payload?.documents) ? payload.documents : [];
  const documentContent = new Map();
  const primaryItemBox = new Map();

  await Promise.all(
    documentsRaw.map(async (documentRow) => {
      const documentId = String(documentRow?.id || '').trim();
      if (!documentId) return;
      const content = await loadDocumentContent(cleanCaseId, documentId);
      if (!content) return;

      const mapped = mapHighlightsToBoxes(Array.isArray(content?.highlights) ? content.highlights : []);
      mapped.primaryItemBox.forEach((value, key) => {
        if (!primaryItemBox.has(key)) {
          primaryItemBox.set(key, { ...value, documentId });
        }
      });
      documentContent.set(documentId, {
        contentUrl: content?.content_url || null,
        boxes: mapped.boxes
      });
    })
  );

  const documents = documentsRaw.map((entry) => {
    const documentId = String(entry?.id || '').trim();
    const overlay = documentContent.get(documentId);
    const confirmed = Boolean(entry?.confirmed);
    const status = confirmed ? 'verified' : entry?.processing_status || 'queued';
    return {
      id: documentId,
      label: entry?.classification || entry?.document_type || entry?.filename || documentId,
      filename: entry?.filename || entry?.document_name || documentId,
      classification: entry?.classification || 'Unknown',
      parties: entry?.parties || 'Firm',
      confidence: entry?.confidence || 'medium',
      status,
      summary: entry?.summary || '',
      uploadedOn: toIsoDateLabel(entry?.uploaded_at),
      severity: 'warning',
      classificationL1: entry?.classification_l1 || entry?.classificationL1 || '',
      classificationL2: entry?.classification_l2 || entry?.classificationL2 || '',
      classificationDetail: entry?.classification_detail || entry?.classificationDetail || '',
      limitedAnalysis: entry?.limited_analysis || entry?.limitedAnalysis || false,
      interviewees: Array.isArray(entry?.interviewees) ? entry.interviewees : [],
      pdf: overlay?.contentUrl || entry?.content_url || entry?.url,
      findings: [],
      overlay: {
        boxes: overlay?.boxes || []
      }
    };
  });

  const findings = [];
  const findingDecisions = {};
  const findingNotes = {};
  const requirementsByCodeArea = {};

  const codeAreas = Array.isArray(payload?.code_areas) ? payload.code_areas : [];
  codeAreas.forEach((area) => {
    const areaId = normalizeCodeAreaId(area?.slug || area?.code || area?.name);
    if (!areaId) return;

    const requirements = Array.isArray(area?.requirements) ? area.requirements : [];
    requirementsByCodeArea[areaId] = [];

    requirements.forEach((requirement) => {
      requirementsByCodeArea[areaId].push({
        id: requirement?.id || requirement?.code_ref || `${areaId}-${requirementsByCodeArea[areaId].length + 1}`,
        label: requirement?.title || requirement?.code_ref || 'Requirement',
        status: toRequirementStatus(requirement?.status)
      });

      const items = Array.isArray(requirement?.items) ? requirement.items : [];
      items.forEach((item) => {
        const itemId = String(item?.id || '').trim();
        if (!itemId) return;

        const evidencePassages = Array.isArray(item?.evidence_passages) ? item.evidence_passages : [];
        const firstPassage = evidencePassages[0] || {};
        const linkedDocumentId =
          String(firstPassage?.document_id || primaryItemBox.get(itemId)?.documentId || '').trim();
        const linkedBoxId = primaryItemBox.get(itemId)?.boxId || itemId;

        const normalizedPassages = evidencePassages.flatMap((passage, index) => {
          const pages = Array.isArray(passage?.pages)
            ? passage.pages
            : Number.isFinite(passage?.page)
              ? [passage.page]
              : [null];

          return pages.map((page, pageIndex) => ({
            id: `${itemId}-p${index}-${pageIndex}`,
            document_id: passage?.document_id || linkedDocumentId,
            document_name: passage?.document_name || '',
            file: passage?.document_name || '',
            page,
            section: item?.code_ref || requirement?.code_ref || '',
            text: passage?.text_snippet || item?.summary || '',
            box_id: linkedBoxId
          }));
        });

        findings.push({
          id: itemId,
          severity: toFindingSeverity(item),
          title: item?.title || requirement?.title || 'Finding',
          detail: item?.summary || item?.description || '',
          documentId: linkedDocumentId,
          boxId: linkedBoxId,
          codeArea: areaId,
          certainty: item?.certainty || 'finding',
          polarity: item?.polarity || 'non_compliant',
          isGoodPractice: item?.is_good_practice === true,
          requirementSeverity: String(requirement?.severity || '').trim().toLowerCase() || 'critical',
          reviewStatus: item?.review_status || 'unreviewed',
          reviewReason: item?.review_reason || item?.reason || null,
          reviewReasonNote: item?.review_reason_note || item?.reason_note || null,
          evidenceStrength: item?.evidence_strength || null,
          observationSource: item?.observation_source || null,
          evidencePassages: normalizedPassages,
          source: {
            file: firstPassage?.document_name || '',
            page: Array.isArray(firstPassage?.pages) ? firstPassage.pages[0] : firstPassage?.page,
            section: requirement?.code_ref || '',
            text: firstPassage?.text_snippet || item?.summary || ''
          },
          reference: item?.code_ref || requirement?.code_ref || '',
          origin: item?.source || null,
          isInspectorAdded: item?.source === 'inspector'
        });

        const decision = toDecision(item?.review_status);
        if (decision) {
          findingDecisions[itemId] = decision;
        }

        const notes = Array.isArray(item?.notes) ? item.notes : [];
        if (notes.length > 0) {
          const latest = notes[notes.length - 1];
          findingNotes[itemId] = {
            text: latest?.text || '',
            ts: toTimeLabel(latest?.created_at),
            actor: latest?.author?.name || 'Inspector'
          };
        }
      });
    });
  });

  const documentNotes = {};
  documentsRaw.forEach((doc) => {
    const notes = Array.isArray(doc?.notes) ? doc.notes : [];
    if (!notes.length || !doc?.id) return;
    documentNotes[doc.id] = notes.map((note, index) => ({
      id: note?.id || `${doc.id}-note-${index}`,
      text: note?.text || '',
      ts: toTimeLabel(note?.created_at),
      actor: note?.author?.name || 'Inspector'
    }));
  });

  const caseContextNotes = (Array.isArray(payload?.context_notes) ? payload.context_notes : []).map((note, index) => ({
    id: note?.id || `ctx-${index}`,
    text: note?.text || '',
    ts: toTimeLabel(note?.created_at),
    actor: note?.author?.name || 'Inspector'
  }));

  const historyItems = (Array.isArray(payload?.history) ? payload.history : []).map((row, index) => ({
    id: row?.id || `h-${index}`,
    ts: toTimeLabel(row?.created_at),
    detail: row?.detail || row?.event || 'Activity logged',
    actor: row?.actor?.name || row?.actor || 'System'
  }));

  const inspectorObservations = (Array.isArray(payload?.observations) ? payload.observations : []).map(
    (row, index) => ({
      id: row?.id || `obs-${index}`,
      text: row?.text || '',
      requirement: row?.requirement || 'General observation',
      sourceType: row?.source_type || row?.sourceType || 'Other',
      ts: toTimeLabel(row?.created_at),
      actor: row?.author?.name || row?.actor?.name || 'Inspector'
    })
  );

  const reportSectionIdsByCodeArea = {};
  const reportSectionNarrativesByCodeArea = {};
  const reportSections = Array.isArray(payload?.report?.sections) ? payload.report.sections : [];
  reportSections.forEach((section) => {
    const codeAreaId = normalizeCodeAreaId(section?.code_area || section?.codeArea || '');
    const sectionId = String(section?.id || '').trim();
    if (!codeAreaId) return;
    if (sectionId) {
      reportSectionIdsByCodeArea[codeAreaId] = sectionId;
    }
    const lines = Array.isArray(section?.lines)
      ? section.lines.map((line) => String(line || '').trim()).filter(Boolean)
      : String(section?.narrative || section?.content || '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
    if (lines.length > 0) {
      reportSectionNarrativesByCodeArea[codeAreaId] = lines;
    }
  });

  // Keep report editing deterministic even when backend omits report.sections.
  Object.keys(requirementsByCodeArea).forEach((codeAreaId) => {
    if (!reportSectionIdsByCodeArea[codeAreaId]) {
      reportSectionIdsByCodeArea[codeAreaId] = `section_${codeAreaId}`;
    }
  });
  findings.forEach((finding) => {
    const codeAreaId = normalizeCodeAreaId(finding?.codeArea || finding?.code_area || '');
    if (!codeAreaId) return;
    if (!reportSectionIdsByCodeArea[codeAreaId]) {
      reportSectionIdsByCodeArea[codeAreaId] = `section_${codeAreaId}`;
    }
  });

  const reportExecutiveSummary =
    typeof payload?.report?.executive_summary === 'string'
      ? payload.report.executive_summary
      : typeof payload?.report?.executiveSummary === 'string'
        ? payload.report.executiveSummary
        : '';

  const reportActionItems = (
    Array.isArray(payload?.action_plan)
      ? payload.action_plan
      : Array.isArray(payload?.report_actions)
        ? payload.report_actions
      : Array.isArray(payload?.report?.actions)
        ? payload.report.actions
        : []
  ).map((row, index) => ({
    id: row?.id || `ra-${index}`,
    action: row?.action || 'Action item',
    codeRef: row?.code_ref || null,
    codeArea: row?.code_ref || row?.code_area || row?.codeArea || 'General',
    deadline: row?.deadline || 'TBD',
    person: row?.responsible_person || row?.person || row?.owner || ''
  }));

  const uploadItems = documents.map((documentRow) =>
    normalizeUploadDraft({
      id: documentRow.id,
      name: documentRow.filename,
      filename: documentRow.filename,
      status: documentRow.status,
      classification: documentRow.classification,
      classificationL1: documentRow.classification_l1 || documentRow.classificationL1 || '',
      classificationL2: documentRow.classification_l2 || documentRow.classificationL2 || '',
      classificationDetail:
        documentRow.classification_detail || documentRow.classificationDetail || '',
      limitedAnalysis: documentRow.limited_analysis || documentRow.limitedAnalysis || false,
      parties: documentRow.parties,
      interviewees: Array.isArray(documentRow.interviewees) ? documentRow.interviewees : [],
      intervieweeName: documentRow.interviewee_name || documentRow.intervieweeName || '',
      intervieweeRole: documentRow.interview_role || documentRow.interviewRole || '',
      interviewDate: documentRow.interview_date || documentRow.interviewDate || '',
      confidence: documentRow.confidence,
      summary: documentRow.summary
    })
  );

  return {
    caseExists: Boolean(payload?.id),
    caseMetaPatch: {
      practiceName: payload?.practice?.name,
      caseId: payload?.id || cleanCaseId,
      owner: payload?.inspector?.name,
      started: toIsoDateLabel(payload?.created_at),
      riskLevel: payload?.risk_level,
      previousInspection: payload?.previous_inspection_date,
      holp: payload?.practice?.holp,
      hofa: payload?.practice?.hofa
    },
    documents,
    findings,
    findingDecisions,
    findingNotes,
    documentNotes,
    uploadItems,
    requirementsByCodeArea,
    caseContextNotes,
    historyItems,
    inspectorObservations,
    reportSectionIdsByCodeArea,
    reportSectionNarrativesByCodeArea,
    reportExecutiveSummary,
    reportActionItems
  };
}

export async function createCaseRecord({
  caseId,
  practiceName,
  owner,
  riskLevel,
  transactionType,
  actingForLender,
  amlTier,
  previousInspection,
  holp,
  hofa,
  focusAreas,
  preInspectionConcerns,
  knownParties,
  questionnaireFileName,
  questionnaireFile
}) {
  const mappedFocusAreas = Array.isArray(focusAreas)
    ? Array.from(
        new Set(
          focusAreas
            .map((value) => mapFocusAreaSlug(value))
            .filter(Boolean)
        )
      )
    : [];
  const mappedKnownParties = Array.isArray(knownParties)
    ? knownParties
        .map((party) => ({
          name: String(party?.name || '').trim(),
          role: String(party?.role || '').trim()
        }))
        .filter((party) => party.name)
    : [];

  const fieldsPayload = {
    practice_name: practiceName,
    licence_number: caseId,
    holp,
    hofa,
    risk_level: String(riskLevel || 'not_assessed')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_'),
    previous_inspection_date: previousInspection && previousInspection !== 'N/A' ? previousInspection : null,
    transaction_type: String(transactionType || '').trim() || null,
    acting_for_lender: typeof actingForLender === 'boolean' ? actingForLender : null,
    aml_tier: String(amlTier || '').trim() || null,
    linked_practice_id: null,
    focus_areas: mappedFocusAreas,
    pre_inspection_concerns: String(preInspectionConcerns || '').trim(),
    known_parties: mappedKnownParties,
    owner
  };

  const form = new FormData();
  form.append('fields', JSON.stringify(fieldsPayload));
  if (typeof File !== 'undefined' && questionnaireFile instanceof File) {
    form.append('file', questionnaireFile, questionnaireFileName || questionnaireFile.name || 'questionnaire.pdf');
  }

  return requestJson('/cases', {
    method: 'POST',
    body: form
  });
}

export async function persistInspectorFinding({ caseId, finding }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId || !finding || typeof finding !== 'object') return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/items`, {
    method: 'POST',
    body: {
      source: 'inspector',
      code_area: mapFocusAreaSlug(finding.codeArea || 'aml'),
      requirement_id: String(finding.requirementId || '').trim() || null,
      polarity: finding?.polarity === 'compliant' ? 'compliant' : 'non_compliant',
      is_good_practice:
        finding?.polarity === 'compliant' &&
        (finding?.isGoodPractice === true || finding?.is_good_practice === true),
      title: finding.title || 'Inspector finding',
      summary: finding.detail || '',
      observation_source: normalizeObservationSource(
        finding?.observationSource || finding?.sourceType || finding?.observation_source
      ),
      evidence_passages: normalizeEvidencePassagesForRequest(finding),
      review_status: finding.reviewStatus || 'unreviewed'
    }
  });
}

export async function persistInspectorFindingDelete({ caseId, findingId }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanFindingId = String(findingId || '').trim();
  if (!cleanCaseId || !cleanFindingId) return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/items/${encodeURIComponent(cleanFindingId)}`, {
    method: 'DELETE'
  });
}

export async function persistFindingDecision({
  caseId,
  findingId,
  decision,
  reason,
  reasonNote,
  previousDecision,
  finding
}) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId || !findingId) return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/items/${encodeURIComponent(findingId)}/review`, {
    method: 'PATCH',
    body: mapReviewAction({
      decision,
      reason,
      reasonNote,
      previousDecision,
      finding
    })
  });
}

export async function persistFindingNote({ caseId, findingId, text }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId || !findingId) return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/items/${encodeURIComponent(findingId)}/notes`, {
    method: 'POST',
    body: { text }
  });
}

export async function persistDocumentNote({ caseId, documentId, text }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId || !documentId) return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/documents/${encodeURIComponent(documentId)}/notes`, {
    method: 'POST',
    body: { text }
  });
}

export async function persistContextNote({ caseId, text }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId) return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}`, {
    method: 'PATCH',
    body: {
      context_notes: [{ text }]
    }
  });
}

export async function persistCasePatch({ caseId, patch }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId || !patch || typeof patch !== 'object') return null;

  try {
    return await requestJson(`/cases/${encodeURIComponent(cleanCaseId)}`, {
      method: 'PATCH',
      body: patch
    });
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return { supported: false };
    }
    throw error;
  }
}

export async function persistObservation({ caseId, observation }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanedText = String(observation?.text || '').trim();
  if (!cleanCaseId || !cleanedText) return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/observations`, {
    method: 'POST',
    body: {
      text: cleanedText,
      requirement: observation?.requirement || 'General observation',
      source_type: observation?.sourceType || 'Other'
    }
  });
}

export async function persistObservationUpdate({ caseId, observationId, observation }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanObservationId = String(observationId || '').trim();
  const cleanedText = String(observation?.text || '').trim();
  if (!cleanCaseId || !cleanObservationId || !cleanedText) return null;

  try {
    return await requestJson(
      `/cases/${encodeURIComponent(cleanCaseId)}/observations/${encodeURIComponent(cleanObservationId)}`,
      {
        method: 'PATCH',
        body: {
          text: cleanedText
        }
      }
    );
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return { supported: false };
    }
    throw error;
  }
}

export async function persistObservationDelete({ caseId, observationId }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanObservationId = String(observationId || '').trim();
  if (!cleanCaseId || !cleanObservationId) return null;

  try {
    return await requestJson(
      `/cases/${encodeURIComponent(cleanCaseId)}/observations/${encodeURIComponent(cleanObservationId)}`,
      {
        method: 'DELETE'
      }
    );
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return { supported: false };
    }
    throw error;
  }
}

export async function persistReportPatch({ caseId, report }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId || !report || typeof report !== 'object') return null;

  const payload = {};
  if (typeof report.executive_summary === 'string') {
    payload.executive_summary = report.executive_summary;
  }
  if (typeof report.overall_rating === 'string') {
    payload.overall_rating = report.overall_rating;
  }
  if (!payload.executive_summary && !payload.overall_rating) {
    return null;
  }

  try {
    return await requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/report`, {
      method: 'PATCH',
      body: payload
    });
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return { supported: false };
    }
    throw error;
  }
}

export async function persistReportSectionPatch({ caseId, sectionId, lines, codeAreaId }) {
  void codeAreaId;
  const cleanCaseId = String(caseId || '').trim();
  const cleanSectionId = String(sectionId || '').trim();
  if (!cleanCaseId || !cleanSectionId) return null;

  const cleanLines = Array.isArray(lines)
    ? lines
        .map((line) => String(line || '').trim())
        .filter(Boolean)
    : [];
  const narrative = cleanLines.join('\n').trim();
  if (!narrative) return null;

  try {
    return await requestJson(
      `/cases/${encodeURIComponent(cleanCaseId)}/report/sections/${encodeURIComponent(cleanSectionId)}`,
      {
        method: 'PATCH',
        body: {
          narrative
        }
      }
    );
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return { supported: false };
    }
    throw error;
  }
}

export async function persistReportSectionRevert({ caseId, sectionId, lines, codeAreaId }) {
  void lines;
  void codeAreaId;
  const cleanCaseId = String(caseId || '').trim();
  const cleanSectionId = String(sectionId || '').trim();
  if (!cleanCaseId || !cleanSectionId) return null;

  try {
    return await requestJson(
      `/cases/${encodeURIComponent(cleanCaseId)}/report/sections/${encodeURIComponent(cleanSectionId)}/revert`,
      {
        method: 'PATCH'
      }
    );
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return { supported: false };
    }
    throw error;
  }
}

export async function persistFeedback({ caseId, category, text, metadata }) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return null;

  const rawCategory = String(category || 'suggestion').trim().toLowerCase();
  const safeCategory = ['bug', 'suggestion', 'question', 'other'].includes(rawCategory)
    ? rawCategory
    : 'other';

  try {
    return await requestJson('/feedback', {
      method: 'POST',
      body: {
        case_id: String(caseId || '').trim() || null,
        category: safeCategory,
        text: cleanText
      }
    });
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return { supported: false };
    }
    throw error;
  }
}

export async function persistReportAction({ caseId, actionItem }) {
  const cleanCaseIdValue = String(caseId || '').trim();
  if (!cleanCaseIdValue) return null;
  const cleanCaseId = encodeURIComponent(cleanCaseIdValue);
  const cleanActionId = String(actionItem?.id || '').trim();
  const body = {
    item_id: actionItem?.itemId || null,
    code_ref: normalizeCodeRef(actionItem?.codeRef || actionItem?.codeArea || actionItem?.code_ref),
    action: actionItem?.action || 'Action item',
    deadline: actionItem?.deadline || null,
    responsible_person: actionItem?.responsiblePerson || actionItem?.person || null,
    source: 'inspector'
  };

  if (!cleanActionId || isTemporaryReportActionId(cleanActionId)) {
    return requestJson(`/cases/${cleanCaseId}/report/actions`, {
      method: 'POST',
      body
    });
  }

  try {
    return await requestJson(`/cases/${cleanCaseId}/report/actions/${encodeURIComponent(cleanActionId)}`, {
      method: 'PATCH',
      body
    });
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  return requestJson(`/cases/${cleanCaseId}/report/actions`, {
    method: 'POST',
    body
  });
}

export async function persistReportActionDelete({ caseId, actionId }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanActionId = String(actionId || '').trim();
  if (!cleanCaseId || !cleanActionId || isTemporaryReportActionId(cleanActionId)) return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/report/actions/${encodeURIComponent(cleanActionId)}`, {
    method: 'DELETE'
  });
}

export async function persistUploadItem({ caseId, uploadItem }) {
  const cleanCaseIdValue = String(caseId || '').trim();
  if (!cleanCaseIdValue) return null;
  const cleanCaseId = encodeURIComponent(cleanCaseIdValue);
  const normalizedUploadItem = normalizeUploadDraft(uploadItem);

  if (normalizedUploadItem?.file && (normalizedUploadItem?.id || '').startsWith('up')) {
    const form = new FormData();
    form.append(
      'file',
      normalizedUploadItem.file,
      normalizedUploadItem.filename || normalizedUploadItem.name || 'document.pdf'
    );
    if (normalizedUploadItem?.filename) {
      form.append('filename', normalizedUploadItem.filename);
    }

    return requestJson(`/cases/${cleanCaseId}/documents`, {
      method: 'POST',
      body: form
    });
  }

  if (!normalizedUploadItem?.id) return null;

  const body = {
    classification: slugifyClassification(
      getUploadClassificationPersistenceValue(normalizedUploadItem)
    ),
    parties: String(normalizedUploadItem.parties || '').trim().toLowerCase() || null,
    confirmed: normalizedUploadItem.status === 'verified'
  };

  const persistedClassification = body.classification || '';
  if (persistedClassification === 'interview_transcript') {
    body.interviewees = Array.isArray(normalizedUploadItem.interviewees)
      ? normalizedUploadItem.interviewees
          .map((row) => ({
            name: String(row?.name || '').trim(),
            role: String(row?.role || '').trim(),
            date: String(row?.date || '').trim() || null,
            context_note: String(row?.context_note || row?.contextNote || '').trim() || null
          }))
          .filter((row) => row.name || row.role || row.date || row.context_note)
      : [];
  }

  return requestJson(`/cases/${cleanCaseId}/documents/${encodeURIComponent(normalizedUploadItem.id)}`, {
    method: 'PATCH',
    body
  });
}

export async function persistConfirmAllUploads({ caseId }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId) return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/documents/confirm-all`, {
    method: 'POST'
  });
}

export async function persistGenerateFindingsEvent({ caseId }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId) return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/process`, {
    method: 'POST'
  });
}

export async function persistGenerateReport({ caseId }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId) return null;

  return requestJson(`/cases/${encodeURIComponent(cleanCaseId)}/report/generate`, {
    method: 'POST'
  });
}

export async function exportCaseReport({ caseId, format = 'pdf' }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId) {
    return { supported: false };
  }

  try {
    const response = await requestRaw(
      `/cases/${encodeURIComponent(cleanCaseId)}/report/export?format=${encodeURIComponent(format)}`
    );
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const contentDisposition = response.headers.get('content-disposition');
    const filename = extractFilenameFromContentDisposition(contentDisposition) || `report-${cleanCaseId}.${format}`;

    if (contentType.includes('application/json')) {
      const payload = await response.json();
      const url = payload?.url || payload?.download_url || payload?.file_url || null;
      if (url) {
        return {
          supported: true,
          downloadUrl: url,
          filename,
          revokeOnUse: false
        };
      }
      return { supported: false };
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    return {
      supported: true,
      downloadUrl: objectUrl,
      filename,
      revokeOnUse: true
    };
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return { supported: false };
    }
    throw error;
  }
}
