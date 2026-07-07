import { Router } from 'express';
import db from '../db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { isValidJobType } from '../constants/jobTypes.js';
import {
  FEATURED_ORDER_SQL,
  PUBLIC_LISTING_SQL,
  activateListing,
  validateListingRequest,
} from '../services/listingBilling.js';
import {
  createListingCheckout,
  devAutoPayEnabled,
  stripeEnabled,
} from '../services/stripe.js';
import { linkJobToOrganization } from '../services/employerMetrics.js';

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
    listingTier: row.listing_tier,
    paymentStatus: row.payment_status || 'not_required',
    expiresAt: row.expires_at,
    featuredUntil: row.featured_until,
    isFeatured: Boolean(
      row.featured_until && row.featured_until > new Date().toISOString().slice(0, 19).replace('T', ' ')
    ),
  };
}

function isFeaturedActive(row) {
  if (!row.featured_until) return false;
  const now = db.prepare("SELECT datetime('now') AS value").get().value;
  return row.featured_until > now;
}

function canViewJob(row, user) {
  const paymentOk = ['paid', 'waived', 'not_required'].includes(row.payment_status || 'not_required');
  const notExpired =
    !row.expires_at ||
    row.expires_at > db.prepare("SELECT datetime('now') AS value").get().value;
  const approved = (row.approval_status || 'approved') === 'approved';
  const isLive = approved && paymentOk && notExpired;

  if (isLive) return true;
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

function sortFeaturedFirst(jobs) {
  return [...jobs].sort((a, b) => {
    const aFeatured = a.isFeatured ? 0 : 1;
    const bFeatured = b.isFeatured ? 0 : 1;
    if (aFeatured !== bFeatured) return aFeatured - bFeatured;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

router.get('/', async (req, res) => {
  const { q, location, type } = req.query;

  const rows = db
    .prepare(
      `SELECT jobs.*, users.name AS poster_name
       FROM jobs
       JOIN users ON jobs.posted_by = users.id
       WHERE ${PUBLIC_LISTING_SQL}
       ORDER BY ${FEATURED_ORDER_SQL}`
    )
    .all();

  let jobs = rows.map((row) => ({
    ...formatJob(row),
    isFeatured: isFeaturedActive(row),
  }));

  const ranked = await searchWithPython(jobs, q, location, type);
  jobs = ranked ?? filterJobsLocally(jobs, q, location, type);
  if (ranked) {
    jobs = sortFeaturedFirst(jobs);
  }

  res.json({ jobs });
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

  res.json({ job: { ...formatJob(row), isFeatured: isFeaturedActive(row) } });
});

router.post('/', authRequired, async (req, res) => {
  const {
    title,
    company,
    location,
    type,
    description,
    category,
    salary,
    contactEmail,
    listingTier = 'community',
  } = req.body;

  if (!title || !company || !location || !type || !description || !category || !contactEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!isValidJobType(type)) {
    return res.status(400).json({ error: 'Invalid job type' });
  }

  const listing = validateListingRequest({
    listingTier,
    jobType: type,
    userId: req.user.id,
  });

  if (!listing.ok) {
    return res.status(400).json({ error: listing.error });
  }

  const approvalStatus = type === 'B-Corp' ? 'pending' : 'approved';
  const initialPaymentStatus = listing.paymentStatus;

  const result = db
    .prepare(
      `INSERT INTO jobs (
        title, company, location, type, description, category, salary,
        contact_email, posted_by, approval_status, listing_tier, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      approvalStatus,
      listingTier,
      initialPaymentStatus
    );

  const jobId = result.lastInsertRowid;
  linkJobToOrganization({ id: jobId, company, location, type });
  const row = db
    .prepare(
      `SELECT jobs.*, users.name AS poster_name
       FROM jobs
       JOIN users ON jobs.posted_by = users.id
       WHERE jobs.id = ?`
    )
    .get(jobId);

  const response = { job: formatJob(row) };

  if (listingTier === 'community') {
    activateListing(jobId, listing.plan, 'waived');
    response.job = formatJob(db.prepare('SELECT jobs.*, users.name AS poster_name FROM jobs JOIN users ON jobs.posted_by = users.id WHERE jobs.id = ?').get(jobId));
    if (approvalStatus === 'pending') {
      response.message = 'Your B-Corp listing was submitted and is pending admin review.';
    }
    return res.status(201).json(response);
  }

  if (devAutoPayEnabled()) {
    activateListing(jobId, listing.plan, 'paid');
    response.job = formatJob(db.prepare('SELECT jobs.*, users.name AS poster_name FROM jobs JOIN users ON jobs.posted_by = users.id WHERE jobs.id = ?').get(jobId));
    if (approvalStatus === 'pending') {
      response.message = 'Payment recorded (dev mode). Your B-Corp listing is pending admin review.';
    }
    return res.status(201).json(response);
  }

  if (!stripeEnabled()) {
    db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
    return res.status(503).json({
      error: 'Paid listings require Stripe. Set STRIPE_SECRET_KEY or use Community plan.',
    });
  }

  try {
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);
    const checkoutUrl = await createListingCheckout(row, listing.plan, user.email);
    response.checkoutUrl = checkoutUrl;
    response.message = 'Complete payment to publish your listing.';
    return res.status(201).json(response);
  } catch (error) {
    db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
    return res.status(500).json({ error: error.message });
  }
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
