import {
  CASE_ACTING_FOR_LENDER_OPTIONS,
  CASE_AML_TIER_OPTIONS,
  CASE_TRANSACTION_TYPE_OPTIONS,
  FOCUS_AREA_OPTIONS
} from '../config.js';
import { formatShortDisplayDate, toDateInputValue } from '../helpers.js';

export default function CaseSetupPage({
  onBackToDashboard,
  caseCreateError,
  caseSetupPracticeName,
  setCaseSetupPracticeName,
  caseSetupLicenceNumber,
  setCaseSetupLicenceNumber,
  isCaseSetupPracticeLookupLoading,
  caseSetupPracticeLookupError,
  caseSetupPracticeLookup,
  setCaseSetupHolp,
  setCaseSetupHofa,
  setCaseSetupPreviousInspection,
  caseSetupHolp,
  caseSetupHofa,
  caseSetupRiskLevel,
  setCaseSetupRiskLevel,
  caseSetupTransactionType,
  setCaseSetupTransactionType,
  caseSetupActingForLender,
  setCaseSetupActingForLender,
  caseSetupAmlTier,
  setCaseSetupAmlTier,
  caseSetupPreviousInspection,
  caseSetupConcerns,
  setCaseSetupConcerns,
  selectedFocusAreaIds,
  toggleFocusArea,
  handleSelectAllFocusAreas,
  handleDeselectAllFocusAreas,
  handleApplyAmlPreset,
  caseSetupParties,
  handleUpdatePartyRow,
  handleRemovePartyRow,
  handleAddPartyRow,
  caseSetupFileInputRef,
  setCaseSetupQuestionnaireFile,
  setCaseSetupQuestionnaireFileBlob,
  caseSetupQuestionnaireFile,
  isCreatingCase,
  handleCreateCase
}) {
  const matchedPractice = caseSetupPracticeLookup;
  const hasAutoMatch = Boolean(matchedPractice);
  const matchedInspectionDate = matchedPractice?.last_inspection?.date || null;
  const matchedInspectionDateLabel = matchedInspectionDate
    ? formatShortDisplayDate(matchedInspectionDate)
    : null;
  const hasNamedParty = caseSetupParties.some((party) => String(party?.name || '').trim().length > 0);
  const isCreateEnabled =
    caseSetupPracticeName.trim().length > 0 &&
    caseSetupLicenceNumber.trim().length > 0 &&
    caseSetupTransactionType.trim().length > 0 &&
    caseSetupActingForLender.trim().length > 0 &&
    caseSetupAmlTier.trim().length > 0 &&
    hasNamedParty &&
    selectedFocusAreaIds.size > 0;

  return (
    <div className="case-setup-shell">
      <div className="case-setup-back">
        <button type="button" className="btn ghost" onClick={onBackToDashboard}>
          ← Back to Dashboard
        </button>
      </div>
      {caseCreateError ? <div className="alert alert-warning small">{caseCreateError}</div> : null}
      <h1>New Inspection Case</h1>

      <section className="case-setup-section">
        <h3>Practice Details</h3>
        <div className="case-setup-grid">
          <label>
            Practice name <span className="required">*</span>
            <input
              type="text"
              value={caseSetupPracticeName}
              onChange={(event) => setCaseSetupPracticeName(event.target.value)}
              placeholder="Full registered practice name"
            />
          </label>
          <label>
            CLC licence number <span className="required">*</span>
            <input
              type="text"
              value={caseSetupLicenceNumber}
              onChange={(event) => setCaseSetupLicenceNumber(event.target.value)}
              placeholder="CLC-XXXXX"
            />
          </label>
        </div>
        {isCaseSetupPracticeLookupLoading ? (
          <div className="case-setup-match">
            <strong>Checking previous inspection history...</strong>
          </div>
        ) : null}
        {caseSetupPracticeLookupError ? (
          <p className="case-setup-error">{caseSetupPracticeLookupError}</p>
        ) : null}
        {hasAutoMatch ? (
          <div className="case-setup-match">
            <strong>
              ✓ Previous inspection found{matchedInspectionDateLabel ? `: ${matchedInspectionDateLabel}` : ''}
            </strong>
            <p>{matchedPractice.name || 'Matched practice'}. History will be linked automatically.</p>
            <button
              type="button"
              className="btn btn-xs secondary"
              onClick={() => {
                const matchedLicenceNumber = String(matchedPractice.licence_number || '').trim();
                if (matchedLicenceNumber) {
                  setCaseSetupLicenceNumber(matchedLicenceNumber);
                }
                if (matchedPractice.name) {
                  setCaseSetupPracticeName(matchedPractice.name);
                }
                if (matchedPractice.holp) {
                  setCaseSetupHolp(matchedPractice.holp);
                }
                if (matchedPractice.hofa) {
                  setCaseSetupHofa(matchedPractice.hofa);
                }
                const previousInspectionDate = toDateInputValue(matchedPractice?.last_inspection?.date);
                if (previousInspectionDate) {
                  setCaseSetupPreviousInspection(previousInspectionDate);
                }
              }}
            >
              Auto-fill practice details
            </button>
          </div>
        ) : null}
        <div className="case-setup-grid">
          <label>
            Head of Legal Practice (HoLP)
            <input
              type="text"
              value={caseSetupHolp}
              onChange={(event) => setCaseSetupHolp(event.target.value)}
              placeholder="Full name"
            />
          </label>
          <label>
            Head of Finance &amp; Admin (HoFA)
            <input
              type="text"
              value={caseSetupHofa}
              onChange={(event) => setCaseSetupHofa(event.target.value)}
              placeholder="Full name"
            />
          </label>
        </div>
      </section>

      <section className="case-setup-section">
        <h3>Case Properties</h3>
        <p className="panel-subtitle">Required fields used to determine which regulations apply to the case.</p>
        <div className="case-setup-grid">
          <label>
            Transaction type <span className="required">*</span>
            <select
              value={caseSetupTransactionType}
              onChange={(event) => setCaseSetupTransactionType(event.target.value)}
            >
              <option value="">Select transaction type</option>
              {CASE_TRANSACTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Acting for lender <span className="required">*</span>
            <select
              value={caseSetupActingForLender}
              onChange={(event) => setCaseSetupActingForLender(event.target.value)}
            >
              <option value="">Select lender involvement</option>
              {CASE_ACTING_FOR_LENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            AML tier <span className="required">*</span>
            <select
              value={caseSetupAmlTier}
              onChange={(event) => setCaseSetupAmlTier(event.target.value)}
            >
              <option value="">Select AML tier</option>
              {CASE_AML_TIER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Risk level
            <select
              value={caseSetupRiskLevel}
              onChange={(event) => setCaseSetupRiskLevel(event.target.value)}
            >
              <option value="not-assessed">Not assessed</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Previous inspection
            <input
              type="date"
              value={caseSetupPreviousInspection}
              onChange={(event) => setCaseSetupPreviousInspection(event.target.value)}
            />
          </label>
        </div>
        <label>
          Pre-inspection concerns
          <div className="case-setup-textarea-wrap">
            <textarea
              rows={3}
              value={caseSetupConcerns}
              onChange={(event) => setCaseSetupConcerns(event.target.value)}
              placeholder="e.g. MLRO changed 6 months ago, aged balances flagged..."
            />
            <button type="button" className="case-setup-voice-btn" title="Dictate (UI only)" aria-label="Dictate">
              🎤
            </button>
          </div>
        </label>
      </section>

      <section className="case-setup-section">
        <h3>Focus Areas</h3>
        <p className="panel-subtitle">
          Select all code areas in scope for this inspection.
        </p>
        <label>
          Focus areas
          <div className="case-setup-focus-list">
            {FOCUS_AREA_OPTIONS.map((area) => (
              <label key={area.id} className="case-setup-checkbox">
                <input
                  type="checkbox"
                  checked={selectedFocusAreaIds.has(area.id)}
                  onChange={() => toggleFocusArea(area.id)}
                />
                <span>{area.label}</span>
              </label>
            ))}
          </div>
        </label>
        <div className="case-setup-quick-select">
          <button type="button" className="btn btn-xs ghost" onClick={handleSelectAllFocusAreas}>
            Select all
          </button>
          <button type="button" className="btn btn-xs ghost" onClick={handleDeselectAllFocusAreas}>
            Deselect all
          </button>
          <button type="button" className="btn btn-xs secondary" onClick={handleApplyAmlPreset}>
            AML desk review preset
          </button>
        </div>
        {selectedFocusAreaIds.size === 0 ? (
          <p className="case-setup-error">Select at least one focus area.</p>
        ) : null}
      </section>

      <section className="case-setup-section">
        <h3>Parties</h3>
        <p className="panel-subtitle">Required party inputs used for case scoping and document matching.</p>
        {!hasNamedParty ? <p className="case-setup-error">Add at least one party.</p> : null}
        <div className="party-rows">
          {caseSetupParties.map((party) => (
            <div key={party.id} className="party-row">
              <input
                type="text"
                className="form-control"
                placeholder="Party name *"
                value={party.name}
                onChange={(event) => handleUpdatePartyRow(party.id, 'name', event.target.value)}
              />
              <select
                className="form-control"
                value={party.role}
                onChange={(event) => handleUpdatePartyRow(party.id, 'role', event.target.value)}
              >
                <option value="">Role...</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="giftor">Giftor</option>
                <option value="lender">Lender</option>
                <option value="guarantor">Guarantor</option>
                <option value="other">Other</option>
              </select>
              <button
                type="button"
                className="btn btn-xs ghost party-remove-btn"
                onClick={() => handleRemovePartyRow(party.id)}
                title="Remove"
                aria-label="Remove party row"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-xs ghost" onClick={handleAddPartyRow}>
          + Add another party
        </button>
      </section>

      <section className="case-setup-section">
        <h3>Pre-inspection Questionnaire (Optional)</h3>
        <div
          className="upload-area-placeholder clickable"
          role="button"
          tabIndex={0}
          onClick={() => caseSetupFileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer?.files?.[0];
            if (file) {
              setCaseSetupQuestionnaireFile(file.name);
              setCaseSetupQuestionnaireFileBlob(file);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              caseSetupFileInputRef.current?.click();
            }
          }}
        >
          <strong>Drop PDF here or click to upload</strong>
          <p className="panel-subtitle">
            Processed as firm self-assessment context, not checked as policy evidence.
          </p>
          <button
            type="button"
            className="btn btn-xs secondary upload-placeholder-btn"
            onClick={(event) => {
              event.stopPropagation();
              caseSetupFileInputRef.current?.click();
            }}
          >
            Choose file
          </button>
          <input
            ref={caseSetupFileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setCaseSetupQuestionnaireFile(file?.name ?? '');
              setCaseSetupQuestionnaireFileBlob(file ?? null);
            }}
          />
        </div>
        {caseSetupQuestionnaireFile ? (
          <div className="file-selected-chip">
            <span>📄 {caseSetupQuestionnaireFile}</span>
            <button
              type="button"
              className="btn btn-xs ghost"
              onClick={() => {
                setCaseSetupQuestionnaireFile('');
                setCaseSetupQuestionnaireFileBlob(null);
                if (caseSetupFileInputRef.current) {
                  caseSetupFileInputRef.current.value = '';
                }
              }}
            >
              Remove
            </button>
          </div>
        ) : null}
      </section>

      <div className="action-bar">
        <button type="button" className="btn ghost" onClick={onBackToDashboard}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={handleCreateCase}
          disabled={!isCreateEnabled || isCreatingCase}
        >
          {isCreatingCase ? 'Creating...' : 'Create Inspection Case'}
        </button>
      </div>
    </div>
  );
}
