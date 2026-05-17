import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where
} from 'firebase/firestore';
import { getFirebaseApp } from '../config/firebase.js';
import { FIRESTORE_DATABASE_ID, ORGANIZATION_ID } from '../config/runtime.js';
import { canAccessTeamCases, normalizeUserRole } from '../utils/accessControl.js';
import { getDemoRequirementDefinition } from '../data/demoRequirementCatalog.js';
import {
  toPersistedDocumentShape,
  toPersistedFindingShape
} from './generatedWorkspacePersistence.js';
import {
  getUploadClassificationPersistenceValue,
  getUploadProcessingStatusPersistenceValue,
  normalizeUploadDraft
} from '../utils/documentUploads.js';
import { createInspectionReportPdf } from '../utils/reportPdf.js';
import {
  buildSimulatedClassifiedUploads,
  buildSimulatedFindingsWorkspace
} from './simulatedAnalysis.js';

const database = getFirestore(getFirebaseApp(), FIRESTORE_DATABASE_ID);

function coerceText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function getUserDisplayLabel(user, fallback = 'Inspector') {
  const displayName = coerceText(user?.displayName);
  if (displayName) return displayName;
  const email = coerceText(user?.email);
  return email || fallback;
}

function buildDistinctDocList(snapshots) {
  const docsById = new Map();

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      if (!docsById.has(docSnap.id)) {
        docsById.set(docSnap.id, docSnap);
      }
    });
  });

  return Array.from(docsById.values());
}

