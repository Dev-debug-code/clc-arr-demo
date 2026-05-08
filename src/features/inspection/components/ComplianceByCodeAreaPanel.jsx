import ComplianceCodeAreaSection from './ComplianceCodeAreaSection.jsx';
import NotAssessedAreasPanel from './NotAssessedAreasPanel.jsx';
import { isRequirementExcluded, isRequirementMet } from '../helpers.js';

export default function ComplianceByCodeAreaPanel({
  openComposerModal,
  complianceCodeAreas,
  requirementsByCodeArea,
  availableFindings,
  findingMatchesCodeArea,
  getFindingBucketId,
  expandedCodeAreaIds,
  setExpandedCodeAreaIds,
  filteredFindings,
  overviewRequirementFilter,
  setOverviewRequirementFilter,
  overviewFilterRef,
  findingViewFilters,
  setOverviewFilterOpen,
  overviewFilterOpen,
  findingFilterLabelMap,
  toggleFindingViewFilter,
  clearFindingViewFilters,
  findingDecisions,
  expandedOverviewFindingIds,
  setExpandedOverviewFindingIds,
  findingSeverityBadgeMap,
  findingEvidenceStrengthMap,
  isLeadFindingByTaxonomy,
  isInspectorAddedFinding,
  buildEvidencePassages,
  safeText,
  formatReferenceText,
  activeMenuFindingId,
  setActiveMenuFindingId,
  findingMenuRef,
  handleRequestFindingDecision,
  handleDeleteFinding,
  handleJumpToRequirement,
  handleViewDocument,
  openLeadConfirmModal,
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
  setInlineDismissFindingId,
  leadConfirmOpen,
  leadConfirmFindingId,
  leadConfirmOriginStep,
  closeLeadConfirmModal,
  launchLeadEvidenceHighlighter,
  notAssessedExpanded,
  setNotAssessedExpanded,
  notApplicableExpanded,
  setNotApplicableExpanded,
  notAssessedAreas,
  notApplicableAreas,
  handleRestoreNotAssessedArea
}) {
  return (
    <section className="panel compliance-code-area-panel">
      <div className="section-heading">
        <h2>Findings by Code Area</h2>
        <button type="button" className="btn btn-xs secondary" onClick={() => openComposerModal('observation')}>
          + Add observation
        </button>
      </div>
      <div className="code-area-list">
        {[...complianceCodeAreas]
          .sort((left, right) => {
            const summarize = (areaId) => {
              const requirementRows = requirementsByCodeArea[areaId] ?? [];
              const areaFindings = availableFindings.filter((finding) => findingMatchesCodeArea(finding, areaId));
              const activeFindings = areaFindings.filter((finding) => {
                const reviewState = findingDecisions[finding.id] ?? 'unreviewed';
                return reviewState !== 'rejected' && reviewState !== 'dismissed';
              });
              const attentionCount = activeFindings.filter((entry) => getFindingBucketId(entry) === 'critical').length;
              const leadCount = activeFindings.filter((entry) => getFindingBucketId(entry) === 'warning').length;
              const pendingReviewCount = areaFindings.filter(
                (finding) => (findingDecisions[finding.id] ?? 'unreviewed') === 'unreviewed'
              ).length;
              const assessableRequirements = requirementRows.filter((entry) => !isRequirementExcluded(entry.status));
              const metRequirements = assessableRequirements.filter((entry) => isRequirementMet(entry.status)).length;
              return {
                attentionCount,
                leadCount,
                pendingReviewCount,
                metRequirements,
                totalRequirements: assessableRequirements.length
              };
            };
            const leftStats = summarize(left.id);
            const rightStats = summarize(right.id);
            const leftWeight = leftStats.attentionCount * 100 + leftStats.leadCount * 10 + leftStats.pendingReviewCount;
            const rightWeight = rightStats.attentionCount * 100 + rightStats.leadCount * 10 + rightStats.pendingReviewCount;
            if (rightWeight !== leftWeight) return rightWeight - leftWeight;
            const leftCompliant =
              leftStats.attentionCount === 0 &&
              leftStats.leadCount === 0 &&
              (leftStats.totalRequirements === 0 || leftStats.metRequirements === leftStats.totalRequirements);
            const rightCompliant =
              rightStats.attentionCount === 0 &&
              rightStats.leadCount === 0 &&
              (rightStats.totalRequirements === 0 || rightStats.metRequirements === rightStats.totalRequirements);
            if (leftCompliant !== rightCompliant) return leftCompliant ? 1 : -1;
            return left.name.localeCompare(right.name);
          })
          .map((area) => (
            <ComplianceCodeAreaSection
              key={area.id}
              area={area}
              requirementsByCodeArea={requirementsByCodeArea}
              availableFindings={availableFindings}
              filteredFindings={filteredFindings}
              findingMatchesCodeArea={findingMatchesCodeArea}
              getFindingBucketId={getFindingBucketId}
              expandedCodeAreaIds={expandedCodeAreaIds}
              setExpandedCodeAreaIds={setExpandedCodeAreaIds}
              overviewRequirementFilter={overviewRequirementFilter}
              setOverviewRequirementFilter={setOverviewRequirementFilter}
              overviewFilterRef={overviewFilterRef}
              findingViewFilters={findingViewFilters}
              setOverviewFilterOpen={setOverviewFilterOpen}
              overviewFilterOpen={overviewFilterOpen}
              findingFilterLabelMap={findingFilterLabelMap}
              toggleFindingViewFilter={toggleFindingViewFilter}
              clearFindingViewFilters={clearFindingViewFilters}
              findingDecisions={findingDecisions}
              expandedOverviewFindingIds={expandedOverviewFindingIds}
              setExpandedOverviewFindingIds={setExpandedOverviewFindingIds}
              findingSeverityBadgeMap={findingSeverityBadgeMap}
              findingEvidenceStrengthMap={findingEvidenceStrengthMap}
              isLeadFindingByTaxonomy={isLeadFindingByTaxonomy}
              isInspectorAddedFinding={isInspectorAddedFinding}
              buildEvidencePassages={buildEvidencePassages}
              safeText={safeText}
              formatReferenceText={formatReferenceText}
              activeMenuFindingId={activeMenuFindingId}
              setActiveMenuFindingId={setActiveMenuFindingId}
              findingMenuRef={findingMenuRef}
              handleRequestFindingDecision={handleRequestFindingDecision}
              handleDeleteFinding={handleDeleteFinding}
              handleJumpToRequirement={handleJumpToRequirement}
              handleViewDocument={handleViewDocument}
              openLeadConfirmModal={openLeadConfirmModal}
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
              leadConfirmOpen={leadConfirmOpen}
              leadConfirmFindingId={leadConfirmFindingId}
              leadConfirmOriginStep={leadConfirmOriginStep}
              closeLeadConfirmModal={closeLeadConfirmModal}
              launchLeadEvidenceHighlighter={launchLeadEvidenceHighlighter}
              openComposerModal={openComposerModal}
            />
          ))}
        <NotAssessedAreasPanel
          expanded={notAssessedExpanded}
          setExpanded={setNotAssessedExpanded}
          entries={notAssessedAreas}
          title="Not Assessed"
          emptyText="No code areas skipped by the inspector."
          subtitle="Excluded from this inspection"
          actionLabel="Restore to assessment"
          onAction={handleRestoreNotAssessedArea}
        />
        <NotAssessedAreasPanel
          expanded={notApplicableExpanded}
          setExpanded={setNotApplicableExpanded}
          entries={notApplicableAreas}
          title="Not Applicable"
          emptyText="No requirements marked as not applicable."
          subtitle="Excluded from this case"
        />
      </div>
    </section>
  );
}
