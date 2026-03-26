import { STEP_DOCUMENTS, STEP_OVERVIEW } from '../config.js';
import ViewerDocumentPanel from './ViewerDocumentPanel.jsx';
import ViewerFindingsPanel from './ViewerFindingsPanel.jsx';

export default function ViewerStage({
  caseDocuments,
  setCurrentStep,
  viewerOriginStep,
  activeViewerFinding,
  activeViewerFindingDocumentIds,
  viewerDocumentSequence,
  viewerDocumentIndex,
  filteredFindings,
  findingReferencesDocument,
  activeDocId,
  viewerCodeAreaFilter,
  findingMatchesCodeArea,
  availableFindings,
  isViewerFocusMode,
  setIsViewerFocusMode,
  docViewerRef,
  viewerSelectionHistory,
  handleViewerBack,
  activeDocument,
  safeText,
  handleClearViewerFindingFocus,
  handleCycleDocument,
  docPulse,
  handleSelectDocTab,
  showDocBoxes,
  setShowDocBoxes,
  activeDocBoxes,
  activeDocBoxId,
  handleSelectDocBox,
  docPdfScrollRef,
  docFocusSignal,
  activeDocMinimapMarkers,
  setDocLevelNoteOpen,
  docCrossSearchOpen,
  setDocCrossSearchOpen,
  setFeedbackOpen,
  docLevelNoteOpen,
  docLevelNoteDraft,
  setDocLevelNoteDraft,
  handleSaveDocumentNote,
  documentNotes,
  docSearchScope,
  setDocSearchScope,
  docSearchQuery,
  isProviderSearchLoading,
  filteredInDocumentResults,
  filteredCrossDocResults,
  documentsById,
  formatSourceDocumentRef,
  handleViewDocument,
  handleOpenAddNote,
  getFindingPreferredBoxIdForDocument,
  severityFilterRef,
  filterSeverity,
  setSeverityFilterOpen,
  severityFilterOpen,
  severityCounts,
  severityLabelMap,
  handleToggleFilter,
  setFilterSeverity,
  viewerTypeFilterRef,
  findingViewFilter,
  setViewerTypeFilterOpen,
  viewerTypeFilterOpen,
  findingFilterLabelMap,
  setFindingViewFilter,
  viewerCodeAreaFilterRef,
  setViewerCodeAreaFilter,
  setViewerCodeAreaFilterOpen,
  viewerCodeAreaFilterOpen,
  activeSeverityLabels,
  getFindingBucketId,
  activeFindingId,
  setActiveFindingId,
  expandedViewerFindingIds,
  setExpandedViewerFindingIds,
  findingDecisions,
  findingNotes,
  isLeadFindingByTaxonomy,
  isInspectorAddedFinding,
  findingSeverityBadgeMap,
  findingEvidenceStrengthMap,
  buildEvidencePassages,
  findingRefs,
  currentCaseMeta,
  activeMenuFindingId,
  setActiveMenuFindingId,
  findingMenuRef,
  handleRequestFindingDecision,
  setDeleteFindingTargetId,
  formatReferenceText,
  openLeadConfirmModal,
  noteTargetFindingId,
  noteDraft,
  setNoteDraft,
  setNoteTargetFindingId,
  handleSaveFindingNote,
  inlineRejectFindingId,
  inlineRejectReason,
  setInlineRejectReason,
  inlineRejectNote,
  setInlineRejectNote,
  handleConfirmInlineReject,
  setInlineRejectFindingId,
  inlineDismissFindingId,
  inlineDismissReason,
  setInlineDismissReason,
  inlineDismissNote,
  setInlineDismissNote,
  handleConfirmInlineDismiss,
  setInlineDismissFindingId
}) {
  if (caseDocuments.length === 0) {
    return (
      <div className="stage-card doc-viewer-stage">
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon">📄</div>
          <h3>No documents available yet</h3>
          <p>Upload and verify at least one document before opening the document viewer.</p>
          <div className="action-row">
            <button type="button" className="btn btn-sm secondary" onClick={() => setCurrentStep(STEP_DOCUMENTS)}>
              ← Back to Documents
            </button>
          </div>
        </div>
      </div>
    );
  }

  const viewerBackStep = viewerOriginStep === STEP_DOCUMENTS ? STEP_DOCUMENTS : STEP_OVERVIEW;
  const viewerBackLabel = viewerOriginStep === STEP_DOCUMENTS ? 'Documents' : 'Overview';
  const viewerHasFindingFocus = Boolean(activeViewerFinding && activeViewerFindingDocumentIds.length > 0);
  const viewerDocumentCount = Math.max(viewerDocumentSequence.length, 1);
  const viewerDocumentPosition = viewerDocumentIndex >= 0 ? viewerDocumentIndex + 1 : 1;
  const findingsForActiveDocument = filteredFindings.filter((finding) => {
    if (!findingReferencesDocument(finding, activeDocId)) return false;
    if (viewerCodeAreaFilter === 'all') return true;
    return findingMatchesCodeArea(finding, viewerCodeAreaFilter);
  });
  const totalFindingsForActiveDocument = availableFindings.filter((finding) =>
    findingReferencesDocument(finding, activeDocId)
  ).length;
  const hiddenForActiveDocument = Math.max(totalFindingsForActiveDocument - findingsForActiveDocument.length, 0);

  return (
    <div className="stage-card doc-viewer-stage">
      <div className={`split-view findings-view ${isViewerFocusMode ? 'viewer-focus' : ''}`}>
        <ViewerDocumentPanel
          docViewerRef={docViewerRef}
          setCurrentStep={setCurrentStep}
          viewerBackStep={viewerBackStep}
          viewerBackLabel={viewerBackLabel}
          viewerSelectionHistory={viewerSelectionHistory}
          handleViewerBack={handleViewerBack}
          activeDocument={activeDocument}
          activeViewerFinding={activeViewerFinding}
          safeText={safeText}
          viewerHasFindingFocus={viewerHasFindingFocus}
          viewerDocumentPosition={viewerDocumentPosition}
          viewerDocumentCount={viewerDocumentCount}
          handleClearViewerFindingFocus={handleClearViewerFindingFocus}
          handleCycleDocument={handleCycleDocument}
          viewerDocumentSequence={viewerDocumentSequence}
          activeDocId={activeDocId}
          docPulse={docPulse}
          handleSelectDocTab={handleSelectDocTab}
          isViewerFocusMode={isViewerFocusMode}
          setIsViewerFocusMode={setIsViewerFocusMode}
          showDocBoxes={showDocBoxes}
          setShowDocBoxes={setShowDocBoxes}
          activeDocBoxes={activeDocBoxes}
          activeDocBoxId={activeDocBoxId}
          handleSelectDocBox={handleSelectDocBox}
          docPdfScrollRef={docPdfScrollRef}
          docFocusSignal={docFocusSignal}
          activeDocMinimapMarkers={activeDocMinimapMarkers}
          setDocLevelNoteOpen={setDocLevelNoteOpen}
          docCrossSearchOpen={docCrossSearchOpen}
          setDocCrossSearchOpen={setDocCrossSearchOpen}
          setFeedbackOpen={setFeedbackOpen}
          docLevelNoteOpen={docLevelNoteOpen}
          docLevelNoteDraft={docLevelNoteDraft}
          setDocLevelNoteDraft={setDocLevelNoteDraft}
          handleSaveDocumentNote={handleSaveDocumentNote}
          documentNotes={documentNotes}
          docSearchScope={docSearchScope}
          setDocSearchScope={setDocSearchScope}
          docSearchQuery={docSearchQuery}
          isProviderSearchLoading={isProviderSearchLoading}
          filteredInDocumentResults={filteredInDocumentResults}
          filteredCrossDocResults={filteredCrossDocResults}
          findingReferencesDocument={findingReferencesDocument}
          getFindingPreferredBoxIdForDocument={getFindingPreferredBoxIdForDocument}
          documentsById={documentsById}
          formatSourceDocumentRef={formatSourceDocumentRef}
          handleViewDocument={handleViewDocument}
          handleOpenAddNote={handleOpenAddNote}
        />
        <ViewerFindingsPanel
          findingsForActiveDocument={findingsForActiveDocument}
          totalFindingsForActiveDocument={totalFindingsForActiveDocument}
          severityFilterRef={severityFilterRef}
          filterSeverity={filterSeverity}
          setSeverityFilterOpen={setSeverityFilterOpen}
          severityFilterOpen={severityFilterOpen}
          severityCounts={severityCounts}
          severityLabelMap={severityLabelMap}
          handleToggleFilter={handleToggleFilter}
          setFilterSeverity={setFilterSeverity}
          viewerTypeFilterRef={viewerTypeFilterRef}
          findingViewFilter={findingViewFilter}
          setViewerTypeFilterOpen={setViewerTypeFilterOpen}
          viewerTypeFilterOpen={viewerTypeFilterOpen}
          findingFilterLabelMap={findingFilterLabelMap}
          setFindingViewFilter={setFindingViewFilter}
          viewerCodeAreaFilterRef={viewerCodeAreaFilterRef}
          viewerCodeAreaFilter={viewerCodeAreaFilter}
          setViewerCodeAreaFilterOpen={setViewerCodeAreaFilterOpen}
          viewerCodeAreaFilterOpen={viewerCodeAreaFilterOpen}
          setViewerCodeAreaFilter={setViewerCodeAreaFilter}
          activeSeverityLabels={activeSeverityLabels}
          hiddenForActiveDocument={hiddenForActiveDocument}
          documentsById={documentsById}
          getFindingBucketId={getFindingBucketId}
          activeFindingId={activeFindingId}
          setActiveFindingId={setActiveFindingId}
          expandedViewerFindingIds={expandedViewerFindingIds}
          setExpandedViewerFindingIds={setExpandedViewerFindingIds}
          findingDecisions={findingDecisions}
          findingNotes={findingNotes}
          isLeadFindingByTaxonomy={isLeadFindingByTaxonomy}
          isInspectorAddedFinding={isInspectorAddedFinding}
          findingSeverityBadgeMap={findingSeverityBadgeMap}
          findingEvidenceStrengthMap={findingEvidenceStrengthMap}
          buildEvidencePassages={buildEvidencePassages}
          findingRefs={findingRefs}
          currentCaseMeta={currentCaseMeta}
          activeMenuFindingId={activeMenuFindingId}
          setActiveMenuFindingId={setActiveMenuFindingId}
          findingMenuRef={findingMenuRef}
          handleRequestFindingDecision={handleRequestFindingDecision}
          handleOpenAddNote={handleOpenAddNote}
          setDeleteFindingTargetId={setDeleteFindingTargetId}
          formatReferenceText={formatReferenceText}
          openLeadConfirmModal={openLeadConfirmModal}
          noteTargetFindingId={noteTargetFindingId}
          noteDraft={noteDraft}
          setNoteDraft={setNoteDraft}
          setNoteTargetFindingId={setNoteTargetFindingId}
          handleSaveFindingNote={handleSaveFindingNote}
          inlineRejectFindingId={inlineRejectFindingId}
          inlineRejectReason={inlineRejectReason}
          setInlineRejectReason={setInlineRejectReason}
          inlineRejectNote={inlineRejectNote}
          setInlineRejectNote={setInlineRejectNote}
          handleConfirmInlineReject={handleConfirmInlineReject}
          setInlineRejectFindingId={setInlineRejectFindingId}
          inlineDismissFindingId={inlineDismissFindingId}
          inlineDismissReason={inlineDismissReason}
          setInlineDismissReason={setInlineDismissReason}
          inlineDismissNote={inlineDismissNote}
          setInlineDismissNote={setInlineDismissNote}
          handleConfirmInlineDismiss={handleConfirmInlineDismiss}
          setInlineDismissFindingId={setInlineDismissFindingId}
          safeText={safeText}
          findingReferencesDocument={findingReferencesDocument}
          activeDocId={activeDocId}
          getFindingPreferredBoxIdForDocument={getFindingPreferredBoxIdForDocument}
          handleSelectDocBox={handleSelectDocBox}
          handleViewDocument={handleViewDocument}
        />
      </div>
    </div>
  );
}
