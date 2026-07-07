import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

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

async function scoreApplication(jobDescription, coverLetter) {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/score-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription, coverLetter }),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.score;
  } catch {
    return null;
  }
}

router.post('/', authRequired, async (req, res) => {
  const { jobId, coverLetter } = req.body;

  if (!jobId || !coverLetter?.trim()) {
    return res.status(400).json({ error: 'Job ID and cover letter are required' });
  }

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.approval_status && job.approval_status !== 'approved') {
    return res.status(400).json({ error: 'This listing is not accepting applications yet' });
  }

  if (job.posted_by === req.user.id) {
    return res.status(400).json({ error: 'You cannot apply to your own listing' });
  }

  const existing = db
    .prepare('SELECT id FROM applications WHERE job_id = ? AND user_id = ?')
    .get(jobId, req.user.id);

  if (existing) {
    return res.status(409).json({ error: 'You have already applied to this job' });
  }

  const matchScore = await scoreApplication(job.description, coverLetter.trim());

  const result = db
    .prepare(
      `INSERT INTO applications (job_id, user_id, cover_letter, match_score)
       VALUES (?, ?, ?, ?)`
    )
    .run(jobId, req.user.id, coverLetter.trim(), matchScore);

  const row = db
    .prepare(
      `SELECT applications.*, jobs.title AS job_title, jobs.company AS job_company,
              users.name AS applicant_name, users.email AS applicant_email
       FROM applications
       JOIN jobs ON applications.job_id = jobs.id
       JOIN users ON applications.user_id = users.id
       WHERE applications.id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ application: formatApplication(row) });
});

router.get('/mine', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT applications.*, jobs.title AS job_title, jobs.company AS job_company,
              users.name AS applicant_name, users.email AS applicant_email
       FROM applications
       JOIN jobs ON applications.job_id = jobs.id
       JOIN users ON applications.user_id = users.id
       WHERE applications.user_id = ?
       ORDER BY applications.created_at DESC`
    )
    .all(req.user.id);

  res.json({ applications: rows.map(formatApplication) });
});

router.get('/job/:jobId', authRequired, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
  if (job.posted_by !== req.user.id && !user?.is_admin) {
    return res.status(403).json({ error: 'Not authorized to view these applications' });
  }

  const rows = db
    .prepare(
      `SELECT applications.*, jobs.title AS job_title, jobs.company AS job_company,
              users.name AS applicant_name, users.email AS applicant_email
       FROM applications
       JOIN jobs ON applications.job_id = jobs.id
       JOIN users ON applications.user_id = users.id
       WHERE applications.job_id = ?
       ORDER BY applications.match_score DESC, applications.created_at DESC`
    )
    .all(req.params.jobId);

  res.json({ applications: rows.map(formatApplication) });
});

router.patch('/:id', authRequired, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'reviewed', 'accepted', 'rejected'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(application.job_id);
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);

  if (job.posted_by !== req.user.id && !user?.is_admin) {
    return res.status(403).json({ error: 'Not authorized to update this application' });
  }

  db.prepare(
    `UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, req.params.id);

  const row = db
    .prepare(
      `SELECT applications.*, jobs.title AS job_title, jobs.company AS job_company,
              users.name AS applicant_name, users.email AS applicant_email
       FROM applications
       JOIN jobs ON applications.job_id = jobs.id
       JOIN users ON applications.user_id = users.id
       WHERE applications.id = ?`
    )
    .get(req.params.id);

  res.json({ application: formatApplication(row) });
});

router.delete('/:id', authRequired, (req, res) => {
  const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (application.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only withdraw your own applications' });
  }

  db.prepare('DELETE FROM applications WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
