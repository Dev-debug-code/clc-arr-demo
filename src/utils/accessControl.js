export function normalizeUserRole(value) {
  const cleanValue = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (['team_lead', 'teamlead', 'lead', 'reviewer'].includes(cleanValue)) {
    return 'team_lead';
  }

  if (['admin', 'owner', 'full_access', 'fullaccess', 'all_access'].includes(cleanValue)) {
    return 'admin';
  }

  return 'inspector';
}

export function isPrivilegedUserRole(value) {
  return normalizeUserRole(value) === 'admin';
}

export function canAccessTeamCases(value) {
  const normalizedRole = normalizeUserRole(value);
  return normalizedRole === 'team_lead' || normalizedRole === 'admin';
}

export function formatUserRoleLabel(value) {
  const normalizedRole = normalizeUserRole(value);
  if (normalizedRole === 'admin') return 'All access';
  if (normalizedRole === 'team_lead') return 'Team lead';
  return 'Inspector';
}
