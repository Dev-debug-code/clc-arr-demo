const normalizeText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
};

const BACKEND_PROCESSING_STATUSES = new Set([
  'uploaded',
  'classifying',
  'classified',
  'extracting',
  'extracted',
  'complete',
  'failed_classification',
  'failed_extraction',
  'failed_ocr',
  'failed',
  'failed_partial'
]);

const normalizeConfidenceLabel = (value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['low', 'medium', 'high'].includes(normalized)) return normalized;
    const numeric = Number(normalized);
    if (!Number.isNaN(numeric)) return normalizeConfidenceLabel(numeric);
    return '';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 0.9) return 'high';
    if (value >= 0.75) return 'medium';
    return 'low';
  }

  return '';
};

export const DOCUMENT_CLASSIFICATION_OTHER_OPTION = 'Other';

export const DOCUMENT_CLASSIFICATION_GROUPS = [
  {
    id: 'policy_document',
    label: 'Policy Document',
    options: ['AML Policy', 'Complaints Procedure']
  },
  {
    id: 'financial_record',
    label: 'Financial Record',
    options: ['Bank Statement', 'Giftor Source of Funds']
  },
  {
    id: 'compliance_record',
    label: 'Compliance Record',
    options: ['CDD Records', 'Training Register', 'Client Risk Assessment', 'Sanctions Screening', 'PEP Screening']
  },
  {
    id: 'client_matter_document',
    label: 'Client Matter Document',
    options: [
      'Fee Estimate',
      'Client Care Letter',
      'Source of Funds Declaration',
      'Source of Funds Schedule',
      'Identity Verification',
      'Proof of Address',
      'Gift Letter',
      'Giftor ID Verification'
    ]
  },
  {
    id: 'legal_correspondence',
    label: 'Legal Correspondence',
    options: ['Estate Distribution Letter', 'Lender Disclosure File Note']
  },
  {
    id: 'communications_and_interviews',
    label: 'Communications & Interviews',
    options: ['Interview Transcript']
  },
  {
    id: 'external_evidence',
    label: 'External Evidence',
    options: ['Website Evidence']
  }
];

const CLASSIFICATION_PRESETS = DOCUMENT_CLASSIFICATION_GROUPS.flatMap((group) =>
  group.options.map((option) => ({
    classification: option,
    l1: group.label,
    l2: option
  }))
);

const PRESET_BY_LABEL = new Map(
  CLASSIFICATION_PRESETS.map((entry) => [entry.classification.toLowerCase(), entry])
);

const GROUP_BY_LABEL = new Map(
  DOCUMENT_CLASSIFICATION_GROUPS.map((group) => [group.label.toLowerCase(), group])
);

const normalizeInterviewee = (entry, index) => {
  const name = normalizeText(entry?.name ?? entry?.intervieweeName);
  const role = normalizeText(entry?.role ?? entry?.intervieweeRole);
  const date = normalizeText(entry?.date ?? entry?.interviewDate);
  const contextNote = normalizeText(
    entry?.contextNote ??
      entry?.context_note ??
      entry?.intervieweeContext ??
      entry?.intervieweeContextNote
  );

  if (!name && !role && !date && !contextNote) return null;

  return {
    id: normalizeText(entry?.id) || `interviewee-${index + 1}`,
    name,
    role,
    date,
    contextNote
  };
};

export const createIntervieweeDraft = (idPrefix = 'interviewee') => ({
  id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  role: '',
  date: '',
  contextNote: ''
});

export const normalizeUploadInterviewees = (uploadItem) => {
  const rawEntries = Array.isArray(uploadItem?.interviewees)
    ? uploadItem.interviewees
    : Array.isArray(uploadItem?.interviewees_data)
      ? uploadItem.interviewees_data
      : [];

  const normalizedEntries = rawEntries
    .map((entry, index) => normalizeInterviewee(entry, index))
    .filter(Boolean);

  if (normalizedEntries.length > 0) {
    return normalizedEntries;
  }

  const fallback = normalizeInterviewee(
    {
      id: 'interviewee-1',
      name: uploadItem?.intervieweeName,
      role: uploadItem?.intervieweeRole,
      date: uploadItem?.interviewDate,
      contextNote:
        uploadItem?.intervieweeContext ??
        uploadItem?.intervieweeContextNote ??
        uploadItem?.interviewContextNote
    },
    0
  );

  return fallback ? [fallback] : [];
};

