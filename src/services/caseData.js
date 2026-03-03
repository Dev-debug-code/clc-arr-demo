import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { getFirebaseApp } from '../config/firebase.js';

const DATABASE_ID = 'clc-dev-db';
const ORGANIZATION_ID = 'clc-dev';

const database = getFirestore(getFirebaseApp(), DATABASE_ID);

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
  if (reviewStatus === 'accepted') return 'accepted';
  if (reviewStatus === 'rejected') return 'rejected';
  if (reviewStatus === 'dismissed') return 'dismissed';
  return null;
}

function decisionToStatus(decision) {
  if (decision === 'accepted') return 'accepted';
  if (decision === 'rejected') return 'rejected';
  if (decision === 'dismissed') return 'dismissed';
  return 'unreviewed';
}

function mapDocument(docSnap) {
  const data = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    label: data.label ?? data.classification ?? data.documentType ?? data.name ?? docSnap.id,
    filename: data.filename ?? data.name ?? docSnap.id,
    classification: data.classification ?? data.documentType ?? 'Unknown',
    parties: data.parties ?? 'Firm',
    confidence: data.confidence ?? 'medium',
    status: data.status ?? 'verified',
    summary: data.summary ?? '',
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
  return {
    id: docSnap.id,
    severity: data.severity ?? 'warning',
    title: data.title ?? 'Finding',
    detail: data.detail ?? '',
    documentId: data.documentId ?? '',
    boxId: data.boxId ?? docSnap.id,
    codeArea: data.codeArea ?? data.code_area ?? '',
    evidencePassages: Array.isArray(data.evidencePassages)
      ? data.evidencePassages
      : Array.isArray(data.evidence_passages)
        ? data.evidence_passages
        : [],
    source: typeof data.source === 'object' ? data.source : null,
    reference: data.reference ?? data.codeReference ?? ''
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
  if (normalized.includes('complaint')) return 'complaints';
  if (normalized.includes('client care') || normalized.includes('engagement')) return 'client-care';
  if (normalized.includes('account') || normalized.includes('reconciliation')) return 'accounts';
  if (normalized.includes('management') || normalized.includes('supervision')) return 'management';
  if (normalized.includes('undertaking')) return 'undertakings';
  return normalized.replace(/\s+/g, '-');
}

function mapRequirement(docSnap) {
  const data = docSnap.data() ?? {};
  const status = String(data.status ?? 'lead').toLowerCase();
  const safeStatus = ['compliant', 'non_compliant', 'lead'].includes(status) ? status : 'lead';
  const codeAreaId = normalizeCodeAreaId(data.codeArea ?? data.code_area ?? '');
  return {
    id: data.requirementId ?? docSnap.id,
    codeAreaId,
    label: data.label ?? data.title ?? data.requirement ?? docSnap.id,
    status: safeStatus
  };
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
    requirementsSnap
  ] = await Promise.all([
    getDocs(collection(caseRef, 'documents')),
    getDocs(collection(caseRef, 'findings')),
    getDocs(collection(caseRef, 'history')),
    getDocs(collection(caseRef, 'contextNotes')),
    getDocs(collection(caseRef, 'uploads')),
    getDocs(collection(caseRef, 'findingNotes')),
    getDocs(collection(caseRef, 'documentNotes')),
    getDocs(collection(caseRef, 'requirements'))
  ]);

  const documents = documentsSnap.docs.map(mapDocument);
  const findings = findingsSnap.docs.map(mapFinding);

  const findingDecisions = {};
  findingsSnap.docs.forEach((entry) => {
    const reviewStatus = entry.data()?.reviewStatus;
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
      return {
        id: entry.id,
        name: data.name ?? data.filename ?? entry.id,
        status: data.status ?? 'queued',
        classification: data.classification ?? 'Unknown',
        parties: data.parties ?? 'Firm',
        confidence: data.confidence ?? 'low',
        summary: data.summary ?? ''
      };
    })
    .sort((a, b) => {
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });

  const requirementsByCodeArea = {};
  requirementsSnap.docs.forEach((entry) => {
    const mapped = mapRequirement(entry);
    if (!mapped.codeAreaId) return;
    if (!requirementsByCodeArea[mapped.codeAreaId]) {
      requirementsByCodeArea[mapped.codeAreaId] = [];
    }
    requirementsByCodeArea[mapped.codeAreaId].push({
      id: mapped.id,
      label: mapped.label,
      status: mapped.status
    });
  });

  Object.keys(requirementsByCodeArea).forEach((key) => {
    requirementsByCodeArea[key].sort((a, b) => a.label.localeCompare(b.label));
  });

  return {
    caseExists: caseDocSnap.exists(),
    caseMetaPatch: {
      practiceName: caseData.practiceName,
      caseId: caseData.caseId ?? cleanCaseId,
      owner: caseData.owner ?? caseData.inspector,
      started: caseData.started,
      riskLevel: caseData.riskLevel,
      previousInspection: caseData.previousInspection,
      holp: caseData.holp,
      hofa: caseData.hofa
    },
    documents,
    findings,
    findingDecisions,
    findingNotes,
    documentNotes,
    uploadItems,
    requirementsByCodeArea,
    caseContextNotes,
    historyItems
  };
}

