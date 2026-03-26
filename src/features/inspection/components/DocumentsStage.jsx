import DocumentsManagePhase from './DocumentsManagePhase.jsx';
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
  allUploadsVerified,
  handleConfirmAllUploads,
  handleGenerateFindings,
  documentsNotesExpanded,
  setDocumentsNotesExpanded,
  flattenedDocumentNotes,
  documentsLogExpanded,
  setDocumentsLogExpanded,
  processingLog,
  setDocumentWorkspaceTab
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

  return (
    <div className="stage-card">
      <div className="docs-wireframe">
        <input
          ref={documentsUploadInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="visually-hidden"
          onChange={handleUploadFileSelection}
        />
        <div className="docs-wireframe-phase-switch">
          {documentPhaseOptions.map((phase) => (
            <label key={phase.id} className="docs-phase-radio">
              <input
                type="radio"
                name="documents-phase"
                checked={documentsPhase === phase.id}
                onChange={() => setDocumentsPhase(phase.id)}
              />
              {phase.label}
            </label>
          ))}
        </div>

        {documentsPhase === 'upload' ? (
          <DocumentsUploadPhase
            uploadAreaCollapsed={uploadAreaCollapsed}
            setUploadAreaCollapsed={setUploadAreaCollapsed}
            openDocumentsFilePicker={openDocumentsFilePicker}
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
            allUploadsVerified={allUploadsVerified}
            handleConfirmAllUploads={handleConfirmAllUploads}
            handleGenerateFindings={handleGenerateFindings}
            processingEntries={processingEntries}
          />
        ) : (
          <DocumentsManagePhase
            documentRows={documentRows}
            expandedUploadSummaryId={expandedUploadSummaryId}
            setExpandedUploadSummaryId={setExpandedUploadSummaryId}
            handleViewDocument={handleViewDocument}
            stepDocuments={stepDocuments}
            setDocumentWorkspaceTab={setDocumentWorkspaceTab}
            documentsNotesExpanded={documentsNotesExpanded}
            setDocumentsNotesExpanded={setDocumentsNotesExpanded}
            flattenedDocumentNotes={flattenedDocumentNotes}
            documentsLogExpanded={documentsLogExpanded}
            setDocumentsLogExpanded={setDocumentsLogExpanded}
            processingEntries={processingEntries}
            setDocumentsPhase={setDocumentsPhase}
            openDocumentsFilePicker={openDocumentsFilePicker}
          />
        )}
      </div>
    </div>
  );
}
