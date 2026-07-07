import db from '../db.js';
import {
  COMMUNITY_ELIGIBLE_TYPES,
  getListingPlan,
  isValidListingTier,
} from '../constants/listingPlans.js';

export function communityQuotaUsed(userId) {
  const plan = getListingPlan('community');
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM jobs
       WHERE posted_by = ?
         AND listing_tier = 'community'
         AND created_at >= datetime('now', ?)`
    )
    .get(userId, `-${plan.quotaDays} days`);

  return row.count;
}

export function canUseCommunityPlan(userId, jobType) {
  if (!COMMUNITY_ELIGIBLE_TYPES.includes(jobType)) {
    return {
      allowed: false,
      reason: 'Community listings are only available for Union, Co-op, Nonprofit, Public Sector, and Labor Organization roles.',
    };
  }

  const plan = getListingPlan('community');
  const used = communityQuotaUsed(userId);
  if (used >= plan.quotaLimit) {
    return {
      allowed: false,
      reason: `You've used your free Community listing for this ${plan.quotaDays}-day period. Choose Standard or Featured to post now.`,
    };
  }

  return { allowed: true };
}

export function listingSchedule(plan) {
  const expiresAt = db.prepare("SELECT datetime('now', ?) AS value").get(`+${plan.durationDays} days`)
    .value;

  let featuredUntil = null;
  if (plan.featuredDays > 0) {
    featuredUntil = db.prepare("SELECT datetime('now', ?) AS value").get(`+${plan.featuredDays} days`)
      .value;
  }

  return { expiresAt, featuredUntil };
}

export function activateListing(jobId, plan, paymentStatus) {
  const { expiresAt, featuredUntil } = listingSchedule(plan);

  db.prepare(
    `UPDATE jobs
     SET payment_status = ?,
         listing_tier = ?,
         expires_at = ?,
         featured_until = ?
     WHERE id = ?`
  ).run(paymentStatus, plan.id, expiresAt, featuredUntil, jobId);
}

export function validateListingRequest({ listingTier, jobType, userId }) {
  if (!isValidListingTier(listingTier)) {
    return { ok: false, error: 'Invalid listing plan' };
  }

  const plan = getListingPlan(listingTier);
  if (!plan) {
    return { ok: false, error: 'Invalid listing plan' };
  }

  if (listingTier === 'community') {
    const community = canUseCommunityPlan(userId, jobType);
    if (!community.allowed) {
      return { ok: false, error: community.reason };
    }
    return { ok: true, plan, paymentStatus: 'waived' };
  }

  if (jobType === 'B-Corp' && listingTier === 'community') {
    return { ok: false, error: 'B-Corp listings require a paid plan.' };
  }

  return { ok: true, plan, paymentStatus: 'pending' };
}

export const PUBLIC_LISTING_SQL = `
  (jobs.approval_status = 'approved' OR jobs.approval_status IS NULL)
  AND jobs.payment_status IN ('paid', 'waived', 'not_required')
  AND (jobs.expires_at IS NULL OR jobs.expires_at > datetime('now'))
`;

export const FEATURED_ORDER_SQL = `
  CASE
    WHEN jobs.featured_until IS NOT NULL AND jobs.featured_until > datetime('now') THEN 0
    ELSE 1
  END,
  jobs.created_at DESC
`;