const resolveClassificationParts = (uploadItem) => {
  const rawClassification = normalizeText(uploadItem?.classification);
  let classificationL1 = normalizeText(
    uploadItem?.classificationL1 ?? uploadItem?.classification_l1
  );
  let classificationL2 = normalizeText(
    uploadItem?.classificationL2 ?? uploadItem?.classification_l2
  );
  let classificationDetail = normalizeText(
    uploadItem?.classificationDetail ?? uploadItem?.classification_detail
  );

  if (!classificationL1 && !classificationL2 && rawClassification && rawClassification.toLowerCase() !== 'unknown') {
    const preset = PRESET_BY_LABEL.get(rawClassification.toLowerCase());
    if (preset) {
      classificationL1 = preset.l1;
      classificationL2 = preset.l2;
    } else {
      const group = GROUP_BY_LABEL.get(rawClassification.toLowerCase());
      if (group) {
        classificationL1 = group.label;
        classificationL2 = DOCUMENT_CLASSIFICATION_OTHER_OPTION;
      }
    }
  }

  const explicitLimitedAnalysis =
    uploadItem?.limitedAnalysis === true || uploadItem?.limited_analysis === true;
  const isOtherCatchAll =
    Boolean(classificationL2) &&
    classificationL2.toLowerCase() === DOCUMENT_CLASSIFICATION_OTHER_OPTION.toLowerCase();
  const limitedAnalysis =
    explicitLimitedAnalysis ||
    (Boolean(classificationL1) && !classificationL2) ||
    (Boolean(classificationL1) && isOtherCatchAll && !classificationDetail);

  if (limitedAnalysis && classificationL1 && !classificationL2) {
    classificationL2 = DOCUMENT_CLASSIFICATION_OTHER_OPTION;
  }

  if (!classificationL1 && classificationL2) {
    const preset = PRESET_BY_LABEL.get(classificationL2.toLowerCase());
    if (preset) {
      classificationL1 = preset.l1;
      classificationL2 = preset.l2;
    }
  }

  if (!classificationDetail && limitedAnalysis && rawClassification && classificationL1 && rawClassification !== classificationL1) {
    const preset = PRESET_BY_LABEL.get(rawClassification.toLowerCase());
    if (!preset) {
      classificationDetail = rawClassification;
    }
  }

  return {
    rawClassification,
    classificationL1,
    classificationL2,
    classificationDetail,
    limitedAnalysis: Boolean(limitedAnalysis && classificationL1)
  };
};

export const formatUploadClassificationLabel = (uploadItem) => {
  const {
    rawClassification,
    classificationL1,
    classificationL2,
    classificationDetail
  } = resolveClassificationParts(uploadItem);

  if (classificationL2 && classificationL2.toLowerCase() !== DOCUMENT_CLASSIFICATION_OTHER_OPTION.toLowerCase()) {
    return classificationL2;
  }

  if (classificationL1) {
    if (classificationL2 && classificationL2.toLowerCase() === DOCUMENT_CLASSIFICATION_OTHER_OPTION.toLowerCase()) {
      return classificationL1;
    }
    if (classificationDetail) {
      return `${classificationL1} - ${classificationDetail}`;
    }
    return classificationL1;
  }

  return rawClassification || 'Unknown';
};

export const getUploadClassificationPersistenceValue = (uploadItem) => {
  const { classificationL1, classificationL2 } = resolveClassificationParts(uploadItem);
  if (classificationL2 && classificationL2.toLowerCase() !== DOCUMENT_CLASSIFICATION_OTHER_OPTION.toLowerCase()) {
    return classificationL2;
  }
  if (classificationL1) return classificationL1;

  const rawClassification = normalizeText(uploadItem?.classification);
  return rawClassification && rawClassification.toLowerCase() !== 'unknown' ? rawClassification : null;
};

