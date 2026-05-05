export function toPersistedDocumentShape(documentRow) {
  return {
    label: documentRow.label ?? documentRow.classification ?? documentRow.filename ?? documentRow.id,
    name: documentRow.name ?? documentRow.filename ?? documentRow.id,
    filename: documentRow.filename ?? documentRow.name ?? documentRow.id,
    classification: documentRow.classification ?? 'Unknown',
    documentType: documentRow.classification ?? 'Unknown',
    parties: documentRow.parties ?? 'Firm',
    confidence: documentRow.confidence ?? 'low',
    classification_confidence:
      documentRow.classificationConfidence ?? documentRow.classification_confidence ?? null,
    processing_status: documentRow.processingStatus ?? documentRow.processing_status ?? null,
    status: documentRow.status ?? 'verified',
    confirmed: documentRow.confirmed === true || documentRow.status === 'verified',
    summary: documentRow.summary ?? '',
    severity: documentRow.severity ?? 'pass',
    findings: Array.isArray(documentRow.findings) ? documentRow.findings : [],
    overlayBoxes: Array.isArray(documentRow?.overlay?.boxes) ? documentRow.overlay.boxes : [],
    extracted_fields: documentRow.extractedFields ?? documentRow.extracted_fields ?? {},
    parties_found: documentRow.partiesFound ?? documentRow.parties_found ?? [],
    storagePath: null
  };
}

export function toPersistedFindingShape(finding) {
  const evidencePassages = Array.isArray(finding.evidencePassages)
    ? finding.evidencePassages
    : Array.isArray(finding.evidence_passages)
      ? finding.evidence_passages
      : [];
  const isGoodPractice = finding.isGoodPractice === true || finding.is_good_practice === true;

  return {
    severity: finding.severity ?? 'critical',
    certainty: finding.certainty ?? 'finding',
    polarity: finding.polarity ?? 'non_compliant',
    is_good_practice: isGoodPractice,
    isGoodPractice,
    codeArea: finding.codeArea ?? finding.code_area ?? 'aml',
    title: finding.title ?? 'Finding',
    detail: finding.detail ?? '',
    documentId: finding.documentId ?? '',
    boxId: finding.boxId ?? finding.id,
    source: finding.source ?? null,
    evidencePassages,
    evidence_passages: evidencePassages,
    reference: finding.reference ?? '',
    requirementId: finding.requirementId ?? finding.requirement_id ?? '',
    requirementSeverity: finding.requirementSeverity ?? finding.requirement_severity ?? 'critical',
    evidence_strength: finding.evidenceStrength ?? finding.evidence_strength ?? null,
    origin: finding.origin ?? 'frontend_demo',
    isInspectorAdded: finding.isInspectorAdded === true,
    reviewStatus: finding.reviewStatus ?? finding.review_status ?? 'unreviewed'
  };
}
