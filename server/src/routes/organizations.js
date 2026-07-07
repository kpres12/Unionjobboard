import { Router } from 'express';
import db from '../db.js';
import {
  formatEmployerMetrics,
  formatIntentScore,
  formatOrganization,
  formatSignal,
} from '../services/organizations.js';

const router = Router();

router.get('/', (req, res) => {
  const q = req.query.q?.trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

  let sql = `
    SELECT organizations.*,
           hiring_intent_scores.score AS intent_score,
           hiring_intent_scores.lead_weeks AS intent_lead_weeks,
           employer_metrics.active_listings,
           employer_metrics.ghost_rate,
           employer_metrics.reviewed_rate
    FROM organizations
    LEFT JOIN hiring_intent_scores ON hiring_intent_scores.organization_id = organizations.id
    LEFT JOIN employer_metrics ON employer_metrics.organization_id = organizations.id
  `;
  const params = [];

  if (q) {
    sql += ' WHERE organizations.name LIKE ? OR organizations.location LIKE ?';
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY COALESCE(hiring_intent_scores.score, 0) DESC, organizations.name ASC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params);

  res.json({
    organizations: rows.map((row) =>
      formatOrganization(row, {
        intentScore: row.intent_score,
        intentLeadWeeks: row.intent_lead_weeks,
        activeListings: row.active_listings || 0,
        ghostRate: row.ghost_rate,
        reviewedRate: row.reviewed_rate,
      })
    ),
  });
});

router.get('/:slug', (req, res) => {
  const org = db.prepare('SELECT * FROM organizations WHERE slug = ?').get(req.params.slug);

  if (!org) {
    return res.status(404).json({ error: 'Organization not found' });
  }

  const intent = db
    .prepare('SELECT * FROM hiring_intent_scores WHERE organization_id = ?')
    .get(org.id);

  const metrics = db
    .prepare('SELECT * FROM employer_metrics WHERE organization_id = ?')
    .get(org.id);

  const signals = db
    .prepare(
      `SELECT labor_signals.*, organizations.name AS organization_name, organizations.slug AS organization_slug
       FROM labor_signals
       JOIN organizations ON organizations.id = labor_signals.organization_id
       WHERE labor_signals.organization_id = ?
       ORDER BY COALESCE(labor_signals.occurred_at, labor_signals.created_at) DESC
       LIMIT 30`
    )
    .all(org.id);

  const jobs = db
    .prepare(
      `SELECT id, title, location, type, category, salary, created_at, source, source_url
       FROM jobs
       WHERE organization_id = ?
         AND (approval_status = 'approved' OR approval_status IS NULL)
         AND payment_status IN ('paid', 'waived', 'not_required')
         AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY created_at DESC
       LIMIT 20`
    )
    .all(org.id);

  res.json({
    organization: formatOrganization(org, {
      intent: formatIntentScore(intent),
      metrics: formatEmployerMetrics(metrics),
    }),
    signals: signals.map(formatSignal),
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      location: job.location,
      type: job.type,
      category: job.category,
      salary: job.salary,
      createdAt: job.created_at,
      source: job.source,
      sourceUrl: job.source_url,
    })),
  });
});

export default router;
