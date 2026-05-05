import DocumentsIntakePhase from './DocumentsIntakePhase.jsx';
import DocumentsUploadPhase from './DocumentsUploadPhase.jsx';

export default function DocumentsStage({
  documentsUploadInputRef,
  handleUploadFileSelection,
  documentPhaseOptions,
  documentsPhase,
  setDocumentsPhase,
  uploadAreaCollapsed,
  setUploadAreaCollapsed,
  openDocumentsFilePicker,
  handleUploadDrop,
  uploadItems,
  handleRemoveUploadItem,
  prepareUploadDraft,
  formatUploadClassificationLabel,
  isUploadClassificationResolved,
  isUploadReadyForConfirmation,
  expandedUploadSummaryId,
  setExpandedUploadSummaryId,
  buildUploadLookupKeys,
  buildFilenameKeySet,
  documentRows,
  textOf,
  normalizeUploadInterviewees,
  isInterviewTranscriptUpload,
  isUploadLimitedAnalysis,
  hasIncompleteUploadInterviewees,
  uploadTableLastRowRef,
  activeClassificationMenu,
  setActiveClassificationMenu,
  documentClassificationGroups,
  documentClassificationOtherOption,
  handleUploadClassificationSelect,
  handleUploadClassificationDetailChange,
  handleViewDocument,
  stepDocuments,
  currentCaseMeta,
  toIsoDate,
  formatShortDisplayDate,
  toDateInputValue,
  handleUpdateUploadInterviewee,
  handleRemoveUploadInterviewee,
  handleAddUploadInterviewee,
  handleUploadFieldChange,
  handleToggleUploadConfirmed,
  renderConfidenceDots,
  unclassifiedUploadCount,
  lowConfidenceUploadCount,
  incompleteInterviewUploadCount,
  limitedAnalysisUploadCount,
  verifiedUploadCount,
  unverifiedUploadCount,
  confirmableUploadCount,
  hasViewedUploadTableEnd,
  allUploadsVerified,
  handleConfirmAllUploads,
  handleGenerateFindings,
  handleRunClassification,
  handleRerunClassification,
  processingLog
}) {
  const resolveConfidenceState = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'high') return 'verified';
    if (normalized === 'medium') return 'reviewing';
    return 'attention';
  };

  const resolveLinkedDocumentId = (uploadItem) => {
    const uploadKeys = buildUploadLookupKeys(uploadItem);
    if (uploadKeys.size === 0) return '';
    const linked = documentRows.find((row) =>
      [...buildFilenameKeySet([row.id, row.filename, row.label])].some((key) => uploadKeys.has(key))
    );
    return linked?.id ?? '';
  };

  const processingEntries =
    processingLog.length > 0
      ? processingLog
      : [
          {
            id: 'p-empty',
            detail: 'No processing runs logged yet.',
            time: '--:--'
          }
        ];
  const reviewPhaseVisible =
    documentsPhase === 'review' ||
    uploadItems.some((item) => {
      const normalizedItem = prepareUploadDraft(item);
      return normalizedItem.status !== 'queued';
    });
  const visiblePhaseOptions = documentPhaseOptions.filter(
    (phase) => phase.id === 'intake' || reviewPhaseVisible
  );

  return (
    <div className="stage-card">
      <div className="docs-wireframe">
        <input
          ref={documentsUploadInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.bmp,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
          multiple
          className="visually-hidden"
          onChange={handleUploadFileSelection}
        />
        {visiblePhaseOptions.length > 1 ? (
          <div className="docs-wireframe-phase-switch" role="tablist" aria-label="Document workflow stages">
            {visiblePhaseOptions.map((phase) => (
              <button
                key={phase.id}
                type="button"
                role="tab"
                aria-selected={documentsPhase === phase.id}
                className={`docs-phase-tab${documentsPhase === phase.id ? ' active' : ''}`}
                onClick={() => setDocumentsPhase(phase.id)}
              >
                {phase.label}
              </button>
            ))}
          </div>
        ) : null}

        {documentsPhase === 'intake' ? (
          <DocumentsIntakePhase
            uploadAreaCollapsed={uploadAreaCollapsed}
            setUploadAreaCollapsed={setUploadAreaCollapsed}
            openDocumentsFilePicker={openDocumentsFilePicker}
            handleUploadDrop={handleUploadDrop}
            uploadItems={uploadItems}
            handleRemoveUploadItem={handleRemoveUploadItem}
            formatShortDisplayDate={formatShortDisplayDate}
            currentCaseMeta={currentCaseMeta}
            toIsoDate={toIsoDate}
            handleRunClassification={handleRunClassification}
          />
        ) : (
          <DocumentsUploadPhase
            setDocumentsPhase={setDocumentsPhase}
            openDocumentsFilePicker={openDocumentsFilePicker}
            handleRerunClassification={handleRerunClassification}
            uploadAreaCollapsed={uploadAreaCollapsed}
            setUploadAreaCollapsed={setUploadAreaCollapsed}
            handleUploadDrop={handleUploadDrop}
            uploadItems={uploadItems}
            prepareUploadDraft={prepareUploadDraft}
            formatUploadClassificationLabel={formatUploadClassificationLabel}
            isUploadClassificationResolved={isUploadClassificationResolved}
            isUploadReadyForConfirmation={isUploadReadyForConfirmation}
            expandedUploadSummaryId={expandedUploadSummaryId}
            setExpandedUploadSummaryId={setExpandedUploadSummaryId}
            resolveLinkedDocumentId={resolveLinkedDocumentId}
            textOf={textOf}
            normalizeUploadInterviewees={normalizeUploadInterviewees}
            isInterviewTranscriptUpload={isInterviewTranscriptUpload}
            isUploadLimitedAnalysis={isUploadLimitedAnalysis}
            hasIncompleteUploadInterviewees={hasIncompleteUploadInterviewees}
            uploadTableLastRowRef={uploadTableLastRowRef}
            activeClassificationMenu={activeClassificationMenu}
            setActiveClassificationMenu={setActiveClassificationMenu}
            documentClassificationGroups={documentClassificationGroups}
            documentClassificationOtherOption={documentClassificationOtherOption}
            handleUploadClassificationSelect={handleUploadClassificationSelect}
            handleUploadClassificationDetailChange={handleUploadClassificationDetailChange}
            handleViewDocument={handleViewDocument}
            stepDocuments={stepDocuments}
            currentCaseMeta={currentCaseMeta}
            toIsoDate={toIsoDate}
            formatShortDisplayDate={formatShortDisplayDate}
            toDateInputValue={toDateInputValue}
            handleUpdateUploadInterviewee={handleUpdateUploadInterviewee}
            handleRemoveUploadInterviewee={handleRemoveUploadInterviewee}
            handleAddUploadInterviewee={handleAddUploadInterviewee}
            handleUploadFieldChange={handleUploadFieldChange}
            handleToggleUploadConfirmed={handleToggleUploadConfirmed}
            renderConfidenceDots={renderConfidenceDots}
            resolveConfidenceState={resolveConfidenceState}
            unclassifiedUploadCount={unclassifiedUploadCount}
            lowConfidenceUploadCount={lowConfidenceUploadCount}
            incompleteInterviewUploadCount={incompleteInterviewUploadCount}
            limitedAnalysisUploadCount={limitedAnalysisUploadCount}
            verifiedUploadCount={verifiedUploadCount}
            unverifiedUploadCount={unverifiedUploadCount}
            confirmableUploadCount={confirmableUploadCount}
            hasViewedUploadTableEnd={hasViewedUploadTableEnd}
            allUploadsVerified={allUploadsVerified}
            handleConfirmAllUploads={handleConfirmAllUploads}
            handleGenerateFindings={handleGenerateFindings}
            processingEntries={processingEntries}
          />
        )}
      </div>
    </div>
  );
}
