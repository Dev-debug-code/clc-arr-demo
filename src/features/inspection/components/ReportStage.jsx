import ReportGeneratedContent from './ReportGeneratedContent.jsx';

export default function ReportStage({
  availableFindings,
  onGoToDocumentsTab,
  hasGeneratedReport,
  reportGenerationInProgress,
  reportGenerationMode,
  reportCanGenerate,
  reportReviewBlockedReason,
  reportPendingChanges,
  onGenerateReport,
  onOpenPendingChangesGate,
  reportStale,
  onOpenRegenerateConfirm,
  onExportReport,
  assetBase,
  reportDraftVersion,
  currentCaseMeta,
  reportInspectionType,
  editedReportSections,
  handleRevertReportSection,
  reportSectionDefaults,
  setReportEditableRef,
  handleReportSectionEdited,
  reportGoodPracticeFindings,
  safeText,
  formatCodeAreaLabel,
  formatReferenceText,
  normalizeCodeAreaId,
  reportAttentionFindings,
  buildEvidencePassages,
  handleJumpToEvidencePassage,
  reportActionDefaults,
  reportActionItems,
  setReportActionItems,
  upsertReportActionItem,
  deleteReportActionItem,
  reportCodeAreaSummaries,
  caseContextNotes,
  inspectorObservations,
  handleUpdateObservation,
  handleDeleteObservation,
  notAssessedAreas,
  reportAppendixRows,
  reportExportRef
}) {
  return (
    <div className="stage-card report-stage">
      {reportGenerationInProgress ? (
        <div className="edge-empty-card report-generation-card">
          <div className="spinner-sumplexity spinner-lg" aria-hidden="true" />
          <h3>{reportGenerationMode === 'regenerate' ? 'Regenerating report' : 'Generating report'}</h3>
          <p>
            Preparing the inspection report from the latest reviewed findings and action plan items.
          </p>
        </div>
      ) : availableFindings.length === 0 ? (
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon">📃</div>
          <h3>Generate findings from your documents first</h3>
          <p>
            The report will be assembled from your reviewed findings, presented in a format ready
            for the practice.
          </p>
          <a
            href="#"
            className="btn primary"
            onClick={(event) => {
              event.preventDefault();
              onGoToDocumentsTab();
            }}
          >
            Go to Documents tab
          </a>
          <p className="empty-state-list-title">What the report will include:</p>
          <ul className="empty-state-list compact">
            <li>Practice details and inspection context</li>
            <li>Summary of compliance posture</li>
            <li>Areas of good practice</li>
            <li>Areas requiring attention with actions</li>
            <li>Action plan with deadlines</li>
          </ul>
        </div>
      ) : !hasGeneratedReport ? (
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon">📋</div>
          <h3>Your findings are ready</h3>
          <p>
            The report will be assembled from your reviewed findings, including action plan items
            for accepted non-compliant findings (critical and guidance).
          </p>
          <button type="button" className="btn primary" onClick={onGenerateReport} disabled={!reportCanGenerate}>
            Generate report
          </button>
          {reportReviewBlockedReason ? <p className="empty-state-helper">{reportReviewBlockedReason}</p> : null}
        </div>
      ) : (
        <ReportGeneratedContent
          reportCanGenerate={reportCanGenerate}
          reportReviewBlockedReason={reportReviewBlockedReason}
          reportPendingChanges={reportPendingChanges}
          onOpenPendingChangesGate={onOpenPendingChangesGate}
          reportStale={reportStale}
          onOpenRegenerateConfirm={onOpenRegenerateConfirm}
          onExportReport={onExportReport}
          assetBase={assetBase}
          reportDraftVersion={reportDraftVersion}
          currentCaseMeta={currentCaseMeta}
          reportInspectionType={reportInspectionType}
          editedReportSections={editedReportSections}
          handleRevertReportSection={handleRevertReportSection}
          reportSectionDefaults={reportSectionDefaults}
          setReportEditableRef={setReportEditableRef}
          handleReportSectionEdited={handleReportSectionEdited}
          reportGoodPracticeFindings={reportGoodPracticeFindings}
          safeText={safeText}
          formatCodeAreaLabel={formatCodeAreaLabel}
          formatReferenceText={formatReferenceText}
          normalizeCodeAreaId={normalizeCodeAreaId}
          reportAttentionFindings={reportAttentionFindings}
          buildEvidencePassages={buildEvidencePassages}
          handleJumpToEvidencePassage={handleJumpToEvidencePassage}
          reportActionDefaults={reportActionDefaults}
          reportActionItems={reportActionItems}
          setReportActionItems={setReportActionItems}
          upsertReportActionItem={upsertReportActionItem}
          deleteReportActionItem={deleteReportActionItem}
          reportCodeAreaSummaries={reportCodeAreaSummaries}
          caseContextNotes={caseContextNotes}
          inspectorObservations={inspectorObservations}
          handleUpdateObservation={handleUpdateObservation}
          handleDeleteObservation={handleDeleteObservation}
          notAssessedAreas={notAssessedAreas}
          reportAppendixRows={reportAppendixRows}
          reportExportRef={reportExportRef}
        />
      )}
    </div>
  );
}
