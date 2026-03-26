import ReportGeneratedContent from './ReportGeneratedContent.jsx';

export default function ReportStage({
  availableFindings,
  onGoToDocumentsTab,
  hasGeneratedReport,
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
  reportAppendixRows
}) {
  return (
    <div className="stage-card report-stage">
      <p className="panel-subtitle">Review status and export inspection outputs.</p>
      {availableFindings.length === 0 ? (
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon">📃</div>
          <h3>Generate findings from your documents first</h3>
          <p>
            The report will be assembled from your reviewed findings, presented in a format ready
            for the practice.
          </p>
          <p className="empty-state-list-title">What the report will include:</p>
          <ul className="empty-state-list compact">
            <li>Practice details and inspection context</li>
            <li>Summary of compliance posture</li>
            <li>Areas of good practice</li>
            <li>Areas requiring attention and actions</li>
            <li>Action plan with deadlines</li>
          </ul>
          <button type="button" className="btn primary" onClick={onGoToDocumentsTab}>
            Go to Documents tab
          </button>
        </div>
      ) : !hasGeneratedReport ? (
        <div className="edge-empty-card">
          <div className="edge-empty-card__icon">📋</div>
          <h3>Your findings are ready. Generate your inspection report.</h3>
          <p>
            The report will be assembled from your reviewed findings, including action plan items
            for accepted non-compliant findings.
          </p>
          {reportPendingChanges ? (
            <p className="panel-subtitle">
              Unprocessed changes are pending. You can reprocess first or generate from the current
              findings.
            </p>
          ) : null}
          <button type="button" className="btn primary" onClick={onGenerateReport}>
            Generate report
          </button>
        </div>
      ) : (
        <ReportGeneratedContent
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
        />
      )}
    </div>
  );
}
