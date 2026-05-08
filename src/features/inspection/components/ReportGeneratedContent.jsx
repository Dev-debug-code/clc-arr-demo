import { Fragment, useRef } from 'react';

export default function ReportGeneratedContent({
  reportCanGenerate,
  reportReviewBlockedReason,
  reportPendingChanges,
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
  reportActionBaselineItems = [],
  reportActionItems = [],
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
  const practiceDetailRefs = useRef([]);
  const practiceDetailRows = [
    ['Practice', currentCaseMeta.practiceName],
    ['Licence', currentCaseMeta.caseId],
    ['Head of Legal Practice', currentCaseMeta.holp],
    ['Head of Finance & Admin', currentCaseMeta.hofa],
    ['Inspection type', reportInspectionType],
    ['Date', currentCaseMeta.started],
    ['Inspector', currentCaseMeta.owner]
  ];

  const handleRevertPracticeDetails = () => {
    practiceDetailRows.forEach(([, value], index) => {
      const node = practiceDetailRefs.current[index];
      if (node) {
        node.textContent = value;
      }
    });
  };
  const groupedAttentionFindings = reportAttentionFindings.slice(0, 8).reduce((groups, finding, index) => {
    const codeAreaName = formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General'));
    const existingGroup = groups.find((entry) => entry.codeAreaName === codeAreaName);
    const findingEntry = { finding, index };
    if (existingGroup) {
      existingGroup.entries.push(findingEntry);
    } else {
      groups.push({ codeAreaName, entries: [findingEntry] });
    }
    return groups;
  }, []);
  const isSameReportActionItem = (left, right) =>
    String(left?.id || '').trim() === String(right?.id || '').trim()
    && String(left?.action || '').trim() === String(right?.action || '').trim()
    && String(left?.codeRef || '').trim() === String(right?.codeRef || '').trim()
    && String(left?.codeArea || '').trim() === String(right?.codeArea || '').trim()
    && String(left?.deadline || '').trim() === String(right?.deadline || '').trim()
    && String(left?.person || '').trim() === String(right?.person || '').trim();
  const reportActionPlanDirty = reportActionItems.length !== reportActionBaselineItems.length
    || reportActionItems.some((item, index) => !isSameReportActionItem(item, reportActionBaselineItems[index]));

  return (
    <>
      {reportPendingChanges ? (
        <div className="alert-banner warning">
          ⚠ Unprocessed changes pending
          <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenPendingChangesGate}>
            Reprocess now
          </button>
        </div>
      ) : null}
      {reportStale ? (
        <div className="alert-banner warning">
          <span>⚠</span> Findings updated since last report generation.
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenRegenerateConfirm}
            disabled={!reportCanGenerate}
          >
            Regenerate
          </button>
        </div>
      ) : null}
      {reportStale && reportReviewBlockedReason ? (
        <div className="alert-banner warning">
          <span>⚠</span> {reportReviewBlockedReason}
        </div>
      ) : null}
      <div className="report-export-row">
        <button type="button" className="btn btn-primary btn-lg" onClick={onExportReport}>
          Download PDF
        </button>
      </div>
      <div ref={reportExportRef} className="report-card" data-report-export-root="true">
        <div className="report-content">
          <div className="report-header report-card-header">
            <img src={`${assetBase}assets/clc_logo.png`} alt="CLC" />
            <div>
              <p className="report-card-header-title">Council for Licensed Conveyancers</p>
              <p className="report-card-header-subtitle">Inspection Report</p>
            </div>
          </div>
          <section key={`report-draft-${reportDraftVersion}`} className="report-structured-panel">
          <div className="report-section" id="section1" data-section="1">
            <div className="report-section-heading">
              <h3>1. Practice Details</h3>
              <button type="button" className="btn-revert" onClick={handleRevertPracticeDetails}>
                ↻ Revert section
              </button>
            </div>
            <div className="detail-grid" id="section1-content">
              {practiceDetailRows.map(([label, value], index) => (
                <Fragment key={label}>
                  <span className="detail-label">{label}:</span>
                  <span
                    ref={(node) => {
                      practiceDetailRefs.current[index] = node || null;
                    }}
                    className="detail-value report-editable"
                    contentEditable
                    suppressContentEditableWarning
                  >
                    {value}
                  </span>
                </Fragment>
              ))}
            </div>
          </div>
          <div className={`report-section report-section-block ${editedReportSections.interviews ? 'edited' : ''}`}>
            <div className={`report-section-heading ${editedReportSections.interviews ? 'edited' : ''}`}>
              <h3>2. Interviews Conducted</h3>
              <button
                type="button"
                className="btn-revert"
                onClick={() => handleRevertReportSection('interviews')}
                disabled={!editedReportSections.interviews}
              >
                ↻ Revert section
              </button>
            </div>
            <div id="section2-content">
              {reportSectionDefaults.interviews.map((line, index) => (
                <p
                  key={`report-interview-${index}`}
                  className="report-editable"
                  ref={(node) => setReportEditableRef('interviews', index, node)}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => handleReportSectionEdited('interviews')}
                >
                  {line}
                </p>
              ))}
              <div className="muted-note">(auto-populated from interview transcript metadata)</div>
            </div>
          </div>
          <div className={`report-section report-section-block ${editedReportSections.summary ? 'edited' : ''}`}>
            <div className={`report-section-heading ${editedReportSections.summary ? 'edited' : ''}`}>
              <h3>3. Compliance Summary</h3>
              <button
                type="button"
                className="btn-revert"
                onClick={() => handleRevertReportSection('summary')}
                disabled={!editedReportSections.summary}
              >
                ↻ Revert section
              </button>
            </div>
            <div id="section3-content">
              <p
                ref={(node) => setReportEditableRef('summary', 0, node)}
                contentEditable
                suppressContentEditableWarning
                className="report-editable"
                onInput={() => handleReportSectionEdited('summary')}
              >
                {reportSectionDefaults.summary[0]}
              </p>
            </div>
          </div>
          <div className={`report-section report-section-block ${editedReportSections.goodPractice ? 'edited' : ''}`}>
            <div className={`report-section-heading ${editedReportSections.goodPractice ? 'edited' : ''}`}>
              <h3>4. Areas of Good Practice</h3>
              <button
                type="button"
                className="btn-revert"
                onClick={() => handleRevertReportSection('goodPractice')}
                disabled={!editedReportSections.goodPractice}
              >
                ↻ Revert section
              </button>
            </div>
            <div id="section4-content">
              {reportGoodPracticeFindings.length === 0 ? (
                <p
                  ref={(node) => setReportEditableRef('goodPractice', 0, node)}
                  contentEditable
                  suppressContentEditableWarning
                  className="report-editable"
                  onInput={() => handleReportSectionEdited('goodPractice')}
                >
                  {reportSectionDefaults.goodPractice[0]}
                </p>
              ) : (
                reportGoodPracticeFindings.slice(0, 4).map((finding, index) => (
                  <div key={`report-good-${finding.id}`} className="finding-subsection">
                    <div className="finding-subsection-title" contentEditable suppressContentEditableWarning>
                      {safeText(finding.title, 'Good Practice')}{' '}
                      <span className="finding-code-ref">
                        ({formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General'))})
                      </span>
                    </div>
                    <p
                      ref={(node) =>
                        setReportEditableRef('goodPractice', index, node, {
                          codeAreaId: normalizeCodeAreaId(safeText(finding.codeArea || finding.code_area, ''))
                        })
                      }
                      contentEditable
                      suppressContentEditableWarning
                      className="report-editable"
                      onInput={() =>
                        handleReportSectionEdited('goodPractice', {
                          codeAreaId: normalizeCodeAreaId(safeText(finding.codeArea || finding.code_area, ''))
                        })
                      }
                    >
                      {safeText(
                        reportSectionDefaults.goodPractice[index],
                        safeText(finding.detail, safeText(finding.title, 'Good Practice finding'))
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className={`report-section report-section-block ${editedReportSections.attention ? 'edited' : ''}`}>
            <div className={`report-section-heading ${editedReportSections.attention ? 'edited' : ''}`}>
              <h3>5. Areas Requiring Attention</h3>
              <button
                type="button"
                className="btn-revert"
                onClick={() => handleRevertReportSection('attention')}
                disabled={!editedReportSections.attention}
              >
                ↻ Revert section
              </button>
            </div>
            <div id="section5-content">
              {reportAttentionFindings.length === 0 ? (
                <p
                  ref={(node) => setReportEditableRef('attention', 0, node)}
                  contentEditable
                  suppressContentEditableWarning
                  className="report-editable"
                  onInput={() => handleReportSectionEdited('attention')}
                >
                  {reportSectionDefaults.attention[0]}
                </p>
              ) : (
                groupedAttentionFindings.map((group) => (
                  <div key={`report-group-${group.codeAreaName}`}>
                    <div className="code-area-subheading">{group.codeAreaName}</div>
                    {group.entries.map(({ finding, index }) => {
                      const passages = buildEvidencePassages(finding).slice(0, 3);
                      return (
                        <div key={`report-attn-${finding.id}`} className="attention-finding">
                          <div className="attention-finding-title" contentEditable suppressContentEditableWarning>
                            {`5.${index + 1} ${safeText(finding.title, 'Attention finding')}`}{' '}
                            <span className="finding-code-ref">({formatReferenceText?.(finding.reference) || finding.id})</span>
                          </div>
                          <p
                            ref={(node) =>
                              setReportEditableRef('attention', index, node, {
                                codeAreaId: normalizeCodeAreaId(safeText(finding.codeArea || finding.code_area, ''))
                              })
                            }
                            contentEditable
                            suppressContentEditableWarning
                            className="report-editable"
                            onInput={() =>
                              handleReportSectionEdited('attention', {
                                codeAreaId: normalizeCodeAreaId(safeText(finding.codeArea || finding.code_area, ''))
                              })
                            }
                          >
                            {safeText(
                              reportSectionDefaults.attention[index],
                              safeText(finding.detail, safeText(finding.title, 'Attention finding'))
                            )}
                          </p>
                          {passages.length > 0 ? (
                            <p className="report-evidence-links">
                              See:{' '}
                              {passages.map((passage, passageIndex) => (
                                <span key={`report-ev-${finding.id}-${passage.id}`} className="tooltip-wrap">
                                  <button
                                    type="button"
                                    className="inline-link-btn evidence-ref"
                                    onClick={() => handleJumpToEvidencePassage(finding, passage)}
                                    title="Opens Document Viewer"
                                  >
                                    {safeText(passage.file, 'Case document')}
                                    {safeText(passage.page, '') ? ` p.${safeText(passage.page, '')}` : ''}
                                  </button>
                                  <span className="tooltip-text">Opens Document Viewer</span>
                                  {passageIndex < passages.length - 1 ? ' · ' : ''}
                                </span>
                              ))}
                            </p>
                          ) : null}
                          <p contentEditable suppressContentEditableWarning className="report-editable">
                            <span className="action-text">Action:</span>{' '}
                            {safeText(
                              reportActionItems[index]?.action,
                              'Follow up and document the remedial action required.'
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
          </section>
          <section className="report-section report-action-plan" id="section6" data-section="6">
          <div className="report-section-heading">
            <h3>6. Action Plan</h3>
            <button
              type="button"
              className="btn-revert"
              disabled={!reportActionPlanDirty}
              onClick={() => {
                const nextIds = new Set(reportActionBaselineItems.map((entry) => entry.id));
                const removedIds = reportActionItems.map((entry) => entry.id).filter((entryId) => !nextIds.has(entryId));
                const nextItems = reportActionBaselineItems.map((entry) => ({ ...entry }));
                setReportActionItems(nextItems);
                nextItems.forEach((entry) => {
                  void upsertReportActionItem(entry, entry.id);
                });
                removedIds.forEach((entryId) => {
                  void deleteReportActionItem(entryId);
                });
              }}
            >
              ↻ Revert section
            </button>
          </div>
          <div id="section6-content">
            <div className="action-plan-table-wrap">
            <table className="action-plan-table" id="actionPlanTable">
              <thead>
                <tr>
                  <th style={{ width: '32px' }} aria-hidden="true" />
                  <th>Action</th>
                  <th style={{ width: '120px' }}>Code Area</th>
                  <th style={{ width: '140px' }}>
                    Deadline <span title="Suggested based on precedent from similar actions" style={{ cursor: 'help' }}>ℹ</span>
                  </th>
                  <th style={{ width: '140px' }}>Person</th>
                </tr>
              </thead>
              <tbody id="actionPlanBody">
                {reportActionItems.map((item) => (
                  <tr key={item.id}>
                    <td className="drag-handle">≡</td>
                    <td>
                      <span
                        className="editable-cell"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(event) => {
                          const nextAction = (event.currentTarget.textContent || '').trim() || item.action;
                          const nextItem = { ...item, action: nextAction };
                          setReportActionItems((prev) => prev.map((entry) => (entry.id === item.id ? nextItem : entry)));
                          void upsertReportActionItem(nextItem, item.id);
                        }}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td>{item.codeArea}</td>
                    <td>
                      <input
                        className="docs-inline-input"
                        type="date"
                        value={/^\d{4}-\d{2}-\d{2}$/.test(item.deadline) ? item.deadline : ''}
                        onChange={(event) =>
                          setReportActionItems((prev) =>
                            prev.map((entry) =>
                              entry.id === item.id ? { ...entry, deadline: event.target.value || 'TBD' } : entry
                            )
                          )
                        }
                        onBlur={(event) => {
                          const nextDeadline = event.target.value || 'TBD';
                          const nextItem = { ...item, deadline: nextDeadline };
                          void upsertReportActionItem(nextItem, item.id);
                        }}
                        title="Suggested based on precedent from similar actions"
                      />
                    </td>
                    <td>
                      <input
                        className="docs-inline-input"
                        type="text"
                        placeholder="Assign..."
                        value={item.person}
                        onChange={(event) =>
                          setReportActionItems((prev) =>
                            prev.map((entry) =>
                              entry.id === item.id ? { ...entry, person: event.target.value } : entry
                            )
                          )
                        }
                        onBlur={(event) => {
                          const nextItem = { ...item, person: event.target.value };
                          void upsertReportActionItem(nextItem, item.id);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="add-action-row">
              <button
                type="button"
                className="btn btn-tertiary btn-sm"
                onClick={() => {
                  const nextItem = {
                    id: `ra-${Date.now()}`,
                    action: 'New action item',
                    codeRef: '',
                    codeArea: reportCodeAreaSummaries[0]?.name ?? 'General',
                    deadline: 'TBD',
                    person: ''
                  };
                  setReportActionItems((prev) => [...prev, nextItem]);
                  void upsertReportActionItem(nextItem, nextItem.id);
                }}
              >
                + Add action
              </button>
            </div>
          </div>
          </section>
        <section className="report-section report-code-area-summary" id="section7" data-section="7">
          <div className="report-section-heading">
            <h3>7. Appendix — Detailed Findings</h3>
            <button type="button" className="btn-revert">
              ↻ Revert section
            </button>
          </div>
          <div id="section7-content">
            <p contentEditable suppressContentEditableWarning>
              Full finding details with evidence references are available in the digital case file. This appendix
              provides a summary of all {reportAppendixRows.length} findings generated during this inspection.
            </p>
            <div className="action-plan-table-wrap">
            <table className="action-plan-table report-appendix-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Finding</th>
                  <th>Severity</th>
                  <th>Code Area</th>
                </tr>
              </thead>
              <tbody>
                {reportAppendixRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.finding}</td>
                    <td>{row.severity}</td>
                    <td>{row.codeArea}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="report-appendix-link" contentEditable suppressContentEditableWarning>
              <a className="evidence-ref" href="#">
                See digital case file for complete evidence chain.
              </a>
            </p>
          </div>
        </section>
        <div className="report-footer report-footer-brand">
          <img src={`${assetBase}assets/sumplexity_horizontal_logo.png`} alt="Sumplexity" />
          <span>Powered by Sumplexity</span>
        </div>
        </div>
      </div>
    </>
  );
}