function mapCase(docSnap) {
  const data = docSnap.data() ?? {};
  const rawOutcome = typeof data.outcome === 'string' ? data.outcome : '';
  const normalizedOutcome = rawOutcome.trim().toLowerCase().replace(/\s+/g, '_');
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
    progress: typeof data.progress === 'number' ? data.progress : 0,
    progressLabel: data.progressLabel ?? '0/0 requirements met',
    unreviewed: typeof data.unreviewed === 'number' ? data.unreviewed : 0,
    leads: typeof data.leads === 'number' ? data.leads : 0,
    goodPractice: typeof data.goodPractice === 'number' ? data.goodPractice : 0,
    risk: data.riskLevel ?? 'Not assessed',
    lastActivity: data.lastActivity ?? '',
    inspector: data.inspector ?? data.owner ?? '',
    status: data.status ?? 'active',
    outcome: inferredOutcome
  };
}

export async function listCases() {
  const casesRef = collection(database, 'organizations', ORGANIZATION_ID, 'cases');
  const snapshot = await getDocs(casesRef);
  return snapshot.docs.map(mapCase);
}

export async function createCaseRecord({
  caseId,
  practiceName,
  owner,
  riskLevel,
  previousInspection,
  holp,
  hofa,
  user
}) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId) {
    throw new Error('Missing caseId');
  }
  const now = serverTimestamp();
  const startedDate = new Date().toLocaleDateString();
  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);

  await setDoc(
    caseRef,
    {
      caseId: cleanCaseId,
      licenceNumber: cleanCaseId,
      practiceName: practiceName?.trim() || 'Unnamed practice',
      owner: owner ?? user?.email ?? 'Inspector',
      inspector: owner ?? user?.email ?? 'Inspector',
      status: 'active',
      outcome: 'in_progress',
      riskLevel: riskLevel ?? 'Not assessed',
      started: startedDate,
      previousInspection: previousInspection || 'N/A',
      holp: holp ?? '',
      hofa: hofa ?? '',
      progress: 0,
      progressLabel: '0/0 requirements met',
      unreviewed: 0,
      leads: 0,
      goodPractice: 0,
      lastActivity: 'Just now',
      createdByUserId: user?.uid ?? null,
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
}

export async function persistFindingDecision({ caseId, findingId, decision, user }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId || !findingId) return;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const findingRef = doc(caseRef, 'findings', findingId);
  const now = serverTimestamp();

  await setDoc(
    findingRef,
    {
      reviewStatus: decisionToStatus(decision),
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
    payload: { decision: decision ?? 'cleared' },
    createdAt: now
  });
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

export async function persistUploadItem({ caseId, uploadItem, user }) {
  const cleanCaseId = caseId?.trim();
  if (!cleanCaseId || !uploadItem?.id) return;

  const caseRef = doc(database, 'organizations', ORGANIZATION_ID, 'cases', cleanCaseId);
  const uploadRef = doc(caseRef, 'uploads', uploadItem.id);
  const now = serverTimestamp();
  const actorName = user?.email ?? 'Inspector';
  const timestampLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  await setDoc(
    uploadRef,
    {
      name: uploadItem.name ?? uploadItem.filename ?? uploadItem.id,
      filename: uploadItem.filename ?? uploadItem.name ?? uploadItem.id,
      status: uploadItem.status ?? 'queued',
      classification: uploadItem.classification ?? 'Unknown',
      parties: uploadItem.parties ?? 'Firm',
      confidence: uploadItem.confidence ?? 'low',
      summary: uploadItem.summary ?? '',
      updatedAt: now,
      createdAt: now
    },
    { merge: true }
  );

  await addDoc(collection(caseRef, 'history'), {
    timestampLabel,
    detail: `Document status updated: ${uploadItem.name ?? uploadItem.id} (${uploadItem.status ?? 'queued'})`,
    actor: actorName,
    actorUserId: user?.uid ?? null,
    createdAt: now
  });

  await addDoc(collection(caseRef, 'events'), {
    eventType: 'document_status_updated',
    actorUserId: user?.uid ?? null,
    actorName,
    targetType: 'upload',
    targetId: uploadItem.id,
    payload: { status: uploadItem.status ?? 'queued' },
    createdAt: now
  });
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
