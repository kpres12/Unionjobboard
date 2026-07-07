export function formatUser(row) {
  const subscriptionStatus = row.subscription_status || 'inactive';
  const hasActiveSubscription = ['trialing', 'active', 'past_due'].includes(subscriptionStatus);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isAdmin: Boolean(row.is_admin),
    authProvider: row.auth_provider || 'local',
    role: row.role || 'seeker',
    createdAt: row.created_at,
    subscriptionStatus,
    subscriptionPlanId: row.subscription_plan_id || null,
    subscriptionCurrentPeriodEnd: row.subscription_current_period_end || null,
    subscriptionCancelAtPeriodEnd: Boolean(row.subscription_cancel_at_period_end),
    hasActiveSubscription,
  };
}

export const VALID_ROLES = ['seeker', 'poster', 'both'];

export function normalizeRole(role) {
  return VALID_ROLES.includes(role) ? role : 'seeker';
}