export const getUploadProcessingStatusPersistenceValue = (uploadItem) => {
  const explicitProcessingStatus = normalizeText(
    uploadItem?.processingStatus ?? uploadItem?.processing_status
  ).toLowerCase();

  if (BACKEND_PROCESSING_STATUSES.has(explicitProcessingStatus)) {
    return explicitProcessingStatus;
  }

  const explicitStatus = normalizeText(uploadItem?.status).toLowerCase();
  if (BACKEND_PROCESSING_STATUSES.has(explicitStatus)) {
    return explicitStatus;
  }

  if (uploadItem?.confirmed === true || explicitStatus === 'verified') {
    return 'classified';
  }

  if (explicitStatus === 'classified') {
    return 'classified';
  }

  if (explicitStatus === 'removed') {
    return 'classified';
  }

  if (explicitStatus === 'queued') {
    return 'uploaded';
  }

  return '';
};

const mapProcessingStatusToWorkflowStatus = (processingStatus, classificationLabel) => {
  const normalizedStatus = normalizeText(processingStatus).toLowerCase();
  if (!normalizedStatus) return '';
  if (normalizedStatus === 'uploaded' || normalizedStatus === 'classifying') {
    return 'queued';
  }
  if (normalizedStatus === 'failed_classification') {
    return 'queued';
  }
  if (
    ['classified', 'extracting', 'extracted', 'complete', 'failed_extraction', 'failed_ocr', 'failed', 'failed_partial'].includes(
      normalizedStatus
    )
  ) {
    return classificationLabel !== 'Unknown' ? 'classified' : 'queued';
  }
  return '';
};

