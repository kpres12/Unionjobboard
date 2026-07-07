import { Router } from 'express';
import db from '../db.js';
import { adminRequired, formatUser } from '../middleware/auth.js';
import { JOB_TYPES } from '../constants/jobTypes.js';

const router = Router();

function formatJob(row) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    type: row.type,
    description: row.description,
    category: row.category,
    salary: row.salary,
    contactEmail: row.contact_email,
    postedBy: row.posted_by,
    posterName: row.poster_name,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    source: row.source,
    sourceUrl: row.source_url,
    externalId: row.external_id,
    approvalStatus: row.approval_status || 'approved',
    applicationCount: row.application_count,
  };
}

function formatApplication(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    userId: row.user_id,
    coverLetter: row.cover_letter,
    status: row.status,
    matchScore: row.match_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    jobTitle: row.job_title,
    jobCompany: row.job_company,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
  };
}

router.use(adminRequired);

router.get('/stats', (_req, res) => {
  const jobsByType = Object.fromEntries(
    JOB_TYPES.map((type) => [
      type,
      db.prepare('SELECT COUNT(*) AS count FROM jobs WHERE type = ?').get(type).count,
    ])
  );

  const stats = {
    users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    jobs: db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count,
    applications: db.prepare('SELECT COUNT(*) AS count FROM applications').get().count,
    pendingApplications: db
      .prepare("SELECT COUNT(*) AS count FROM applications WHERE status = 'pending'")
      .get().count,
    pendingBCorpJobs: db
      .prepare("SELECT COUNT(*) AS count FROM jobs WHERE type = 'B-Corp' AND approval_status = 'pending'")
      .get().count,
    jobsByType,
    unionJobs: jobsByType.Union,
    coopJobs: jobsByType['Co-op'],
  };

  res.json({ stats });
});

router.get('/users', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT users.*, COUNT(applications.id) AS application_count
       FROM users
       LEFT JOIN applications ON applications.user_id = users.id
       GROUP BY users.id
       ORDER BY users.created_at DESC`
    )
    .all();

  res.json({
    users: rows.map((row) => ({
      ...formatUser(row),
      applicationCount: row.application_count,
    })),
  });
});

router.get('/jobs', (req, res) => {
  const { status } = req.query;
  const filters = [];
  const params = [];

  if (status === 'pending') {
    filters.push("jobs.type = 'B-Corp'");
    filters.push("jobs.approval_status = 'pending'");
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT jobs.*, users.name AS poster_name,
              COUNT(applications.id) AS application_count
       FROM jobs
       JOIN users ON jobs.posted_by = users.id
       LEFT JOIN applications ON applications.job_id = jobs.id
       ${whereClause}
       GROUP BY jobs.id
       ORDER BY jobs.created_at DESC`
    )
    .all(...params);

  res.json({ jobs: rows.map(formatJob) });
});

router.get('/applications', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT applications.*, jobs.title AS job_title, jobs.company AS job_company,
              users.name AS applicant_name, users.email AS applicant_email
       FROM applications
       JOIN jobs ON applications.job_id = jobs.id
       JOIN users ON applications.user_id = users.id
       ORDER BY applications.created_at DESC`
    )
    .all();

  res.json({ applications: rows.map(formatApplication) });
});

router.patch('/users/:id', (req, res) => {
  const { isAdmin } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.id === req.user.id && !isAdmin) {
    return res.status(400).json({ error: 'You cannot remove your own admin access' });
  }

  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, req.params.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json({ user: formatUser(updated) });
});

router.delete('/users/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.patch('/jobs/:id/approval', (req, res) => {
  const { status } = req.body;

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved, rejected, or pending' });
  }

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.type !== 'B-Corp') {
    return res.status(400).json({ error: 'Only B-Corp listings use the approval workflow' });
  }

  db.prepare('UPDATE jobs SET approval_status = ? WHERE id = ?').run(status, req.params.id);

  const row = db
    .prepare(
      `SELECT jobs.*, users.name AS poster_name,
              (SELECT COUNT(*) FROM applications WHERE job_id = jobs.id) AS application_count
       FROM jobs
       JOIN users ON jobs.posted_by = users.id
       WHERE jobs.id = ?`
    )
    .get(req.params.id);

  res.json({ job: formatJob(row) });
});

router.delete('/jobs/:id', (req, res) => {
  const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
