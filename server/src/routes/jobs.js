import { Router } from 'express';
import db from '../db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { isValidJobType } from '../constants/jobTypes.js';

const router = Router();
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

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
  };
}

function canViewJob(row, user) {
  if ((row.approval_status || 'approved') === 'approved') return true;
  if (!user) return false;

  const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(user.id);
  return row.posted_by === user.id || Boolean(admin?.is_admin);
}

async function searchWithPython(jobs, query, location, type) {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs, query, location, type }),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.jobs;
  } catch {
    return null;
  }
}

function filterJobsLocally(jobs, query, location, type) {
  return jobs.filter((job) => {
    const matchesQuery =
      !query ||
      [job.title, job.company, job.description, job.category]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesLocation =
      !location || job.location.toLowerCase().includes(location.toLowerCase());
    const matchesType = !type || job.type === type;
    return matchesQuery && matchesLocation && matchesType;
  });
}

router.get('/', async (req, res) => {
  const { q, location, type } = req.query;

  const rows = db
    .prepare(
      `SELECT jobs.*, users.name AS poster_name
       FROM jobs
       JOIN users ON jobs.posted_by = users.id
       WHERE jobs.approval_status = 'approved' OR jobs.approval_status IS NULL
       ORDER BY jobs.created_at DESC`
    )
    .all();

  const jobs = rows.map(formatJob);
  const ranked = await searchWithPython(jobs, q, location, type);
  const results = ranked ?? filterJobsLocally(jobs, q, location, type);

  res.json({ jobs: results });
});

router.get('/:id', optionalAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT jobs.*, users.name AS poster_name
       FROM jobs
       JOIN users ON jobs.posted_by = users.id
       WHERE jobs.id = ?`
    )
    .get(req.params.id);

  if (!row || !canViewJob(row, req.user)) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({ job: formatJob(row) });
});

router.post('/', authRequired, (req, res) => {
  const { title, company, location, type, description, category, salary, contactEmail } = req.body;

  if (!title || !company || !location || !type || !description || !category || !contactEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!isValidJobType(type)) {
    return res.status(400).json({ error: 'Invalid job type' });
  }

  const approvalStatus = type === 'B-Corp' ? 'pending' : 'approved';

  const result = db
    .prepare(
      `INSERT INTO jobs (
        title, company, location, type, description, category, salary,
        contact_email, posted_by, approval_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      company,
      location,
      type,
      description,
      category,
      salary || null,
      contactEmail,
      req.user.id,
      approvalStatus
    );

  const row = db
    .prepare(
      `SELECT jobs.*, users.name AS poster_name
       FROM jobs
       JOIN users ON jobs.posted_by = users.id
       WHERE jobs.id = ?`
    )
    .get(result.lastInsertRowid);

  const response = { job: formatJob(row) };
  if (approvalStatus === 'pending') {
    response.message = 'Your B-Corp listing was submitted and is pending admin review.';
  }

  res.status(201).json(response);
});

router.delete('/:id', authRequired, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.posted_by !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own listings' });
  }

  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
