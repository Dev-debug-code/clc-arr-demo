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
  const matchedInspectionDate = matchedPractice?.last_inspection?.date || null;
  const matchedInspectionDateLabel = matchedInspectionDate
    ? formatShortDisplayDate(matchedInspectionDate)
    : null;
  const isCreateEnabled =
    caseSetupPracticeName.trim().length > 0 &&
    caseSetupLicenceNumber.trim().length > 0 &&
    selectedFocusAreaIds.size > 0;

  return (
    <div className="case-setup-shell">
      <div className="case-setup-back">
        <button
          type="button"
          className="case-setup-back-button"
          onClick={(event) => {
            onBackToDashboard();
          }}
        >
          <span aria-hidden="true">←</span>
          <span>Back to Dashboard</span>
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
        {matchedPractice ? (
          <div className="case-setup-match">
            <strong>
              ✓ Previous inspection found{matchedInspectionDateLabel ? `: ${matchedInspectionDateLabel}` : ''}
            </strong>
            <p>{matchedPractice.name || 'Matched practice'}. History will be linked automatically.</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
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
        <p className="panel-subtitle" style={{ marginBottom: '12px' }}>
          These inputs shape which checks are selected and how the case is risk-rated for the demo.
        </p>
        <div className="case-setup-grid">
          <label>
            Transaction type
            <select
              value={caseSetupTransactionType}
              onChange={(event) => setCaseSetupTransactionType(event.target.value)}
            >
              <option value="">Select transaction type</option>
              {CASE_TRANSACTION_TYPE_OPTIONS.map((option) => (
                <option key={`transaction-type-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Acting for lender
            <select
              value={caseSetupActingForLender}
              onChange={(event) => setCaseSetupActingForLender(event.target.value)}
            >
              <option value="">Select an option</option>
              {CASE_ACTING_FOR_LENDER_OPTIONS.map((option) => (
                <option key={`acting-for-lender-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            AML tier
            <select
              value={caseSetupAmlTier}
              onChange={(event) => setCaseSetupAmlTier(event.target.value)}
            >
              <option value="">Select AML tier</option>
              {CASE_AML_TIER_OPTIONS.map((option) => (
                <option key={`aml-tier-${option.value}`} value={option.value}>
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
        </div>
      </section>

      <section className="case-setup-section">
        <h3>
          Inspection Context <span className="panel-subtitle">Optional</span>
        </h3>
        <div className="case-setup-grid">
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
          Focus areas
          <p className="panel-subtitle" style={{ margin: '6px 0 10px' }}>
            All code areas start selected. Use the quick-select buttons to scope the inspection.
          </p>
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
          <button type="button" className="btn btn-tertiary btn-sm" onClick={handleSelectAllFocusAreas}>
            Select all
          </button>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={handleDeselectAllFocusAreas}>
            Deselect all
          </button>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={handleApplyAmlPreset}>
            Populate from risk register
          </button>
        </div>
        <p className="panel-subtitle" style={{ marginTop: '8px' }}>
          Suggests the demo focus areas and case properties from the prior risk profile.
        </p>
        {selectedFocusAreaIds.size === 0 ? (
          <p className="case-setup-error">Select at least one focus area.</p>
        ) : null}

        <label>
          Pre-inspection concerns
          <textarea
            rows={3}
            value={caseSetupConcerns}
            onChange={(event) => setCaseSetupConcerns(event.target.value)}
            placeholder="e.g. MLRO changed 6 months ago, aged balances flagged in accountant's report..."
          />
        </label>

        <div>
          <h4 style={{ margin: '0 0 6px' }}>
            Known parties <span className="panel-subtitle">Optional</span>
          </h4>
          <p className="panel-subtitle" style={{ marginBottom: '8px' }}>
            If the CLC provided a party list, enter them here to improve document matching.
          </p>
          <div className="party-rows">
            {caseSetupParties.map((party) => (
              <div key={party.id} className="party-row">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Party name"
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
                  className="btn btn-ghost btn-sm party-remove-btn"
                  onClick={() => handleRemovePartyRow(party.id)}
                  title="Remove"
                  aria-label="Remove party row"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={handleAddPartyRow}>
            + Add party
          </button>
        </div>

        <div>
          <h4 style={{ margin: '0 0 6px' }}>Attach pre-inspection questionnaire</h4>
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
              Processed as firm self-assessment context, not as a policy to check against.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm upload-placeholder-btn"
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
                className="btn btn-ghost btn-sm"
                title="Remove file"
                aria-label="Remove file"
                onClick={() => {
                  setCaseSetupQuestionnaireFile('');
                  setCaseSetupQuestionnaireFileBlob(null);
                  if (caseSetupFileInputRef.current) {
                    caseSetupFileInputRef.current.value = '';
                  }
                }}
              >
                ×
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="action-bar">
        <a
          href="#"
          className="btn btn-ghost"
          onClick={(event) => {
            event.preventDefault();
            onBackToDashboard();
          }}
        >
          Cancel
        </a>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCreateCase}
          disabled={!isCreateEnabled || isCreatingCase}
        >
          {isCreatingCase ? 'Creating...' : 'Create Case'}
        </button>
      </div>
    </div>
  );
}