export const normalizeUploadDraft = (uploadItem) => {
  const safeUploadItem = uploadItem && typeof uploadItem === 'object' ? uploadItem : {};
  const interviewees = normalizeUploadInterviewees(safeUploadItem);
  const firstInterviewee = interviewees[0] ?? null;
  const classificationLabel = formatUploadClassificationLabel(safeUploadItem);
  const {
    classificationL1,
    classificationL2,
    classificationDetail,
    limitedAnalysis
  } = resolveClassificationParts(safeUploadItem);
  const processingStatus = getUploadProcessingStatusPersistenceValue(safeUploadItem);
  const confirmed = safeUploadItem?.confirmed === true || normalizeText(safeUploadItem?.status).toLowerCase() === 'verified';
  const explicitStatus = normalizeText(safeUploadItem?.status).toLowerCase();
  const explicitReviewDecision = normalizeText(
    safeUploadItem?.reviewDecision ??
      safeUploadItem?.review_decision ??
      safeUploadItem?.confirmRemove ??
      safeUploadItem?.confirm_remove
  ).toLowerCase();
  const reviewDecision =
    explicitReviewDecision === 'confirm' || explicitReviewDecision === 'remove'
      ? explicitReviewDecision
      : explicitStatus === 'removed'
        ? 'remove'
        : '';
  const mappedWorkflowStatus = mapProcessingStatusToWorkflowStatus(processingStatus, classificationLabel);
  const uiWorkflowStatus = ['queued', 'classified', 'verified', 'attention', 'removed'].includes(explicitStatus)
    ? explicitStatus
    : '';
  const persistedClassificationConfidence =
    safeUploadItem?.classification_confidence ?? safeUploadItem?.classificationConfidence ?? null;
  const uiConfidence = safeUploadItem?.confidence ?? null;
  const normalizedPersistedClassificationConfidence = normalizeConfidenceLabel(persistedClassificationConfidence);
  const normalizedUiConfidence = normalizeConfidenceLabel(uiConfidence);
  const processingPath = normalizeText(safeUploadItem?.processing_path ?? safeUploadItem?.processingPath);
  const featuresFound = Array.isArray(safeUploadItem?.features_found)
    ? safeUploadItem.features_found
    : Array.isArray(safeUploadItem?.featuresFound)
      ? safeUploadItem.featuresFound
      : [];
  const modelsAgree =
    typeof safeUploadItem?.models_agree === 'boolean'
      ? safeUploadItem.models_agree
      : typeof safeUploadItem?.modelsAgree === 'boolean'
        ? safeUploadItem.modelsAgree
        : null;
  const status = confirmed
    ? 'verified'
    : (mappedWorkflowStatus && (!uiWorkflowStatus || uiWorkflowStatus === 'queued'))
      ? mappedWorkflowStatus
      : uiWorkflowStatus || 'queued';
  const derivedConfidence =
    normalizedPersistedClassificationConfidence ||
    (
      normalizedUiConfidence &&
      (classificationLabel === 'Unknown' || limitedAnalysis || classificationL2 === DOCUMENT_CLASSIFICATION_OTHER_OPTION)
        ? normalizedUiConfidence
        :
        ''
    ) ||
    (classificationLabel === 'Unknown'
      ? 'low'
      : limitedAnalysis || classificationL2 === DOCUMENT_CLASSIFICATION_OTHER_OPTION
        ? 'low'
        : 'high');

  return {
    ...safeUploadItem,
    status,
    confirmed,
    processingStatus,
    processing_status: processingStatus,
    confidence: derivedConfidence,
    classificationConfidence: persistedClassificationConfidence,
    classification_confidence: persistedClassificationConfidence,
    classification: classificationLabel,
    classificationL1,
    classificationL2,
    classificationDetail,
    limitedAnalysis,
    processingPath,
    processing_path: processingPath,
    featuresFound,
    features_found: featuresFound,
    modelsAgree,
    models_agree: modelsAgree,
    interviewees,
    intervieweeName: firstInterviewee?.name ?? normalizeText(safeUploadItem?.intervieweeName),
    intervieweeRole: firstInterviewee?.role ?? normalizeText(safeUploadItem?.intervieweeRole),
    interviewDate: firstInterviewee?.date ?? normalizeText(safeUploadItem?.interviewDate),
    reviewDecision
  };
};

export const isUploadClassificationResolved = (uploadItem) =>
  formatUploadClassificationLabel(uploadItem) !== 'Unknown';

export const isUploadLimitedAnalysis = (uploadItem) =>
  normalizeUploadDraft(uploadItem).limitedAnalysis === true;

export const isInterviewTranscriptUpload = (uploadItem) => {
  const normalized = normalizeUploadDraft(uploadItem);
  return (
    normalized.classificationL2 === 'Interview Transcript' ||
    normalized.classification === 'Interview Transcript'
  );
};

export const hasIncompleteUploadInterviewees = (uploadItem) => {
  if (!isInterviewTranscriptUpload(uploadItem)) return false;

  const interviewees = normalizeUploadInterviewees(uploadItem);
  if (interviewees.length === 0) return true;

  return interviewees.some((entry) => !entry.name || !entry.role);
};

export const getUploadReviewDecision = (uploadItem) => {
  const normalized = normalizeUploadDraft(uploadItem);
  if (normalized.reviewDecision === 'confirm' || normalized.reviewDecision === 'remove') {
    return normalized.reviewDecision;
  }
  if (!isUploadClassificationResolved(normalized)) return '';
  if (hasIncompleteUploadInterviewees(normalized)) return '';
  const lowConfidenceFlag =
    normalized.confirmed !== true &&
    normalizeConfidenceLabel(normalized.confidence) === 'low';
  return lowConfidenceFlag ? '' : 'confirm';
};

export const isUploadIncludedInFindingsGeneration = (uploadItem) =>
  getUploadReviewDecision(uploadItem) === 'confirm' &&
  isUploadClassificationResolved(uploadItem) &&
  !hasIncompleteUploadInterviewees(uploadItem);