function formatTime(value) {
  if (!value) return '';
  if (typeof value.toDate === 'function') {
    return value.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (value instanceof Date) {
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return '';
}

function formatDateLabel(value) {
  if (!value) return '';
  const source = typeof value.toDate === 'function' ? value.toDate() : value;
  if (!(source instanceof Date) || Number.isNaN(source.getTime())) return '';
  return source.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function statusToDecision(reviewStatus) {
  const normalized = String(reviewStatus || '').trim().toLowerCase();
  if (normalized === 'accepted') return 'accepted';
  if (normalized === 'confirmed') return 'accepted';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'dismissed') return 'dismissed';
  return null;
}

function deriveLegacyFindingSeverity({ severity, certainty, polarity, isGoodPractice, reviewStatus }) {
  const normalizedReviewStatus = String(reviewStatus || '').trim().toLowerCase();
  const rawCertainty = String(certainty || '').trim().toLowerCase();
  const normalizedCertainty =
    normalizedReviewStatus === 'confirmed' ||
    ((normalizedReviewStatus === 'accepted' || normalizedReviewStatus === 'rejected') && rawCertainty === 'lead')
      ? 'finding'
      : rawCertainty;
  const normalizedPolarity = String(polarity || '').trim().toLowerCase();

  if (isGoodPractice === true) return 'best_practice';
  if (normalizedPolarity === 'compliant') return 'pass';
  if (normalizedCertainty === 'lead') return 'warning';

  const fallbackSeverity = String(severity || '').trim().toLowerCase();
  if (fallbackSeverity === 'best_practice' || fallbackSeverity === 'pass') return fallbackSeverity;
  if (fallbackSeverity === 'warning') return 'critical';
  return fallbackSeverity || 'critical';
}

function decisionToStatus(decision, finding) {
  if (decision === 'accepted') {
    const certainty = String(finding?.certainty || '').trim().toLowerCase();
    const reviewStatus = String(finding?.reviewStatus || '').trim().toLowerCase();
    return certainty === 'lead' && !['confirmed', 'accepted', 'rejected'].includes(reviewStatus)
      ? 'confirmed'
      : 'accepted';
  }
  if (decision === 'rejected') return 'rejected';
  if (decision === 'dismissed') return 'dismissed';
  return 'unreviewed';
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

function mapDocument(docSnap) {
  const data = docSnap.data() ?? {};
  const processingStatus = String(data.processing_status ?? data.processingStatus ?? '').trim().toLowerCase();
  const confirmed = data.confirmed === true;
  const classificationConfidence = data.classification_confidence ?? data.classificationConfidence ?? data.confidence ?? null;
  const rawClassification = String(data.classification ?? '').trim();
  const documentType = String(data.documentType ?? data.document_type ?? '').trim();
  const resolvedClassification =
    rawClassification && rawClassification.toLowerCase() !== 'other'
      ? rawClassification
      : documentType || rawClassification || 'Unknown';
  return {
    id: docSnap.id,
    label: data.label ?? resolvedClassification ?? data.name ?? docSnap.id,
    filename: data.filename ?? data.name ?? docSnap.id,
    classification: resolvedClassification,
    parties: data.parties ?? 'Firm',
    confidence: classificationConfidence ?? 'medium',
    classificationConfidence,
    processingStatus,
    status: confirmed ? 'verified' : processingStatus || data.status || 'verified',
    summary: data.summary ?? '',
    extractedFields: data.extracted_fields ?? data.extractedFields ?? null,
    partiesFound: data.parties_found ?? data.partiesFound ?? null,
    uploadedOn: formatDateLabel(data.createdAt),
    severity: data.severity ?? 'pass',
    pdf: data.pdf ?? (data.filename ? `assets/case-files/${data.filename}` : undefined),
    findings: Array.isArray(data.findings) ? data.findings : [],
    overlay: {
      boxes: Array.isArray(data.overlayBoxes) ? data.overlayBoxes : []
    }
  };
}

function mapFinding(docSnap) {
  const data = docSnap.data() ?? {};
  const origin = typeof data.origin === 'string' ? data.origin : typeof data.source === 'string' ? data.source : '';
  const reviewStatus = data.reviewStatus ?? data.review_status ?? 'unreviewed';
  const requirementId = coerceText(data.requirementId ?? data.requirement_id);
  const requirementDefinition = getDemoRequirementDefinition(requirementId);
  const certainty =
    data.certainty ??
    (String(data.severity || '').trim().toLowerCase() === 'warning' && reviewStatus !== 'confirmed' ? 'lead' : 'finding');
  const polarity =
    data.polarity ??
    (['pass', 'best_practice'].includes(String(data.severity || '').trim().toLowerCase())
      ? 'compliant'
      : 'non_compliant');
  const isGoodPractice =
    data.isGoodPractice === true ||
    data.is_good_practice === true ||
    String(data.severity || '').trim().toLowerCase() === 'best_practice';
  const rawCodeArea = String(requirementDefinition?.codeArea ?? data.codeArea ?? data.code_area ?? '').trim();
  const normalizedCodeArea = normalizeCodeAreaId(rawCodeArea) || rawCodeArea || 'aml';
  return {
    id: docSnap.id,
    severity: deriveLegacyFindingSeverity({
      severity: data.severity,
      certainty,
      polarity,
      isGoodPractice,
      reviewStatus
    }),
    title: data.title ?? 'Finding',
    detail: data.detail ?? '',
    documentId: data.documentId ?? '',
    requirementId,
    boxId: data.boxId ?? docSnap.id,
    codeArea: normalizedCodeArea,
    codeAreaLabel:
      coerceText(requirementDefinition?.codeAreaLabel) ||
      coerceText(data.codeAreaLabel ?? data.code_area_label) ||
      deriveCodeAreaLabel(normalizedCodeArea),
    certainty,
    polarity,
    isGoodPractice,
    requirementSeverity: data.requirementSeverity ?? data.requirement_severity ?? 'critical',
    reviewStatus,
    reviewReason: data.reviewReason ?? data.review_reason ?? null,
    reviewReasonNote: data.reviewReasonNote ?? data.review_reason_note ?? null,
    evidenceStrength: data.evidenceStrength ?? data.evidence_strength ?? null,
    observationSource: data.observationSource ?? data.observation_source ?? null,
    evidencePassages: Array.isArray(data.evidencePassages)
      ? data.evidencePassages
      : Array.isArray(data.evidence_passages)
        ? data.evidence_passages
        : [],
    source: typeof data.source === 'object' ? data.source : null,
    reference: data.reference ?? data.codeReference ?? '',
    origin,
    isInspectorAdded: data.isInspectorAdded === true || origin === 'inspector'
  };
}

function mapHistory(docSnap) {
  const data = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    ts: data.timestampLabel ?? formatTime(data.createdAt) ?? '',
    detail: data.detail ?? 'Activity logged',
    actor: data.actor ?? data.actorName ?? 'System'
  };
}

function normalizeCodeAreaId(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!raw) return '';

  const normalized = raw.replace(/[^a-z0-9]+/g, ' ').trim();
  if (raw === 'aml' || normalized.includes('money laundering') || normalized.includes('ctf')) {
    return 'aml';
  }
  if (normalized.includes('lender') || normalized.includes('mortgage fraud')) return 'lenders';
  if (
    normalized.includes('code of conduct') ||
    normalized.includes('complaint') ||
    normalized.includes('client care') ||
    normalized.includes('engagement')
  ) {
    return 'code-of-conduct';
  }
  if (normalized.includes('account') || normalized.includes('reconciliation')) return 'accounts';
  if (normalized.includes('management') || normalized.includes('supervision')) return 'management';
  if (normalized.includes('undertaking')) return 'undertakings';
  return normalized.replace(/\s+/g, '-');
}

function deriveCodeAreaLabel(codeAreaId) {
  if (codeAreaId === 'aml') return 'Anti-Money Laundering';
  if (codeAreaId === 'lenders') return 'Acting for Lenders';
  if (codeAreaId === 'code-of-conduct') return 'Code of Conduct';
  return codeAreaId;
}

function resolveCodeAreaIdFromSectionId(sectionId) {
  const cleanSectionId = String(sectionId || '').trim();
  if (!cleanSectionId) return '';
  const withoutPrefix = cleanSectionId
    .replace(/^section[_-]/i, '')
    .replace(/^report[_-]section[_-]/i, '');
  return normalizeCodeAreaId(withoutPrefix || cleanSectionId);
}

function mapRequirement(docSnap) {
  const data = docSnap.data() ?? {};
  const status = String(data.status ?? 'lead').toLowerCase().replace(/\s+/g, '_');
  const safeStatus =
    status === 'lead_linked'
      ? 'lead'
      : ['compliant', 'non_compliant', 'lead', 'good_practice', 'not_applicable', 'not_assessed'].includes(status)
        ? status
        : 'lead';
  const requirementId = coerceText(data.requirementId ?? docSnap.id);
  const definition = getDemoRequirementDefinition(requirementId);
  const codeAreaId = normalizeCodeAreaId(definition?.codeArea || data.codeArea || data.code_area || '');
  return {
    id: requirementId,
    codeAreaId,
    codeAreaLabel:
      coerceText(definition?.codeAreaLabel) ||
      coerceText(data.codeAreaLabel) ||
      deriveCodeAreaLabel(codeAreaId),
    label: definition?.label ?? data.label ?? data.title ?? data.requirement ?? requirementId,
    content:
      definition?.content ??
      data.content ??
      data.label ??
      data.title ??
      data.requirement ??
      requirementId,
    status: safeStatus
  };
}

function hasFindingBeenReviewed(finding) {
  return statusToDecision(finding?.reviewStatus) !== null;
}

function buildCaseDashboardSummary({ findings = [], requirements = [] }) {
  const requirementsList =
    requirements.length > 0
      ? requirements
      : Array.from(
          new Map(
            findings
              .map((finding) => {
                const requirementId = coerceText(finding?.requirementId);
                if (!requirementId) return null;
                return [
                  requirementId,
                  {
                    id: requirementId,
                    codeAreaId: coerceText(finding?.codeArea) || 'aml',
                    label: requirementId,
                    status: 'not_assessed'
                  }
                ];
              })
              .filter(Boolean)
          ).values()
        );

  const findingsByRequirement = new Map();
  findings.forEach((finding) => {
    const requirementId = coerceText(finding?.requirementId);
    if (!requirementId) return;
    const rows = findingsByRequirement.get(requirementId) ?? [];
    rows.push(finding);
    findingsByRequirement.set(requirementId, rows);
  });

  const reviewedRequirements = requirementsList.reduce((count, requirement) => {
    const relatedFindings = findingsByRequirement.get(coerceText(requirement?.id)) ?? [];
    if (relatedFindings.length === 0) {
      return count;
    }
    return relatedFindings.every(hasFindingBeenReviewed) ? count + 1 : count;
  }, 0);

  const totalRequirements = requirementsList.length;
  const unreviewed = findings.filter((finding) => !hasFindingBeenReviewed(finding)).length;
  const leads = findings.filter((finding) => deriveLegacyFindingSeverity(finding) === 'warning').length;
  const goodPractice = findings.filter((finding) => deriveLegacyFindingSeverity(finding) === 'best_practice').length;
  const progress = totalRequirements > 0 ? Math.round((reviewedRequirements / totalRequirements) * 100) : 100;
  const progressLabel =
    totalRequirements > 0
      ? `${reviewedRequirements}/${totalRequirements} requirements reviewed`
      : 'No requirements generated';

  return {
    progress,
    progressLabel,
    unreviewed,
    leads,
    goodPractice
  };
}

async function syncCaseDashboardSummary(caseRef) {
  const [findingsSnap, requirementsSnap] = await Promise.all([
    getDocs(collection(caseRef, 'findings')),
    getDocs(collection(caseRef, 'requirements'))
  ]);

  const findings = findingsSnap.docs.map(mapFinding);
  const requirements = requirementsSnap.docs.map(mapRequirement);
  const summary = buildCaseDashboardSummary({ findings, requirements });

  await setDoc(
    caseRef,
    {
      ...summary,
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp()
    },
    { merge: true }
  );

  return summary;
}

function includesQuery(haystackParts, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return false;
  const haystack = haystackParts
    .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
    .map((entry) => (entry === null || entry === undefined ? '' : String(entry)))
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export async function loadCaseWorkspaceData(caseId) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId) {
    return null;
  }

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const caseDocSnap = await getDoc(caseRef);
  const caseData = caseDocSnap.exists() ? caseDocSnap.data() : {};

  const [
    documentsSnap,
    findingsSnap,
    historySnap,
    contextNotesSnap,
    uploadsSnap,
    findingNotesSnap,
    documentNotesSnap,
    requirementsSnap,
    observationsSnap,
    reportActionsSnap,
    reportSectionsSnap,
    reportCurrentSnap
  ] = await Promise.all([
    getDocs(collection(caseRef, 'documents')),
    getDocs(collection(caseRef, 'findings')),
    getDocs(collection(caseRef, 'history')),
    getDocs(collection(caseRef, 'contextNotes')),
    getDocs(collection(caseRef, 'uploads')),
    getDocs(collection(caseRef, 'findingNotes')),
    getDocs(collection(caseRef, 'documentNotes')),
    getDocs(collection(caseRef, 'requirements')),
    getDocs(collection(caseRef, 'observations')),
    getDocs(collection(caseRef, 'reportActions')),
    getDocs(collection(caseRef, 'reportSections')),
    getDoc(doc(caseRef, 'report', 'current'))
  ]);

  const documents = documentsSnap.docs.map(mapDocument);
  const allFindings = findingsSnap.docs.map(mapFinding);

  const findingDecisions = {};
  findingsSnap.docs.forEach((entry) => {
    const reviewStatus = entry.data()?.reviewStatus ?? entry.data()?.review_status;
    const mapped = statusToDecision(reviewStatus);
    if (mapped) {
      findingDecisions[entry.id] = mapped;
    }
  });

  const findingNotes = {};
  findingNotesSnap.docs.forEach((entry) => {
    const data = entry.data() ?? {};
    const findingId = data.findingId;
    if (!findingId) return;
    findingNotes[findingId] = {
      text: data.text ?? '',
      ts: formatTime(data.updatedAt ?? data.createdAt),
      actor: data.authorName ?? data.actorName ?? 'Inspector'
    };
  });

  const documentNotes = {};
  documentNotesSnap.docs.forEach((entry) => {
    const data = entry.data() ?? {};
    const documentId = data.documentId;
    if (!documentId) return;
    const row = {
      id: entry.id,
      text: data.text ?? '',
      ts: formatTime(data.updatedAt ?? data.createdAt),
      actor: data.authorName ?? data.actorName ?? 'Inspector'
    };
    if (!documentNotes[documentId]) {
      documentNotes[documentId] = [];
    }
    documentNotes[documentId].push(row);
  });

  const historyItems = historySnap.docs
    .map(mapHistory)
    .sort((a, b) => {
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });

  const caseContextNotes = contextNotesSnap.docs
    .map((entry) => {
      const data = entry.data() ?? {};
      return {
        id: entry.id,
        text: data.text ?? '',
        ts: data.timestampLabel ?? formatTime(data.createdAt),
        actor: data.actor ?? data.actorName ?? 'Inspector'
      };
    })
    .sort((a, b) => {
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });

  const uploadItems = uploadsSnap.docs
    .map((entry) => {
      const data = entry.data() ?? {};
      return normalizeUploadDraft({
        id: entry.id,
        name: data.name ?? data.filename ?? entry.id,
        filename: data.filename ?? data.name ?? entry.id,
        status: data.status ?? '',
        confirmed: data.confirmed === true,
        processing_status: data.processing_status ?? data.processingStatus ?? '',
        classification: data.classification ?? 'Unknown',
        classificationL1: data.classificationL1 ?? data.classification_l1 ?? '',
        classificationL2: data.classificationL2 ?? data.classification_l2 ?? '',
        classificationDetail: data.classificationDetail ?? data.classification_detail ?? '',
        limitedAnalysis: data.limitedAnalysis ?? data.limited_analysis ?? false,
        parties: data.parties ?? 'Firm',
        interviewees: Array.isArray(data.interviewees) ? data.interviewees : [],
        intervieweeName: data.intervieweeName ?? '',
      intervieweeRole: data.intervieweeRole ?? '',
      interviewDate: data.interviewDate ?? '',
      confidence: data.classification_confidence ?? data.classificationConfidence ?? data.confidence ?? 'low',
      classification_confidence: data.classification_confidence ?? data.classificationConfidence ?? data.confidence ?? null,
      processing_path: data.processing_path ?? data.processingPath ?? '',
      features_found: Array.isArray(data.features_found)
        ? data.features_found
        : Array.isArray(data.featuresFound)
          ? data.featuresFound
          : [],
        models_agree:
        typeof data.models_agree === 'boolean'
          ? data.models_agree
          : typeof data.modelsAgree === 'boolean'
            ? data.modelsAgree
            : null,
      classificationReason: data.classificationReason ?? data.classification_reason ?? '',
      classificationJustification:
        data.classificationJustification ?? data.classification_justification ?? '',
      reviewDecision: data.reviewDecision ?? data.review_decision ?? data.confirmRemove ?? data.confirm_remove ?? '',
      addedOn: data.addedOn ?? '',
      summary: data.summary ?? ''
    });
  })
    .sort((a, b) => {
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });

  const findings = allFindings;
  const requirementsByCodeArea = {};
  requirementsSnap.docs.forEach((entry) => {
    const mapped = mapRequirement(entry);
    if (!mapped.codeAreaId) return;
    if (!requirementsByCodeArea[mapped.codeAreaId]) {
      requirementsByCodeArea[mapped.codeAreaId] = [];
    }
    requirementsByCodeArea[mapped.codeAreaId].push({
      id: mapped.id,
      codeAreaLabel: mapped.codeAreaLabel,
      label: mapped.label,
      content: mapped.content,
      status: mapped.status
    });
  });

  Object.keys(requirementsByCodeArea).forEach((key) => {
    requirementsByCodeArea[key].sort((a, b) => a.label.localeCompare(b.label));
  });

  const inspectorObservations = observationsSnap.docs
    .map((entry) => {
      const data = entry.data() ?? {};
      return {
        id: entry.id,
        text: data.text ?? '',
        requirement: data.requirement ?? 'General observation',
        sourceType: data.sourceType ?? 'Other',
        ts: formatTime(data.updatedAt ?? data.createdAt) || data.timestampLabel || '',
        actor: data.authorName ?? data.actorName ?? 'Inspector'
      };
    })
    .sort((a, b) => {
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });

  const reportActionItems = reportActionsSnap.docs
    .map((entry) => {
      const data = entry.data() ?? {};
      const rawDeadline = String(data.deadline ?? '').trim();
      return {
        id: entry.id,
        action: data.action ?? 'Action item',
        codeRef: data.codeRef ?? data.code_ref ?? null,
        codeArea: data.codeArea ?? 'General',
        deadline: /^\d{4}-\d{2}-\d{2}$/.test(rawDeadline) ? rawDeadline : '',
        person: data.person ?? ''
      };
    })
    .sort((a, b) => {
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });

  const reportSectionIdsByCodeArea = {};
  const reportSectionNarrativesByCodeArea = {};
  reportSectionsSnap.docs.forEach((entry) => {
    const data = entry.data() ?? {};
    const codeAreaId = normalizeCodeAreaId(
      data.codeAreaId ?? data.codeArea ?? data.code_area ?? resolveCodeAreaIdFromSectionId(entry.id)
    );
    if (!codeAreaId) return;
    reportSectionIdsByCodeArea[codeAreaId] = entry.id;
    const lines = Array.isArray(data.lines)
      ? data.lines.map((line) => String(line || '').trim()).filter(Boolean)
      : String(data.narrative || '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
    if (lines.length > 0) {
      reportSectionNarrativesByCodeArea[codeAreaId] = lines;
    }
  });

  // Ensure each known code area has a stable section id, even before backend/API creates section records.
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

  const reportCurrentData = reportCurrentSnap.exists() ? reportCurrentSnap.data() ?? {} : {};
  const reportExecutiveSummary =
    typeof reportCurrentData.executiveSummary === 'string'
      ? reportCurrentData.executiveSummary
      : typeof reportCurrentData.executive_summary === 'string'
        ? reportCurrentData.executive_summary
        : '';

  return {
    caseExists: caseDocSnap.exists(),
    caseMetaPatch: {
      practiceName: caseData.practiceName,
      caseId: caseData.caseId ?? cleanCaseId,
      owner: caseData.assignedInspectorName ?? caseData.owner ?? caseData.inspector,
      started: caseData.started,
      riskLevel: caseData.riskLevel,
      previousInspection: caseData.previousInspection,
      status: caseData.status ?? 'active',
      outcome: caseData.outcome ?? 'in_progress',
      holp: caseData.holp,
      hofa: caseData.hofa,
      focusAreas: Array.isArray(caseData.focusAreas) ? caseData.focusAreas : [],
      transactionType: caseData.transactionType ?? '',
      actingForLender: typeof caseData.actingForLender === 'boolean' ? caseData.actingForLender : null,
      amlTier: caseData.amlTier ?? '',
      knownParties: Array.isArray(caseData.knownParties) ? caseData.knownParties : [],
      processingStatus: caseData.processing_status ?? caseData.processingStatus ?? '',
      hasUnprocessedChanges:
        caseData.has_unprocessed_changes === true || caseData.hasUnprocessedChanges === true,
      unprocessedSummary: caseData.unprocessed_summary ?? caseData.unprocessedSummary ?? ''
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

function mapCase(docSnap) {
  const data = docSnap.data() ?? {};
  const rawOutcome = typeof data.outcome === 'string' ? data.outcome : '';
  const normalizedOutcome = rawOutcome.trim().toLowerCase().replace(/\s+/g, '_');
  const assignedInspectorName = data.assignedInspectorName ?? data.inspector ?? data.owner ?? '';
  const assignedInspectorUserId = data.assignedInspectorUserId ?? data.inspectorUserId ?? data.createdByUserId ?? '';
  const assignedInspectorEmail = data.assignedInspectorEmail ?? data.inspectorEmail ?? data.ownerEmail ?? '';
  const inferredOutcome =
    normalizedOutcome ||
    (data.status === 'completed'
      ? 'compliant'
      : typeof data.progress === 'number' && data.progress >= 100
        ? 'compliant'
        : 'in_progress');
  return {
    id: data.caseId ?? docSnap.id,
    practice: data.practiceName ?? 'Unknown practice',
    started: data.started ?? '',
    startedAt: data.startedAt ?? data.createdAt ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    progress: typeof data.progress === 'number' ? data.progress : 0,
    progressLabel: data.progressLabel ?? '0/0 requirements reviewed',
    unreviewed: typeof data.unreviewed === 'number' ? data.unreviewed : 0,
    leads: typeof data.leads === 'number' ? data.leads : 0,
    goodPractice: typeof data.goodPractice === 'number' ? data.goodPractice : 0,
    risk: data.riskLevel ?? 'Not assessed',
    lastActivity: data.lastActivity ?? '',
    lastActivityAt: data.lastActivityAt ?? data.updatedAt ?? data.createdAt ?? null,
    inspector: assignedInspectorName,
    inspectorId: assignedInspectorUserId,
    inspectorEmail: data.inspectorEmail ?? data.ownerEmail ?? assignedInspectorEmail,
    owner: data.owner ?? assignedInspectorName,
    ownerEmail: data.ownerEmail ?? '',
    assignedInspectorUserId,
    assignedInspectorEmail,
    createdByUserId: data.createdByUserId ?? '',
    status: data.status ?? 'active',
    outcome: inferredOutcome
  };
}

async function attachLiveDashboardSummary(docSnap) {
  const baseRow = mapCase(docSnap);
  const caseRef = docSnap.ref;

  try {
    const [findingsSnap, requirementsSnap] = await Promise.all([
      getDocs(collection(caseRef, 'findings')),
      getDocs(collection(caseRef, 'requirements'))
    ]);

    const findings = findingsSnap.docs.map(mapFinding);
    const requirements = requirementsSnap.docs.map(mapRequirement);
    const summary = buildCaseDashboardSummary({ findings, requirements });

    return {
      ...baseRow,
      ...summary,
      outcome:
        baseRow.status === 'completed'
          ? 'compliant'
          : summary.progress >= 100
            ? 'compliant'
            : 'in_progress'
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to derive live dashboard summary for case ${baseRow.id}`, error);
    return baseRow;
  }
}

export async function listCases({ user, role } = {}) {
  const casesRef = collection(database, 'organizations', ORGANIZATION_ID, 'cases');
  const normalizedRole = normalizeUserRole(role);

  if (canAccessTeamCases(normalizedRole)) {
    const snapshot = await getDocs(casesRef);
    return Promise.all(snapshot.docs.map(attachLiveDashboardSummary));
  }

  const currentUserId = coerceText(user?.uid);
  const currentUserEmail = coerceText(user?.email);
  const queries = [];

  if (currentUserId) {
    queries.push(getDocs(query(casesRef, where('assignedInspectorUserId', '==', currentUserId))));
    queries.push(getDocs(query(casesRef, where('createdByUserId', '==', currentUserId))));
  }

  if (currentUserEmail) {
    queries.push(getDocs(query(casesRef, where('assignedInspectorEmail', '==', currentUserEmail))));
    queries.push(getDocs(query(casesRef, where('inspectorEmail', '==', currentUserEmail))));
    queries.push(getDocs(query(casesRef, where('ownerEmail', '==', currentUserEmail))));
    queries.push(getDocs(query(casesRef, where('inspector', '==', currentUserEmail))));
    queries.push(getDocs(query(casesRef, where('owner', '==', currentUserEmail))));
  }

  if (queries.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(queries);
  return Promise.all(buildDistinctDocList(snapshots).map(attachLiveDashboardSummary));
}

export async function searchCase({ caseId, query, scope = 'all', documentId }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanQuery = String(query || '').trim();
  if (!cleanCaseId || !cleanQuery) {
    return {
      supported: true,
      results: []
    };
  }

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const [findingsSnap, documentsSnap] = await Promise.all([
    getDocs(collection(caseRef, 'findings')),
    getDocs(collection(caseRef, 'documents'))
  ]);

  const documentNameById = new Map();
  documentsSnap.docs.forEach((entry) => {
    const data = entry.data() ?? {};
    const name = data.filename ?? data.name ?? data.label ?? entry.id;
    documentNameById.set(entry.id, name);
  });

  const results = [];

  findingsSnap.docs.forEach((entry) => {
    const finding = mapFinding(entry);
    if (!finding?.id) return;

    if (scope === 'document' && documentId && finding.documentId !== documentId) {
      return;
    }

    const evidencePassages = Array.isArray(finding.evidencePassages) ? finding.evidencePassages : [];
    const haystackMatched = includesQuery(
      [
        finding.title,
        finding.detail,
        finding.reference,
        finding.codeArea,
        finding.source?.file,
        finding.source?.section,
        finding.source?.text,
        evidencePassages.map((passage) => [
          passage?.file,
          passage?.document_name,
          passage?.section,
          passage?.text,
          passage?.excerpt
        ])
      ],
      cleanQuery
    );

    if (!haystackMatched) return;

    const normalizedPassages = evidencePassages
      .map((passage, index) => ({
        id: passage?.id || `${finding.id}-p${index}`,
        document_id: passage?.document_id || finding.documentId || '',
        file: passage?.file || passage?.document_name || documentNameById.get(finding.documentId) || '',
        page: passage?.page ?? null,
        section: passage?.section || '',
        text: passage?.text || passage?.excerpt || '',
        box_id: passage?.box_id || finding.boxId || null
      }))
      .filter((passage) => !documentId || passage.document_id === documentId);

    results.push({
      id: finding.id,
      severity: deriveLegacyFindingSeverity(finding),
      title: finding.title || 'Finding',
      detail: finding.detail || '',
      documentId: finding.documentId || '',
      boxId: finding.boxId || null,
      codeArea: finding.codeArea || '',
      evidencePassages: normalizedPassages,
      source: {
        file: finding.source?.file || documentNameById.get(finding.documentId) || '',
        page: finding.source?.page ?? null,
        section: finding.source?.section || '',
        text: finding.source?.text || finding.detail || ''
      },
      reference: finding.reference || ''
    });
  });

  return {
    supported: true,
    results: results.slice(0, 40)
  };
}

export async function exportCaseReport({ caseId, format = 'pdf' }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId) {
    return { supported: false };
  }

  if (format !== 'pdf') {
    return { supported: false };
  }

  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof Blob === 'undefined') {
    return { supported: false };
  }

  const snapshot = await loadCaseWorkspaceData(cleanCaseId);
  if (!snapshot?.caseExists) {
    return { supported: false };
  }

  const caseMeta = snapshot.caseMetaPatch ?? {};
  const findings = Array.isArray(snapshot.findings) ? snapshot.findings : [];
  const actions = Array.isArray(snapshot.reportActionItems) ? snapshot.reportActionItems : [];

  const totals = findings.reduce(
    (acc, finding) => {
      const severity = deriveLegacyFindingSeverity(finding);
      if (severity === 'critical') acc.critical += 1;
      else if (severity === 'warning') acc.warning += 1;
      else if (severity === 'best_practice') acc.bestPractice += 1;
      else if (severity === 'pass') acc.pass += 1;
      return acc;
    },
    { critical: 0, warning: 0, bestPractice: 0, pass: 0 }
  );

  const attentionLines = findings
    .filter((finding) => {
      const severity = deriveLegacyFindingSeverity(finding);
      return severity === 'critical' || severity === 'warning';
    })
    .slice(0, 8)
    .map((finding) => {
      const codeArea = String(finding.codeArea || 'General').trim();
      const detail = String(finding.detail || finding.title || 'Attention finding').trim();
      return codeArea ? `${codeArea}: ${detail}` : detail;
    });

  const goodPracticeLines = findings
    .filter((finding) => deriveLegacyFindingSeverity(finding) === 'best_practice')
    .slice(0, 4)
    .map((finding) => {
      const codeArea = String(finding.codeArea || 'General').trim();
      const detail = String(finding.detail || finding.title || 'Good practice finding').trim();
      return codeArea ? `${codeArea}: ${detail}` : detail;
    });

  const summaryNarrative = String(snapshot.reportExecutiveSummary || '').trim();
  const derivedSummary =
    findings.length > 0
      ? `Of ${findings.length} findings, ${totals.pass} are compliant, ${totals.bestPractice} are good practice, and ${totals.critical + totals.warning} require attention.`
      : 'No findings are currently available for this case.';
  const actionLines = actions.map((item) => {
    const codeArea = String(item.codeArea || 'General').trim();
    const codeRef = String(item.codeRef || '').trim();
    const deadline = String(item.deadline || 'TBD').trim() || 'TBD';
    const owner = String(item.person || 'Unassigned').trim() || 'Unassigned';
    const action = String(item.action || 'Action item').trim();
    return `[${codeRef ? `${codeRef} | ` : ''}${codeArea}] ${action} | Deadline: ${deadline} | Owner: ${owner}`;
  });

  const appendixLines = findings.slice(0, 20).map((finding, index) => {
    const codeArea = String(finding.codeArea || 'General').trim();
    const severity = deriveLegacyFindingSeverity(finding);
    const label =
      severity === 'critical'
        ? 'Non-compliant'
        : severity === 'warning'
          ? 'Requires review'
          : severity === 'best_practice'
            ? 'Good practice'
            : 'Compliant';
    return `F-${String(index + 1).padStart(3, '0')} | ${label} | ${codeArea} | ${String(finding.title || 'Finding').trim()}`;
  });

  const { blob, filename } = createInspectionReportPdf({
    caseMeta: {
      practiceName: caseMeta.practiceName || 'Unknown practice',
      caseId: caseMeta.caseId || cleanCaseId,
      inspector: caseMeta.owner || 'Inspector',
      inspectionDate: caseMeta.started || '',
      inspectionType: (snapshot.uploadItems ?? []).length > 0 ? 'Desk-based review' : 'Inspection type pending',
      holp: caseMeta.holp || '',
      hofa: caseMeta.hofa || ''
    },
    summaryLines: [
      `Total findings: ${findings.length}`,
      `Non-compliant: ${totals.critical}`,
      `Requires review: ${totals.warning}`,
      `Compliant: ${totals.pass}`,
      `Good practice: ${totals.bestPractice}`
    ],
    sections: [
      { heading: 'Compliance Summary', lines: [summaryNarrative || derivedSummary] },
      {
        heading: 'Areas of Good Practice',
        lines: goodPracticeLines.length > 0 ? goodPracticeLines : ['No good practice findings are currently mapped.'],
        bulleted: true
      },
      {
        heading: 'Areas Requiring Attention',
        lines: attentionLines.length > 0 ? attentionLines : ['No attention findings are currently mapped.'],
        bulleted: true
      },
      ...(actionLines.length > 0
        ? [{ heading: 'Action Plan', lines: actionLines, bulleted: true }]
        : []),
      ...(appendixLines.length > 0
        ? [{ heading: 'Appendix - Detailed Findings', lines: appendixLines, bulleted: true }]
        : [])
    ],
    filename: `CLC_Inspection_Report_${caseMeta.caseId || cleanCaseId}.pdf`
  });

  const objectUrl = URL.createObjectURL(blob);
  return {
    supported: true,
    downloadUrl: objectUrl,
    filename,
    revokeOnUse: true
  };
}

export async function lookupPracticeByLicenceNumber(licenceNumber) {
  const cleanLicenceNumber = String(licenceNumber || '').trim();
  if (!cleanLicenceNumber) {
    return { match: false };
  }

  const buildPracticeResult = (data = {}, fallbackLicenceNumber = cleanLicenceNumber) => ({
    match: true,
    practice: {
      name: data.practiceName || 'Example Conveyancing Co Ltd',
      licence_number: data.caseId || data.licenceNumber || fallbackLicenceNumber,
      holp: data.holp || 'Sarah Chen',
      hofa: data.hofa || 'James Wright',
      last_inspection: {
        date: data.previousInspection && data.previousInspection !== 'N/A' ? data.previousInspection : '2023-03-12',
        case_id: data.caseId || data.licenceNumber || fallbackLicenceNumber,
        outcome: data.outcome || null
      }
    }
  });

  if (cleanLicenceNumber.toUpperCase() === 'CLC-12458') {
    return buildPracticeResult({
      practiceName: 'Example Conveyancing Co Ltd',
      caseId: 'CLC-12458',
      holp: 'Sarah Chen',
      hofa: 'James Wright',
      previousInspection: '2023-03-12',
      outcome: 'in_progress'
    });
  }

  try {
    const directRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanLicenceNumber);
    const directDoc = await getDoc(directRef);
    if (directDoc.exists()) {
      return buildPracticeResult(directDoc.data() ?? {}, cleanLicenceNumber);
    }

    const casesRef = collection(database, 'organizations', ORGANIZATION_ID, 'cases');
    const [caseIdMatches, licenceMatches] = await Promise.all([
      getDocs(query(casesRef, where('caseId', '==', cleanLicenceNumber))),
      getDocs(query(casesRef, where('licenceNumber', '==', cleanLicenceNumber)))
    ]);

    const matchedDoc = caseIdMatches.docs[0] ?? licenceMatches.docs[0] ?? null;
    if (!matchedDoc) {
      return { match: false };
    }

    return buildPracticeResult(matchedDoc.data() ?? {}, cleanLicenceNumber);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Falling back to local practice lookup result', error);
    return { match: false };
  }
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
  user
}) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId) {
    throw new Error('Missing caseId');
  }
  const assignedInspectorName = String(owner || '').trim() || getUserDisplayLabel(user);
  const assignedInspectorEmail = coerceText(user?.email) || null;
  const assignedInspectorUserId = coerceText(user?.uid) || null;
  const now = serverTimestamp();
  const startedDate = new Date().toLocaleDateString();
  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const mappedFocusAreas = Array.isArray(focusAreas)
    ? Array.from(
        new Set(
          focusAreas
            .map((value) => String(value || '').trim())
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

  await setDoc(
    caseRef,
    {
      caseId: cleanCaseId,
      licenceNumber: cleanCaseId,
      practiceName: practiceName?.trim() || 'Unnamed practice',
      owner: assignedInspectorName,
      ownerEmail: assignedInspectorEmail,
      inspector: assignedInspectorName,
      inspectorUserId: assignedInspectorUserId,
      inspectorEmail: assignedInspectorEmail,
      assignedInspectorName,
      assignedInspectorUserId,
      assignedInspectorEmail,
      status: 'active',
      outcome: 'in_progress',
      riskLevel: riskLevel ?? 'Not assessed',
      transactionType: coerceText(transactionType) || '',
      actingForLender: actingForLender === true,
      amlTier: coerceText(amlTier) || '',
      started: startedDate,
      previousInspection: previousInspection || 'N/A',
      holp: holp ?? '',
      hofa: hofa ?? '',
      focusAreas: mappedFocusAreas,
      preInspectionConcerns: String(preInspectionConcerns || '').trim(),
      knownParties: mappedKnownParties,
      questionnaireFilename: questionnaireFileName || null,
      progress: 0,
      progressLabel: '0/0 requirements reviewed',
      unreviewed: 0,
      leads: 0,
      goodPractice: 0,
      lastActivity: 'Just now',
      createdByUserId: user?.uid ?? null,
      createdByName: getUserDisplayLabel(user),
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now
    },
    { merge: true }
  );

  await addDoc(collection(caseRef, 'history'), {
    timestampLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    detail: 'Case created',
    actor: user?.email ?? 'Inspector',
    actorUserId: user?.uid ?? null,
    createdAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'case_created',
    actorUserId: user?.uid ?? null,
    actorName: user?.email ?? 'Inspector',
    targetType: 'case',
    targetId: cleanCaseId,
    payload: {},
    createdAt: now
  });

  return { id: cleanCaseId };
}

export async function persistFindingDecision({ caseId, findingId, decision, user, reason, reasonNote, finding }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId || !findingId) return;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const findingRef = doc(caseRef, 'findings', findingId);
  const now = serverTimestamp();
  const nextReviewStatus = decisionToStatus(decision, finding);
  const cleanReason = String(reason || finding?.reviewReason || '').trim();
  const cleanReasonNote = String(reasonNote || finding?.reviewReasonNote || '').trim();
  const polarity = finding?.polarity === 'compliant' ? 'compliant' : 'non_compliant';
  const isGoodPractice =
    polarity === 'compliant' &&
    (finding?.isGoodPractice === true || finding?.is_good_practice === true);
  const evidencePassages = Array.isArray(finding?.evidencePassages)
    ? finding.evidencePassages
    : Array.isArray(finding?.evidence_passages)
      ? finding.evidence_passages
      : [];

  await setDoc(
    findingRef,
    {
      severity: deriveLegacyFindingSeverity({
        severity: finding?.severity,
        certainty: finding?.certainty,
        polarity,
        isGoodPractice,
        reviewStatus: nextReviewStatus
      }),
      polarity,
      isGoodPractice,
      evidencePassages,
      documentId: finding?.documentId ?? '',
      boxId: finding?.boxId ?? null,
      reviewStatus: nextReviewStatus,
      reviewReason: decision === 'rejected' || decision === 'dismissed' ? cleanReason || null : null,
      reviewReasonNote: decision === 'rejected' || decision === 'dismissed' ? cleanReasonNote || null : null,
      reviewedAt: decision ? now : null,
      reviewedByUserId: decision ? user?.uid ?? null : null,
      updatedAt: now
    },
    { merge: true }
  );

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'finding_decision_changed',
    actorUserId: user?.uid ?? null,
    actorName: user?.email ?? 'Inspector',
    targetType: 'finding',
    targetId: findingId,
    payload: {
      decision: decision ?? 'cleared',
      reviewStatus: nextReviewStatus,
      reason: cleanReason || null,
      reasonNote: cleanReasonNote || null
    },
    createdAt: now
  });

  await syncCaseDashboardSummary(caseRef);
}

export async function persistFindingNote({ caseId, findingId, text, user }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId || !findingId || !text?.trim()) return;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const now = serverTimestamp();

  await addDoc(collection(caseRef, 'findingNotes'), {
    findingId,
    text: text.trim(),
    authorUserId: user?.uid ?? null,
    authorName: user?.email ?? 'Inspector',
    createdAt: now,
    updatedAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'finding_note_added',
    actorUserId: user?.uid ?? null,
    actorName: user?.email ?? 'Inspector',
    targetType: 'finding',
    targetId: findingId,
    payload: { hasText: true },
    createdAt: now
  });
}

export async function persistInspectorFinding({ caseId, finding, user }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId || !finding || typeof finding !== 'object') return null;

  const now = serverTimestamp();
  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const polarity = finding?.polarity === 'compliant' ? 'compliant' : 'non_compliant';
  const isGoodPractice =
    polarity === 'compliant' &&
    (finding?.isGoodPractice === true || finding?.is_good_practice === true);
  const createdRef = await addDoc(collection(caseRef, 'findings'), {
    severity: deriveLegacyFindingSeverity({
      severity: finding?.severity,
      certainty: finding?.certainty || 'finding',
      polarity,
      isGoodPractice,
      reviewStatus: finding?.reviewStatus ?? 'unreviewed'
    }),
    title: finding.title ?? 'Inspector finding',
    detail: finding.detail ?? '',
    documentId: finding.documentId ?? '',
    boxId: finding.boxId ?? null,
    codeArea: finding.codeArea ?? '',
    requirementId: finding.requirementId ?? null,
    certainty: finding.certainty ?? 'finding',
    polarity,
    isGoodPractice,
    requirementSeverity: finding.requirementSeverity ?? 'critical',
    reviewStatus: finding.reviewStatus ?? 'unreviewed',
    observationSource: normalizeObservationSource(
      finding?.observationSource || finding?.sourceType || finding?.observation_source
    ),
    evidencePassages: Array.isArray(finding.evidencePassages) ? finding.evidencePassages : [],
    source: finding.source && typeof finding.source === 'object' ? finding.source : null,
    reference: finding.reference ?? '',
    origin: 'inspector',
    isInspectorAdded: true,
    createdByUserId: user?.uid ?? null,
    createdByName: user?.email ?? 'Inspector',
    createdAt: now,
    updatedAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'inspector_item_added',
    actorUserId: user?.uid ?? null,
    actorName: user?.email ?? 'Inspector',
    targetType: 'finding',
    targetId: createdRef.id,
    payload: {
      source: 'inspector',
      severity: deriveLegacyFindingSeverity({
        severity: finding?.severity,
        certainty: finding?.certainty || 'finding',
        polarity,
        isGoodPractice,
        reviewStatus: finding?.reviewStatus ?? 'unreviewed'
      })
    },
    createdAt: now
  });

  await syncCaseDashboardSummary(caseRef);

  return {
    id: createdRef.id
  };
}

export async function persistInspectorFindingDelete({ caseId, findingId, user }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanFindingId = String(findingId || '').trim();
  if (!cleanCaseId || !cleanFindingId) return null;

  const now = serverTimestamp();
  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  await deleteDoc(doc(caseRef, 'findings', cleanFindingId));

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'inspector_item_deleted',
    actorUserId: user?.uid ?? null,
    actorName: user?.email ?? 'Inspector',
    targetType: 'finding',
    targetId: cleanFindingId,
    payload: {
      source: 'inspector'
    },
    createdAt: now
  });

  await syncCaseDashboardSummary(caseRef);

  return {
    supported: true
  };
}

export async function persistDocumentNote({ caseId, documentId, text, user }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId || !documentId || !text?.trim()) return;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const now = serverTimestamp();

  await addDoc(collection(caseRef, 'documentNotes'), {
    documentId,
    text: text.trim(),
    authorUserId: user?.uid ?? null,
    authorName: user?.email ?? 'Inspector',
    createdAt: now,
    updatedAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'document_note_added',
    actorUserId: user?.uid ?? null,
    actorName: user?.email ?? 'Inspector',
    targetType: 'document',
    targetId: documentId,
    payload: { hasText: true },
    createdAt: now
  });
}

export async function persistContextNote({ caseId, text, user }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId || !text?.trim()) return;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';
  const timestampLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  await addDoc(collection(caseRef, 'contextNotes'), {
    text: text.trim(),
    actor: actorName,
    actorUserId: user?.uid ?? null,
    timestampLabel,
    createdAt: now
  });

  await addDoc(collection(caseRef, 'history'), {
    timestampLabel,
    detail: 'Case context note updated',
    actor: actorName,
    actorUserId: user?.uid ?? null,
    createdAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'context_note_added',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'case',
    targetId: cleanCaseId,
    payload: { hasText: true },
    createdAt: now
  });
}

export async function persistCasePatch({ caseId, patch, user }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId || !patch || typeof patch !== 'object') {
    return null;
  }

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';
  const timestampLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const allowedPatch = {};
  if (typeof patch.status === 'string' && patch.status.trim()) {
    allowedPatch.status = patch.status.trim();
  }
  if (typeof patch.outcome === 'string' && patch.outcome.trim()) {
    allowedPatch.outcome = patch.outcome.trim();
  }
  if (typeof patch.progress === 'number' && Number.isFinite(patch.progress)) {
    allowedPatch.progress = patch.progress;
  }
  if (typeof patch.progressLabel === 'string' && patch.progressLabel.trim()) {
    allowedPatch.progressLabel = patch.progressLabel.trim();
  }

  if (Object.keys(allowedPatch).length > 0) {
    await setDoc(
      caseRef,
      {
        ...allowedPatch,
        updatedAt: now,
        lastActivityAt: now
      },
      { merge: true }
    );

    await addDoc(collection(caseRef, 'history'), {
      timestampLabel,
      detail: 'Case summary updated',
      actor: actorName,
      actorUserId: user?.uid ?? null,
      createdAt: now
    });
  }

  if (Array.isArray(patch.context_notes)) {
    const contextNotes = patch.context_notes
      .map((row) => String(row?.text || '').trim())
      .filter(Boolean);
    for (const text of contextNotes) {
      await addDoc(collection(caseRef, 'contextNotes'), {
        text,
        actor: actorName,
        actorUserId: user?.uid ?? null,
        timestampLabel,
        createdAt: now
      });
    }
  }

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'case_patch_applied',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'case',
    targetId: cleanCaseId,
    payload: {
      keys: Object.keys(allowedPatch),
      contextNoteCount: Array.isArray(patch.context_notes) ? patch.context_notes.length : 0
    },
    createdAt: now
  });

  return {
    supported: true
  };
}

export async function persistObservation({ caseId, observation, user }) {
  const cleanCaseId = caseId?.trim();
  const cleanedText = String(observation?.text || '').trim();
  if (!cleanCaseId || !cleanedText) return null;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const now = serverTimestamp();

  const docRef = await addDoc(collection(caseRef, 'observations'), {
    text: cleanedText,
    requirement: observation?.requirement ?? 'General observation',
    sourceType: observation?.sourceType ?? 'Other',
    authorUserId: user?.uid ?? null,
    authorName: user?.email ?? 'Inspector',
    actorName: user?.email ?? 'Inspector',
    timestampLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: now,
    updatedAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'observation_added',
    actorUserId: user?.uid ?? null,
    actorName: user?.email ?? 'Inspector',
    targetType: 'observation',
    targetId: docRef.id,
    payload: {
      requirement: observation?.requirement ?? 'General observation',
      sourceType: observation?.sourceType ?? 'Other'
    },
    createdAt: now
  });

  return {
    id: docRef.id
  };
}

export async function persistObservationUpdate({ caseId, observationId, observation, user }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanObservationId = String(observationId || '').trim();
  const cleanedText = String(observation?.text || '').trim();
  if (!cleanCaseId || !cleanObservationId || !cleanedText) {
    return null;
  }

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const observationRef = doc(caseRef, 'observations', cleanObservationId);
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';

  await setDoc(
    observationRef,
    {
      text: cleanedText,
      requirement: observation?.requirement ?? 'General observation',
      sourceType: observation?.sourceType ?? 'Other',
      actorName,
      authorName: actorName,
      authorUserId: user?.uid ?? null,
      timestampLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      updatedAt: now
    },
    { merge: true }
  );

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'observation_updated',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'observation',
    targetId: cleanObservationId,
    payload: {
      requirement: observation?.requirement ?? 'General observation',
      sourceType: observation?.sourceType ?? 'Other'
    },
    createdAt: now
  });

  return {
    supported: true,
    id: cleanObservationId
  };
}

export async function persistObservationDelete({ caseId, observationId, user }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanObservationId = String(observationId || '').trim();
  if (!cleanCaseId || !cleanObservationId) {
    return null;
  }

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const observationRef = doc(caseRef, 'observations', cleanObservationId);
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';

  await deleteDoc(observationRef);

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'observation_deleted',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'observation',
    targetId: cleanObservationId,
    payload: {},
    createdAt: now
  });

  return {
    supported: true
  };
}

export async function persistReportPatch({ caseId, report, user }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId || !report || typeof report !== 'object') {
    return null;
  }

  const payload = {};
  if (typeof report.executive_summary === 'string') {
    payload.executiveSummary = report.executive_summary;
  }
  if (typeof report.overall_rating === 'string') {
    payload.overallRating = report.overall_rating;
  }
  if (Object.keys(payload).length === 0) {
    return null;
  }

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const reportRef = doc(caseRef, 'report', 'current');
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';

  await setDoc(
    reportRef,
    {
      ...payload,
      updatedAt: now,
      updatedByUserId: user?.uid ?? null,
      updatedByName: actorName
    },
    { merge: true }
  );

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'report_patch_applied',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'report',
    targetId: 'current',
    payload: {
      keys: Object.keys(payload)
    },
    createdAt: now
  });

  return {
    supported: true
  };
}

export async function persistReportSectionPatch({ caseId, sectionId, lines, codeAreaId, user }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanSectionId = String(sectionId || '').trim();
  if (!cleanCaseId || !cleanSectionId) {
    return null;
  }

  const normalizedLines = Array.isArray(lines)
    ? lines
        .map((line) => String(line || '').trim())
        .filter(Boolean)
    : [];
  if (normalizedLines.length === 0) {
    return null;
  }

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const sectionRef = doc(caseRef, 'reportSections', cleanSectionId);
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';

  await setDoc(
    sectionRef,
    {
      sectionId: cleanSectionId,
      codeAreaId: normalizeCodeAreaId(codeAreaId || resolveCodeAreaIdFromSectionId(cleanSectionId)),
      narrative: normalizedLines.join('\n'),
      lines: normalizedLines,
      updatedAt: now,
      updatedByUserId: user?.uid ?? null,
      updatedByName: actorName
    },
    { merge: true }
  );

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'report_section_patch_applied',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'report_section',
    targetId: cleanSectionId,
    payload: {
      lineCount: normalizedLines.length
    },
    createdAt: now
  });

  return {
    supported: true
  };
}

export async function persistReportSectionRevert({ caseId, sectionId, user }) {
  const cleanCaseId = String(caseId || '').trim();
  const cleanSectionId = String(sectionId || '').trim();
  if (!cleanCaseId || !cleanSectionId) {
    return null;
  }

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const sectionRef = doc(caseRef, 'reportSections', cleanSectionId);
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';

  await deleteDoc(sectionRef);

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'report_section_reverted',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'report_section',
    targetId: cleanSectionId,
    payload: {},
    createdAt: now
  });

  return {
    supported: true
  };
}

export async function persistFeedback({ caseId, category, text, metadata, user }) {
  const cleanedText = String(text || '').trim();
  if (!cleanedText) {
    return null;
  }

  const cleanCategory = String(category || 'suggestion').trim().toLowerCase() || 'suggestion';
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';

  const feedbackRef = await addDoc(collection(database, 'organizations', ORGANIZATION_ID, 'feedback'), {
    caseId: String(caseId || '').trim() || null,
    category: cleanCategory,
    text: cleanedText,
    metadata: metadata && typeof metadata === 'object' ? metadata : null,
    authorUserId: user?.uid ?? null,
    authorName: actorName,
    createdAt: now
  });

  if (caseId) {
    const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', String(caseId).trim());
    await addDoc(collection(caseRef, 'events'), {
      eventType: 'feedback_submitted',
      actorUserId: user?.uid ?? null,
      actorName,
      targetType: 'case',
      targetId: String(caseId).trim(),
      payload: {
        category: cleanCategory
      },
      createdAt: now
    });
  }

  return {
    supported: true,
    id: feedbackRef.id
  };
}

export async function persistReportAction({ caseId, actionItem, user }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId || !actionItem) return null;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const now = serverTimestamp();
  const targetId = String(actionItem.id || '').trim() || `ra-${Date.now()}`;
  const targetRef = doc(caseRef, 'reportActions', targetId);

  await setDoc(
    targetRef,
    {
      action: actionItem.action ?? 'Action item',
      codeRef: actionItem.codeRef ?? actionItem.code_ref ?? null,
      codeArea: actionItem.codeArea ?? 'General',
      deadline: actionItem.deadline ?? 'TBD',
      person: actionItem.person ?? '',
      updatedAt: now,
      createdAt: now
    },
    { merge: true }
  );

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'report_action_upserted',
    actorUserId: user?.uid ?? null,
    actorName: user?.email ?? 'Inspector',
    targetType: 'report_action',
    targetId,
    payload: {
      codeRef: actionItem.codeRef ?? actionItem.code_ref ?? null,
      codeArea: actionItem.codeArea ?? 'General'
    },
    createdAt: now
  });

  return { id: targetId };
}

export async function persistReportActionDelete({ caseId, actionId, user }) {
  const cleanCaseId = caseId?.trim();
  const cleanActionId = String(actionId || '').trim();
  if (!cleanCaseId || !cleanActionId) return;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const actionRef = doc(caseRef, 'reportActions', cleanActionId);
  const now = serverTimestamp();

  await deleteDoc(actionRef);

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'report_action_deleted',
    actorUserId: user?.uid ?? null,
    actorName: user?.email ?? 'Inspector',
    targetType: 'report_action',
    targetId: cleanActionId,
    payload: {},
    createdAt: now
  });
}

export async function persistUploadItem({ caseId, uploadItem, user }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId || !uploadItem?.id) return;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const uploadRef = doc(caseRef, 'uploads', uploadItem.id);
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';
  const timestampLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const normalizedUploadItem = normalizeUploadDraft(uploadItem);

  await setDoc(
    uploadRef,
    {
      name: normalizedUploadItem.name ?? normalizedUploadItem.filename ?? normalizedUploadItem.id,
      filename: normalizedUploadItem.filename ?? normalizedUploadItem.name ?? normalizedUploadItem.id,
      status: normalizedUploadItem.status ?? 'queued',
      confirmed: normalizedUploadItem.confirmed === true || normalizedUploadItem.status === 'verified',
      processing_status: getUploadProcessingStatusPersistenceValue(normalizedUploadItem) || null,
      classification: getUploadClassificationPersistenceValue(normalizedUploadItem) ?? 'Unknown',
      classificationL1: normalizedUploadItem.classificationL1 ?? '',
      classificationL2: normalizedUploadItem.classificationL2 ?? '',
      classificationDetail: normalizedUploadItem.classificationDetail ?? '',
      limitedAnalysis: normalizedUploadItem.limitedAnalysis === true,
      parties: normalizedUploadItem.parties ?? 'Firm',
      interviewees: Array.isArray(normalizedUploadItem.interviewees)
        ? normalizedUploadItem.interviewees.map((entry) => ({
            id: entry.id ?? '',
            name: entry.name ?? '',
            role: entry.role ?? '',
            date: entry.date ?? '',
            contextNote: entry.contextNote ?? ''
          }))
        : [],
      intervieweeName: normalizedUploadItem.intervieweeName ?? '',
      intervieweeRole: normalizedUploadItem.intervieweeRole ?? '',
      interviewDate: normalizedUploadItem.interviewDate ?? '',
      confidence: normalizedUploadItem.confidence ?? 'low',
      classification_confidence:
        normalizedUploadItem.classification_confidence ?? normalizedUploadItem.classificationConfidence ?? null,
      processing_path: normalizedUploadItem.processing_path ?? normalizedUploadItem.processingPath ?? '',
      features_found: Array.isArray(normalizedUploadItem.features_found)
        ? normalizedUploadItem.features_found
        : Array.isArray(normalizedUploadItem.featuresFound)
          ? normalizedUploadItem.featuresFound
          : [],
      models_agree:
        typeof normalizedUploadItem.models_agree === 'boolean'
          ? normalizedUploadItem.models_agree
          : typeof normalizedUploadItem.modelsAgree === 'boolean'
            ? normalizedUploadItem.modelsAgree
            : null,
      classificationReason:
        normalizedUploadItem.classificationReason ?? normalizedUploadItem.classification_reason ?? '',
      classificationJustification:
        normalizedUploadItem.classificationJustification ?? normalizedUploadItem.classification_justification ?? '',
      reviewDecision: normalizedUploadItem.reviewDecision ?? '',
      addedOn: normalizedUploadItem.addedOn ?? '',
      summary: normalizedUploadItem.summary ?? '',
      updatedAt: now,
      createdAt: now
    },
    { merge: true }
  );

  await addDoc(collection(caseRef, 'history'), {
    timestampLabel,
    detail: `Document status updated: ${normalizedUploadItem.name ?? normalizedUploadItem.id} (${normalizedUploadItem.status ?? 'queued'})`,
    actor: actorName,
    actorUserId: user?.uid ?? null,
    createdAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'document_status_updated',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'upload',
    targetId: normalizedUploadItem.id,
    payload: { status: normalizedUploadItem.status ?? 'queued' },
    createdAt: now
  });
}

export async function persistConfirmAllUploads({ caseId, uploadItems = [], user }) {
  const confirmedItems = Array.isArray(uploadItems)
    ? uploadItems.filter((item) => (item?.classification ?? 'Unknown') !== 'Unknown')
    : [];

  if (confirmedItems.length === 0) return { confirmed_count: 0 };

  await Promise.all(
    confirmedItems.map((item) =>
      persistUploadItem({
        caseId,
        uploadItem: { ...item, status: 'verified' },
        user
      })
    )
  );

  return { confirmed_count: confirmedItems.length };
}

export async function persistGenerateFindingsEvent({ caseId, user }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId) return;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';
  const timestampLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  await addDoc(collection(caseRef, 'history'), {
    timestampLabel,
    detail: 'Generate findings triggered by inspector',
    actor: actorName,
    actorUserId: user?.uid ?? null,
    createdAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'generate_findings_requested',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'case',
    targetId: cleanCaseId,
    payload: {},
    createdAt: now
  });
}

export async function persistUploadItemDelete({ caseId, uploadId, user }) {
  const cleanCaseId = caseId?.trim();
  const cleanUploadId = String(uploadId || '').trim();
  if (!cleanCaseId || !cleanUploadId) return;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const uploadRef = doc(caseRef, 'uploads', cleanUploadId);
  const uploadSnap = await getDoc(uploadRef);
  const uploadData = uploadSnap.exists() ? uploadSnap.data() ?? {} : {};
  const uploadName = uploadData.filename ?? uploadData.name ?? cleanUploadId;
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';
  const timestampLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  await deleteDoc(uploadRef);

  await addDoc(collection(caseRef, 'history'), {
    timestampLabel,
    detail: `Document removed: ${uploadName}`,
    actor: actorName,
    actorUserId: user?.uid ?? null,
    createdAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'upload_deleted',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'upload',
    targetId: cleanUploadId,
    payload: { filename: uploadName },
    createdAt: now
  });
}

async function deleteCollectionContents(caseRef, collectionName) {
  const snapshot = await getDocs(collection(caseRef, collectionName));
  if (snapshot.empty) return 0;

  const batch = writeBatch(database);
  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  await batch.commit();
  return snapshot.size;
}

async function replaceCollectionContents(caseRef, collectionName, items, getDocumentId, toFirestoreData) {
  const snapshot = await getDocs(collection(caseRef, collectionName));
  if (snapshot.empty && items.length === 0) {
    return;
  }
  const batch = writeBatch(database);

  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  const now = serverTimestamp();
  items.forEach((item) => {
    const itemId = String(getDocumentId(item) || '').trim();
    if (!itemId) return;
    batch.set(
      doc(caseRef, collectionName, itemId),
      {
        ...toFirestoreData(item),
        createdAt: now,
        updatedAt: now
      },
      { merge: false }
    );
  });

  await batch.commit();
}

export async function persistGeneratedWorkspace({ caseId, workspace, user }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId) return { persisted: false };

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const findings = Array.isArray(workspace?.findings) ? workspace.findings : [];
  const documents = Array.isArray(workspace?.documents) ? workspace.documents : [];
  const requirements = Array.isArray(workspace?.requirements) ? workspace.requirements : [];

  await replaceCollectionContents(caseRef, 'documents', documents, (item) => item.id, toPersistedDocumentShape);
  await replaceCollectionContents(caseRef, 'findings', findings, (item) => item.id, toPersistedFindingShape);
  await replaceCollectionContents(
    caseRef,
    'requirements',
    requirements,
    (item) => `${item.codeArea}__${item.id}`,
    (item) => ({
      requirementId: item.id,
      codeArea: item.codeArea,
      label: item.label,
      status: item.status
    })
  );

  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';
  const timestampLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  await addDoc(collection(caseRef, 'history'), {
    timestampLabel,
    detail: `Generated ${findings.length} findings from ${documents.length} documents`,
    actor: actorName,
    actorUserId: user?.uid ?? null,
    createdAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'demo_workspace_generated',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'case',
    targetId: cleanCaseId,
    payload: {
      documentCount: documents.length,
      findingCount: findings.length,
      requirementCount: requirements.length
    },
    createdAt: now
  });

  const summary = buildCaseDashboardSummary({ findings, requirements });
  await setDoc(
    caseRef,
    {
      ...summary,
      updatedAt: now,
      lastActivityAt: now
    },
    { merge: true }
  );

  return {
    persisted: true,
    documentCount: documents.length,
    findingCount: findings.length,
    requirementCount: requirements.length
  };
}

export async function runSimulatedClassification({ caseId, uploadItems = [], user }) {
  const result = buildSimulatedClassifiedUploads(uploadItems);
  const cleanCaseId = String(caseId || '').trim();

  if (!cleanCaseId || result.changedUploads.length === 0) {
    return result;
  }

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  await Promise.all(
    result.uploadItems.map((uploadItem) =>
      persistUploadItem({
        caseId: cleanCaseId,
        uploadItem,
        user
      })
    )
  );
  await replaceCollectionContents(caseRef, 'documents', result.documents, (item) => item.id, toPersistedDocumentShape);
  await replaceCollectionContents(caseRef, 'findings', [], (item) => item.id, toPersistedFindingShape);
  await replaceCollectionContents(
    caseRef,
    'requirements',
    [],
    (item) => `${item.codeArea}__${item.id}`,
    (item) => ({
      requirementId: item.id,
      codeArea: item.codeArea,
      label: item.label,
      status: item.status
    })
  );
  await deleteCollectionContents(caseRef, 'reportActions');
  await deleteCollectionContents(caseRef, 'reportSections');
  await deleteDoc(doc(caseRef, 'report', 'current')).catch(() => null);

  const now = serverTimestamp();
  await setDoc(
    caseRef,
    {
      progress: 100,
      progressLabel: 'No requirements generated',
      unreviewed: 0,
      leads: 0,
      goodPractice: 0,
      updatedAt: now,
      lastActivityAt: now
    },
    { merge: true }
  );

  return result;
}

export async function runSimulatedFindingsGeneration({ caseId, uploadItems = [], user }) {
  const workspace = buildSimulatedFindingsWorkspace(uploadItems);
  const cleanCaseId = String(caseId || '').trim();

  if (cleanCaseId) {
    await persistGeneratedWorkspace({
      caseId: cleanCaseId,
      workspace,
      user
    });
  }

  return workspace;
}

export async function deleteCaseRecord({ caseId }) {
  const cleanCaseId = String(caseId || '').trim();
  if (!cleanCaseId) return { deleted: false };

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const subcollections = [
    'documents',
    'findings',
    'history',
    'contextNotes',
    'uploads',
    'findingNotes',
    'documentNotes',
    'requirements',
    'observations',
    'reportActions',
    'reportSections',
    'events',
    'report'
  ];

  for (const collectionName of subcollections) {
    await deleteCollectionContents(caseRef, collectionName);
  }

  await deleteDoc(caseRef);

  return { deleted: true, id: cleanCaseId };
}

export async function persistGenerateReport({ caseId, user }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId) return { triggered: false };

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';
  const timestampLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  await addDoc(collection(caseRef, 'history'), {
    timestampLabel,
    detail: 'Report regenerated from latest findings',
    actor: actorName,
    actorUserId: user?.uid ?? null,
    createdAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'report_regenerate_requested',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'case',
    targetId: cleanCaseId,
    payload: {},
    createdAt: now
  });

  return { triggered: true };
}
