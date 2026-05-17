const requirementModules = import.meta.glob('./demoFirestoreDump/requirements/*.json', { eager: true });

function asJson(moduleValue) {
  return moduleValue?.default ?? moduleValue ?? {};
}

function coerceText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function normalizeCodeArea(codeArea) {
  const raw = coerceText(codeArea).toLowerCase();
  const normalized = raw.replace(/[^a-z0-9]+/g, ' ').trim();

  if (normalized.includes('money laundering') || normalized.includes('ctf') || raw === 'aml') {
    return 'aml';
  }
  if (normalized.includes('lender') || normalized.includes('mortgage fraud')) {
    return 'lenders';
  }
  if (
    normalized.includes('code of conduct') ||
    normalized.includes('complaint') ||
    normalized.includes('client care') ||
    normalized.includes('engagement')
  ) {
    return 'code-of-conduct';
  }
  return raw || 'aml';
}

function deriveCodeAreaDisplayLabel(codeArea) {
  if (codeArea === 'aml') return 'Anti-Money Laundering';
  if (codeArea === 'lenders') return 'Acting for Lenders';
  if (codeArea === 'code-of-conduct') return 'Code of Conduct';
  return coerceText(codeArea) || 'General';
}

function deriveSeverity(status) {
  const normalized = coerceText(status).toLowerCase();
  if (normalized === 'non_compliant') return 'critical';
  if (normalized === 'good_practice') return 'best_practice';
  if (normalized === 'lead' || normalized === 'lead_linked' || normalized === 'warning') return 'warning';
  return 'pass';
}

function compareByRequirementId(left, right) {
  const leftArea = coerceText(left?.codeArea);
  const rightArea = coerceText(right?.codeArea);
  const areaCompare = leftArea.localeCompare(rightArea, undefined, { sensitivity: 'base' });
  if (areaCompare !== 0) return areaCompare;
  return coerceText(left?.requirementId).localeCompare(coerceText(right?.requirementId), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

export const DEMO_REQUIREMENT_CATALOG = Object.values(requirementModules)
  .map(asJson)
  .map((entry) => {
    const requirementId = coerceText(entry.requirementId || entry.id);
    const codeArea = normalizeCodeArea(entry.codeArea);
    const codeAreaDisplayLabel = deriveCodeAreaDisplayLabel(codeArea);
    return {
      requirementId,
      codeArea,
      codeAreaDisplayLabel,
      codeAreaLabel: coerceText(entry.codeAreaLabel) || codeAreaDisplayLabel,
      label: coerceText(entry.label) || requirementId,
      content: coerceText(entry.content) || coerceText(entry.label) || requirementId,
      status: coerceText(entry.status) || 'compliant',
      severity: deriveSeverity(entry.status)
    };
  })
  .filter((entry) => entry.requirementId)
  .sort(compareByRequirementId);

export const DEMO_REQUIREMENT_BY_ID = new Map(
  DEMO_REQUIREMENT_CATALOG.map((entry) => [entry.requirementId, entry])
);

export const DEMO_FOCUS_AREAS = [
  { id: 'aml', label: 'Anti-Money Laundering' },
  { id: 'lenders', label: 'Acting for Lenders' },
  { id: 'code-of-conduct', label: 'Code of Conduct' }
];

export const DEMO_REQUIREMENT_OPTIONS = DEMO_REQUIREMENT_CATALOG.map(
  (entry) => `${entry.requirementId} ${entry.label}`
);

export const DEMO_REQUIREMENT_SEVERITY_BY_ID = Object.fromEntries(
  DEMO_REQUIREMENT_CATALOG.map((entry) => [`${entry.requirementId} ${entry.label}`, entry.severity])
);

export function extractRequirementId(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const [firstToken] = text.split(/\s+/u);
  return firstToken || text;
}

export function getDemoRequirementDefinition(value) {
  return DEMO_REQUIREMENT_BY_ID.get(extractRequirementId(value)) || null;
}
