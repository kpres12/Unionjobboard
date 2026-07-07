export function formatUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isAdmin: Boolean(row.is_admin),
    authProvider: row.auth_provider || 'local',
    role: row.role || 'seeker',
    createdAt: row.created_at,
  };
}

export const VALID_ROLES = ['seeker', 'poster', 'both'];

export function normalizeRole(role) {
  return VALID_ROLES.includes(role) ? role : 'seeker';
}
