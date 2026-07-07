import { Router } from 'express';
import db from '../db.js';
import {
  formatEmployerMetrics,
  formatIntentScore,
  formatOrganization,
  formatSignal,
} from '../services/organizations.js';
import { syncLaborIntelligence } from '../services/intelligenceSync.js';
import { adminRequired } from '../middleware/auth.js';

const router = Router();

router.get('/feed', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const signalType = req.query.type;

  let sql = `
    SELECT labor_signals.*, organizations.name AS organization_name, organizations.slug AS organization_slug
    FROM labor_signals
    JOIN organizations ON organizations.id = labor_signals.organization_id
  `;
  const params = [];

  if (signalType) {
    sql += ' WHERE labor_signals.signal_type = ?';
    params.push(signalType);
  }

  sql += ' ORDER BY COALESCE(labor_signals.occurred_at, labor_signals.created_at) DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  res.json({ signals: rows.map(formatSignal) });
});

router.get('/intent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

  const rows = db
    .prepare(
      `SELECT hiring_intent_scores.*, organizations.name, organizations.slug, organizations.location, organizations.org_type
       FROM hiring_intent_scores
       JOIN organizations ON organizations.id = hiring_intent_scores.organization_id
       ORDER BY hiring_intent_scores.score DESC
       LIMIT ?`
    )
    .all(limit);

  res.json({
    scores: rows.map((row) => ({
      ...formatIntentScore(row),
      organizationName: row.name,
      organizationSlug: row.slug,
      location: row.location,
      orgType: row.org_type,
    })),
  });
});

router.get('/graph', (_req, res) => {
  const orgs = db
    .prepare(
      `SELECT organizations.id, organizations.name, organizations.slug, organizations.location, organizations.org_type,
              hiring_intent_scores.score AS intent_score,
              employer_metrics.active_listings,
              employer_metrics.ghost_rate
       FROM organizations
       LEFT JOIN hiring_intent_scores ON hiring_intent_scores.organization_id = organizations.id
       LEFT JOIN employer_metrics ON employer_metrics.organization_id = organizations.id
       WHERE organizations.id IN (
         SELECT DISTINCT organization_id FROM labor_signals
         UNION
         SELECT DISTINCT organization_id FROM jobs WHERE organization_id IS NOT NULL
       )
       ORDER BY COALESCE(hiring_intent_scores.score, 0) DESC
       LIMIT 60`
    )
    .all();

  const nodes = orgs.map((org, index) => ({
    id: org.id,
    slug: org.slug,
    name: org.name,
    location: org.location,
    orgType: org.org_type,
    intentScore: org.intent_score,
    activeListings: org.active_listings || 0,
    ghostRate: org.ghost_rate,
    cluster: (org.location || 'unknown').split(',')[0].trim().toLowerCase(),
    index,
  }));

  const edges = [];
  const byCluster = new Map();

  for (const node of nodes) {
    if (!byCluster.has(node.cluster)) byCluster.set(node.cluster, []);
    byCluster.get(node.cluster).push(node);
  }

  for (const clusterNodes of byCluster.values()) {
    if (clusterNodes.length < 2) continue;
    for (let i = 0; i < clusterNodes.length - 1; i += 1) {
      const a = clusterNodes[i];
      const b = clusterNodes[i + 1];
      edges.push({
        source: a.id,
        target: b.id,
        type: 'regional_labor_flow',
        weight: Math.min((a.intentScore || 0) + (b.intentScore || 0), 100) / 100,
      });
    }
  }

  const typeGroups = new Map();
  for (const node of nodes) {
    const key = node.orgType || 'Other';
    if (!typeGroups.has(key)) typeGroups.set(key, []);
    typeGroups.get(key).push(node);
  }

  for (const group of typeGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < Math.min(group.length - 1, 2); i += 1) {
      edges.push({
        source: group[i].id,
        target: group[i + 1].id,
        type: 'sector_alignment',
        weight: 0.4,
      });
    }
  }

  res.json({ nodes, edges });
});

router.post('/sync', adminRequired, async (_req, res) => {
  try {
    const result = await syncLaborIntelligence();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Sync failed' });
  }
});

export default router;
