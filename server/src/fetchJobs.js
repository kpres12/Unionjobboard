import { linkJobToOrganization } from './services/employerMetrics.js';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

export async function fetchJobsFromSources() {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/fetch-jobs`, {
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      console.warn('Job fetch failed:', response.status);
      return { jobs: [], sources: {} };
    }

    return response.json();
  } catch (error) {
    console.warn('Job fetch unavailable:', error.message);
    return { jobs: [], sources: {} };
  }
}

function resolveApprovalStatus(job) {
  return job.approvalStatus || (job.type === 'B-Corp' ? 'pending' : 'approved');
}

export function upsertExternalJobs(db, jobs, postedBy) {
  const insert = db.prepare(
    `INSERT INTO jobs (
      title, company, location, type, description, category, salary,
      contact_email, posted_by, source, source_url, external_id, published_at,
      approval_status, payment_status, listing_tier
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_required', 'imported')`
  );

  const update = db.prepare(
    `UPDATE jobs
     SET title = ?, company = ?, location = ?, type = ?, description = ?, category = ?,
         salary = ?, contact_email = ?, source_url = ?, published_at = ?
     WHERE source = ? AND external_id = ?`
  );

  let added = 0;
  let updated = 0;

  for (const job of jobs) {
    const existing = db
      .prepare('SELECT id FROM jobs WHERE source = ? AND external_id = ?')
      .get(job.source, job.externalId);

    if (existing) {
      update.run(
        job.title,
        job.company,
        job.location,
        job.type,
        job.description,
        job.category,
        job.salary || null,
        job.contactEmail,
        job.sourceUrl || null,
        job.publishedAt || null,
        job.source,
        job.externalId
      );
      const row = db.prepare('SELECT id, company, location, type FROM jobs WHERE id = ?').get(existing.id);
      if (row) linkJobToOrganization(row);
      updated += 1;
      continue;
    }

    insert.run(
      job.title,
      job.company,
      job.location,
      job.type,
      job.description,
      job.category,
      job.salary || null,
      job.contactEmail,
      postedBy,
      job.source,
      job.sourceUrl || null,
      job.externalId,
      job.publishedAt || null,
      resolveApprovalStatus(job)
    );
    const newId = db.prepare('SELECT id FROM jobs WHERE source = ? AND external_id = ?').get(
      job.source,
      job.externalId
    );
    if (newId) {
      linkJobToOrganization({
        id: newId.id,
        company: job.company,
        location: job.location,
        type: job.type,
      });
    }
    added += 1;
  }

  return { added, updated };
}

export function pruneStaleExternalJobs(db, jobs) {
  const currentKeys = new Set(jobs.map((job) => `${job.source}:${job.externalId}`));
  const externalRows = db
    .prepare('SELECT id, source, external_id FROM jobs WHERE external_id IS NOT NULL')
    .all();

  let removed = 0;

  for (const row of externalRows) {
    const key = `${row.source}:${row.external_id}`;
    if (currentKeys.has(key)) continue;

    db.prepare('DELETE FROM jobs WHERE id = ?').run(row.id);
    removed += 1;
  }

  return removed;
}
