export default function ReportGeneratedContent({
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
    <>
      {reportPendingChanges ? (
        <div className="alert-banner warning">
          There are unprocessed changes from recent document updates.
          <div className="alert-inline-actions">
            <button type="button" className="btn btn-xs secondary" onClick={onOpenPendingChangesGate}>
              Generate from current findings
            </button>
            <button type="button" className="btn btn-xs primary" onClick={onOpenPendingChangesGate}>
              Reprocess findings first
            </button>
          </div>
        </div>
      ) : null}
      {reportStale ? (
        <div className="alert-banner warning">
          <span>⚠</span> Findings updated since last report generation.
          <button type="button" className="btn btn-xs primary" onClick={onOpenRegenerateConfirm}>
            Regenerate
          </button>
        </div>
      ) : null}
      <div className="report-export-row">
        <button type="button" className="btn primary" onClick={onExportReport}>
          Export PDF
        </button>
      </div>
      <div className="report-card">
        <div className="report-card-header">
          <img src={`${assetBase}assets/clc_logo.png`} alt="CLC" />
          <div>
            <p className="report-card-header-title">Council for Licensed Conveyancers</p>
            <p className="report-card-header-subtitle">Inspection Report</p>
          </div>
        </div>
        <section key={`report-draft-${reportDraftVersion}`} className="report-structured-panel">
          <div className="report-section report-section-block">
            <div className="report-section-head">
              <h4>1. Practice Details</h4>
            </div>
          </div>
          <div className="report-structured-grid">
            <div>
              <label className="modal-label">Practice</label>
              <p contentEditable suppressContentEditableWarning className="report-editable">
                {currentCaseMeta.practiceName}
              </p>
            </div>
            <div>
              <label className="modal-label">Licence</label>
              <p contentEditable suppressContentEditableWarning className="report-editable">
                {currentCaseMeta.caseId}
              </p>
            </div>
            <div>
              <label className="modal-label">Head of Legal Practice</label>
              <p contentEditable suppressContentEditableWarning className="report-editable">
                {currentCaseMeta.holp}
              </p>
            </div>
            <div>
              <label className="modal-label">Head of Finance &amp; Admin</label>
              <p contentEditable suppressContentEditableWarning className="report-editable">
                {currentCaseMeta.hofa}
              </p>
            </div>
            <div>
              <label className="modal-label">Inspection type</label>
              <p contentEditable suppressContentEditableWarning className="report-editable">
                {reportInspectionType}
              </p>
            </div>
            <div>
              <label className="modal-label">Date</label>
              <p contentEditable suppressContentEditableWarning className="report-editable">
                {currentCaseMeta.started}
              </p>
            </div>
            <div>
              <label className="modal-label">Inspector</label>
              <p contentEditable suppressContentEditableWarning className="report-editable">
                {currentCaseMeta.owner}
              </p>
            </div>
          </div>
          <div className={`report-section report-section-block ${editedReportSections.interviews ? 'edited' : ''}`}>
            <div className={`report-section-head ${editedReportSections.interviews ? 'edited' : ''}`}>
              <h4>2. Interviews Conducted</h4>
              <button type="button" className="btn-revert" onClick={() => handleRevertReportSection('interviews')}>
                ↻ Revert section
              </button>
            </div>
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
            <p className="panel-subtitle">(auto-populated from interview transcript metadata)</p>
          </div>
          <div className={`report-section report-section-block ${editedReportSections.summary ? 'edited' : ''}`}>
            <div className={`report-section-head ${editedReportSections.summary ? 'edited' : ''}`}>
              <h4>3. Compliance Summary</h4>
              <button type="button" className="btn-revert" onClick={() => handleRevertReportSection('summary')}>
                ↻ Revert section
              </button>
            </div>
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
          <div className={`report-section report-section-block ${editedReportSections.goodPractice ? 'edited' : ''}`}>
            <div className={`report-section-head ${editedReportSections.goodPractice ? 'edited' : ''}`}>
              <h4>4. Areas of Good Practice</h4>
              <button
                type="button"
                className="btn-revert"
                onClick={() => handleRevertReportSection('goodPractice')}
              >
                ↻ Revert section
              </button>
            </div>
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
                  <p className="report-subheading">
                    {safeText(finding.title, 'Good Practice')}
                    <span className="finding-code-ref">
                      {' '}
                      ({formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General'))})
                    </span>
                  </p>
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
          <div className={`report-section report-section-block ${editedReportSections.attention ? 'edited' : ''}`}>
            <div className={`report-section-head ${editedReportSections.attention ? 'edited' : ''}`}>
              <h4>5. Areas Requiring Attention</h4>
              <button type="button" className="btn-revert" onClick={() => handleRevertReportSection('attention')}>
                ↻ Revert section
              </button>
            </div>
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
              reportAttentionFindings.slice(0, 8).map((finding, index) => {
                const passages = buildEvidencePassages(finding).slice(0, 3);
                return (
                  <div key={`report-attn-${finding.id}`}>
                    <p className="report-subheading">
                      {formatCodeAreaLabel(safeText(finding.codeArea || finding.code_area, 'General'))}
                    </p>
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
                        Evidence refs:{' '}
                        {passages.map((passage, passageIndex) => (
                          <span key={`report-ev-${finding.id}-${passage.id}`} className="tooltip-wrap">
                            <button
                              type="button"
                              className="inline-link-btn"
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
                  </div>
                );
              })
            )}
          </div>
        </section>
        <section className="report-section report-action-plan">
          <div className="report-section-head">
            <h3>6. Action Plan</h3>
            <button
              type="button"
              className="btn-revert"
              onClick={() => {
                const nextIds = new Set(reportActionDefaults.map((entry) => entry.id));
                const removedIds = reportActionItems.map((entry) => entry.id).filter((entryId) => !nextIds.has(entryId));
                const nextItems = reportActionDefaults.map((entry) => ({ ...entry }));
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
          <p className="panel-subtitle">
            Deadline suggestions will come from case history/API later. New action items remain <code>TBD</code> until
            the inspector sets a date.
          </p>
          <div className="docs-table">
            <div className="docs-table__row docs-table__row--head">
              <span aria-hidden="true" />
              <span>Action</span>
              <span>Code Ref</span>
              <span>Code Area</span>
              <span>Deadline ℹ</span>
              <span>Person</span>
            </div>
            {reportActionItems.map((item) => (
              <div key={item.id} className="docs-table__row report-action-row">
                <span className="report-action-row-handle" title="Reorder action">
                  ≡
                </span>
                <span
                  className="report-editable inline"
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
                <span>
                  <input
                    className="docs-inline-input"
                    type="text"
                    placeholder="e.g. S3.5.1"
                    value={item.codeRef || ''}
                    onChange={(event) =>
                      setReportActionItems((prev) =>
                        prev.map((entry) =>
                          entry.id === item.id ? { ...entry, codeRef: event.target.value } : entry
                        )
                      )
                    }
                    onBlur={(event) => {
                      const nextItem = { ...item, codeRef: event.target.value };
                      void upsertReportActionItem(nextItem, item.id);
                    }}
                  />
                </span>
                <span>{item.codeArea}</span>
                <span>
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
                  />
                </span>
                <span>
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
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-xs secondary report-add-action-btn"
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
        </section>
        {caseContextNotes.length > 0 ? (
          <section className="report-context-section">
            <h3>Case Context Notes</h3>
            <ul>
              {caseContextNotes.slice(0, 6).map((note) => (
                <li key={`report-context-${note.id}`}>
                  {note.text}
                  <span className="panel-subtitle"> ({note.ts} - {note.actor})</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {inspectorObservations.length > 0 ? (
          <section className="report-observations-section">
            <h3>Inspector Observations</h3>
            <ul>
              {inspectorObservations.slice(0, 5).map((obs) => (
                <li key={`report-obs-${obs.id}`}>
                  <strong>{obs.requirement}:</strong> {obs.text}
                  <span className="panel-subtitle"> ({obs.sourceType} · {obs.ts})</span>
                  <span className="report-observation-actions">
                    <button type="button" className="btn btn-xs secondary" onClick={() => handleUpdateObservation(obs.id)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-xs ghost" onClick={() => handleDeleteObservation(obs.id)}>
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="report-section report-code-area-summary">
          <div className="report-section-head">
            <h3>7. Appendix — Detailed Findings</h3>
            <button type="button" className="btn-revert">
              ↻ Revert section
            </button>
          </div>
          <div className="report-code-area-list">
            {reportCodeAreaSummaries.map((area) => {
              const total = area.attention + area.lead + area.goodPractice + area.compliant;
              const met = area.compliant + area.goodPractice;
              return (
                <div key={`report-${area.id}`} className="report-code-area-row">
                  <strong>
                    <span className="report-code-area-arrow">▶</span> {area.name}
                  </strong>
                  <span className="panel-subtitle">
                    {met}/{Math.max(total, 1)} aligned · {area.attention} attention · {area.goodPractice} good
                    practice{area.lead ? ` · ${area.lead} lead` : ''}
                  </span>
                </div>
              );
            })}
            <div className="report-code-area-row">
              <strong>
                <span className="report-code-area-arrow">▶</span> Not Assessed
                <span className="panel-subtitle"> ({notAssessedAreas.length} code areas)</span>
              </strong>
              <span className="panel-subtitle" />
            </div>
          </div>
          <div className="docs-table report-appendix-table">
            <div className="docs-table__row docs-table__row--head">
              <span>Ref</span>
              <span>Finding</span>
              <span>Severity</span>
              <span>Code Area</span>
            </div>
            {reportAppendixRows.map((row) => (
              <div key={row.id} className="docs-table__row">
                <span>{row.id}</span>
                <span>{row.finding}</span>
                <span>{row.severity}</span>
                <span>{row.codeArea}</span>
              </div>
            ))}
          </div>
          <p className="panel-subtitle report-appendix-link">See digital case file for complete evidence chain.</p>
        </section>
        <div className="report-footer-brand">
          <img src={`${assetBase}assets/sumplexity_horizontal_logo.png`} alt="Sumplexity" />
          <span>Powered by Sumplexity</span>
        </div>
      </div>
    </>
  );
}
