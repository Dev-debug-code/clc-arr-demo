import { useMemo } from 'react';
import {
  CASE_ACTING_FOR_LENDER_OPTIONS,
  CASE_AML_TIER_OPTIONS,
  CASE_TRANSACTION_TYPE_OPTIONS,
  FOCUS_AREA_OPTIONS
} from '../config.js';
import { DEMO_PRACTICE_PROFILES } from '../../../data/demoPracticeProfiles.js';

const FOCUS_AREA_GUIDANCE_PATHS = {
  aml: '/assets/case-files/CLC_Anti_Money_Laundering_Guidance_Jan2025.pdf',
  lenders: '/assets/case-files/20240110-Acting-for-Lenders-and-Prevention-and-Detection-of-Mortgage-Fraud-Guidance.pdf',
  'code-of-conduct': '/assets/case-files/Code-of-Conduct.pdf'
};

export default function CaseSetupPage({
  caseCreateError,
  caseSetupPracticeName,
  setCaseSetupPracticeName,
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
  handleApplyPracticePreset,
  caseSetupFileInputRef,
  setCaseSetupQuestionnaireFile,
  setCaseSetupQuestionnaireFileBlob,
  caseSetupQuestionnaireFile,
  isCreatingCase,
  handleCreateCase,
  isCaseCreated
}) {
  const selectedProfile = useMemo(
    () => DEMO_PRACTICE_PROFILES.find((p) => p.practiceName === caseSetupPracticeName) || null,
    [caseSetupPracticeName]
  );

  const isCreateEnabled =
    caseSetupPracticeName.trim().length > 0 &&
    selectedFocusAreaIds.size > 0;

  const openFocusAreaGuidance = (areaId) => {
    const path = FOCUS_AREA_GUIDANCE_PATHS[areaId];
    if (!path || typeof window === 'undefined') return;
    const targetUrl = new URL(path, window.location.href).toString();
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="case-setup-shell">
      {caseCreateError ? <div className="alert alert-warning small">{caseCreateError}</div> : null}
      <h1>New Inspection Case</h1>

      <section className="case-setup-section">
        <h3>Practice Details</h3>
        <div className="case-setup-grid">
          <label>
            <span>Practice name <span className="required">*</span></span>
            <select
              className="case-setup-practice-select"
              value={caseSetupPracticeName}
              onChange={(event) => {
                const selectedName = event.target.value;
                setCaseSetupPracticeName(selectedName);
                const profile = DEMO_PRACTICE_PROFILES.find((p) => p.practiceName === selectedName);
                if (profile) {
                  setCaseSetupHolp(profile.holp || '');
                  setCaseSetupHofa(profile.hofa || '');
                  setCaseSetupPreviousInspection(profile.previousInspection || '');
                  handleApplyPracticePreset(profile);
                }
              }}
            >
              <option value="">Select a practice...</option>
              {DEMO_PRACTICE_PROFILES.map((profile) => (
                <option key={profile.id} value={profile.practiceName}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
        </div>
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
              <div key={area.id} className="case-setup-focus-row">
                <label className="case-setup-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedFocusAreaIds.has(area.id)}
                    onChange={() => toggleFocusArea(area.id)}
                  />
                  <span>{area.label}</span>
                </label>
                <button
                  type="button"
                  className="jump-link-btn jump-link-btn--secondary case-setup-guidance-btn"
                  onClick={() => openFocusAreaGuidance(area.id)}
                >
                  <span className="jump-link">Jump to guidance</span>
                </button>
              </div>
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
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCreateCase}
          disabled={!isCreateEnabled || isCreatingCase || isCaseCreated}
        >
          {isCaseCreated ? 'Case Created' : isCreatingCase ? 'Creating...' : 'Create Case'}
        </button>
      </div>
    </div>
  );
}
