import db from '../db.js';
import { findOrCreateOrganization } from './organizations.js';

const GHOST_DAYS = 21;

export function linkJobToOrganization(job) {
  const org = findOrCreateOrganization(db, {
    name: job.company,
    location: job.location,
    orgType: job.type,
  });

  db.prepare('UPDATE jobs SET organization_id = ? WHERE id = ?').run(org.id, job.id);
  return org;
}

export function reindexOrganizationsFromJobs() {
  const jobs = db.prepare('SELECT id, company, location, type FROM jobs').all();
  let linked = 0;

  for (const job of jobs) {
    linkJobToOrganization(job);
    linked += 1;
  }

  return linked;
}

export function computeEmployerMetrics(organizationId) {
  const stats = db
    .prepare(
      `SELECT
         COUNT(applications.id) AS application_count,
         SUM(CASE WHEN applications.status = 'pending' THEN 1 ELSE 0 END) AS pending_applications,
         SUM(CASE WHEN applications.status != 'pending' THEN 1 ELSE 0 END) AS reviewed_count,
         SUM(CASE WHEN applications.status = 'accepted' THEN 1 ELSE 0 END) AS accepted_count,
         SUM(
           CASE
             WHEN applications.status = 'pending'
               AND julianday('now') - julianday(applications.created_at) > ?
             THEN 1 ELSE 0
           END
         ) AS ghost_count
       FROM jobs
       LEFT JOIN applications ON applications.job_id = jobs.id
       WHERE jobs.organization_id = ?`
    )
    .get(GHOST_DAYS, organizationId);

  const responseRows = db
    .prepare(
      `SELECT julianday(applications.updated_at) - julianday(applications.created_at) AS days
       FROM applications
       JOIN jobs ON jobs.id = applications.job_id
       WHERE jobs.organization_id = ?
         AND applications.status != 'pending'
         AND applications.updated_at IS NOT NULL`
    )
    .all(organizationId);

  const activeListings = db
    .prepare(
      `SELECT COUNT(*) AS count FROM jobs
       WHERE organization_id = ?
         AND (approval_status = 'approved' OR approval_status IS NULL)
         AND payment_status IN ('paid', 'waived', 'not_required')
         AND (expires_at IS NULL OR expires_at > datetime('now'))`
    )
    .get(organizationId).count;

  const applicationCount = stats.application_count || 0;
  const reviewedCount = stats.reviewed_count || 0;
  const acceptedCount = stats.accepted_count || 0;
  const ghostCount = stats.ghost_count || 0;
  const pendingApplications = stats.pending_applications || 0;

  const reviewedRate = applicationCount ? reviewedCount / applicationCount : null;
  const acceptedRate = applicationCount ? acceptedCount / applicationCount : null;
  const ghostRate = applicationCount ? ghostCount / applicationCount : null;

  const responseDays = responseRows
    .map((row) => row.days)
    .filter((days) => Number.isFinite(days) && days >= 0)
    .sort((a, b) => a - b);

  const medianResponseDays =
    responseDays.length === 0
      ? null
      : responseDays.length % 2 === 1
        ? responseDays[Math.floor(responseDays.length / 2)]
        : (responseDays[responseDays.length / 2 - 1] + responseDays[responseDays.length / 2]) / 2;

  db.prepare(
    `INSERT INTO employer_metrics (
      organization_id, application_count, pending_applications, reviewed_rate,
      accepted_rate, ghost_rate, median_response_days, active_listings, computed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(organization_id) DO UPDATE SET
      application_count = excluded.application_count,
      pending_applications = excluded.pending_applications,
      reviewed_rate = excluded.reviewed_rate,
      accepted_rate = excluded.accepted_rate,
      ghost_rate = excluded.ghost_rate,
      median_response_days = excluded.median_response_days,
      active_listings = excluded.active_listings,
      computed_at = datetime('now')`
  ).run(
    organizationId,
    applicationCount,
    pendingApplications,
    reviewedRate,
    acceptedRate,
    ghostRate,
    medianResponseDays,
    activeListings
  );
}

export function recomputeAllEmployerMetrics() {
  const orgs = db.prepare('SELECT id FROM organizations').all();
  for (const org of orgs) {
    computeEmployerMetrics(org.id);
  }
  return orgs.length;
}
