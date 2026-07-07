import db from '../db.js';
import { findOrCreateOrganization } from './organizations.js';
import { computeEmployerMetrics } from './employerMetrics.js';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
const MIRA_WEBHOOK_URL = process.env.MIRA_WEBHOOK_URL;

export async function fetchIntelligenceFromPython(context) {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/intelligence/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      console.warn('Intelligence ingest failed:', response.status);
      return { signals: [], intentScores: [] };
    }

    return response.json();
  } catch (error) {
    console.warn('Intelligence ingest unavailable:', error.message);
    return { signals: [], intentScores: [] };
  }
}

function upsertSignal(signal) {
  const org = findOrCreateOrganization(db, {
    name: signal.organizationName,
    location: signal.location,
    orgType: signal.orgType,
  });

  const externalKey = signal.externalId || `${signal.source}:${signal.signalType}:${signal.title}`;
  const existing = db
    .prepare('SELECT id FROM labor_signals WHERE external_id = ? AND source = ?')
    .get(externalKey, signal.source);

  if (existing) {
    db.prepare(
      `UPDATE labor_signals
       SET title = ?, description = ?, confidence = ?, score = ?, lead_weeks = ?,
           occurred_at = ?, metadata = ?
       WHERE id = ?`
    ).run(
      signal.title,
      signal.description,
      signal.confidence,
      signal.score,
      signal.leadWeeks,
      signal.occurredAt || null,
      JSON.stringify(signal.metadata || {}),
      existing.id
    );
    return { updated: true, organizationId: org.id };
  }

  db.prepare(
    `INSERT INTO labor_signals (
      organization_id, signal_type, title, description, source, source_url,
      external_id, confidence, score, lead_weeks, occurred_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    org.id,
    signal.signalType,
    signal.title,
    signal.description,
    signal.source,
    signal.sourceUrl || null,
    externalKey,
    signal.confidence,
    signal.score,
    signal.leadWeeks,
    signal.occurredAt || null,
    JSON.stringify(signal.metadata || {})
  );

  return { added: true, organizationId: org.id };
}

function upsertIntentScore(entry) {
  db.prepare(
    `INSERT INTO hiring_intent_scores (organization_id, score, lead_weeks, summary, computed_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(organization_id) DO UPDATE SET
       score = excluded.score,
       lead_weeks = excluded.lead_weeks,
       summary = excluded.summary,
       computed_at = datetime('now')`
  ).run(entry.organizationId, entry.score, entry.leadWeeks, entry.summary);
}

function deriveSignalsFromJobs() {
  const signals = [];
  const surgeOrgs = db
    .prepare(
      `SELECT company, location, type, COUNT(*) AS job_count,
              MAX(created_at) AS latest_post
       FROM jobs
       WHERE created_at >= datetime('now', '-30 days')
       GROUP BY company
       HAVING job_count >= 2`
    )
    .all();

  for (const row of surgeOrgs) {
    signals.push({
      organizationName: row.company,
      location: row.location,
      orgType: row.type,
      signalType: 'hiring_surge',
      title: `${row.company} posting velocity increased`,
      description: `${row.job_count} labor-aligned listings in the last 30 days on Haymarket.`,
      source: 'haymarket',
      confidence: 0.72,
      score: Math.min(40 + row.job_count * 8, 85),
      leadWeeks: 2,
      occurredAt: row.latest_post,
      externalId: `haymarket:surge:${row.company}`,
      metadata: { jobCount: row.job_count },
    });
  }

  const recentJobs = db
    .prepare(
      `SELECT id, title, company, location, type, source, source_url, created_at
       FROM jobs
       WHERE created_at >= datetime('now', '-14 days')
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .all();

  for (const job of recentJobs) {
    signals.push({
      organizationName: job.company,
      location: job.location,
      orgType: job.type,
      signalType: 'job_posted',
      title: `${job.company} posted ${job.title}`,
      description: `New ${job.type} role observed on Haymarket.`,
      source: job.source || 'haymarket',
      sourceUrl: job.source_url,
      confidence: 0.95,
      score: 35,
      leadWeeks: 0,
      occurredAt: job.created_at,
      externalId: `haymarket:job:${job.id}`,
      metadata: { jobId: job.id, jobTitle: job.title },
    });
  }

  return signals;
}

export async function syncLaborIntelligence() {
  const organizations = db
    .prepare('SELECT id, name, slug, location, org_type FROM organizations')
    .all();

  const jobs = db
    .prepare(
      `SELECT company, location, type, COUNT(*) AS job_count
       FROM jobs GROUP BY company`
    )
    .all();

  const localSignals = deriveSignalsFromJobs();
  const pythonPayload = await fetchIntelligenceFromPython({ organizations, jobs });

  const allSignals = [...localSignals, ...(pythonPayload.signals || [])];
  let added = 0;
  let updated = 0;
  const touchedOrgIds = new Set();

  for (const signal of allSignals) {
    const result = upsertSignal(signal);
    if (result.added) added += 1;
    if (result.updated) updated += 1;
    touchedOrgIds.add(result.organizationId);
  }

  const intentScores = pythonPayload.intentScores || [];
  for (const entry of intentScores) {
    let orgId = entry.organizationId;
    if (!orgId && entry.organizationName) {
      const org = findOrCreateOrganization(db, {
        name: entry.organizationName,
        location: entry.location,
        orgType: entry.orgType,
      });
      orgId = org.id;
    }
    if (orgId) {
      upsertIntentScore({
        organizationId: orgId,
        score: entry.score,
        leadWeeks: entry.leadWeeks,
        summary: entry.summary,
      });
      touchedOrgIds.add(orgId);
    }
  }

  for (const orgId of touchedOrgIds) {
    if (!intentScores.some((entry) => entry.organizationId === orgId)) {
      const aggregate = db
        .prepare(
          `SELECT organization_id, MAX(score) AS score, MIN(lead_weeks) AS lead_weeks,
                  GROUP_CONCAT(title, ' · ') AS titles
           FROM labor_signals
           WHERE organization_id = ?
           GROUP BY organization_id`
        )
        .get(orgId);

      if (aggregate) {
        upsertIntentScore({
          organizationId: orgId,
          score: aggregate.score,
          leadWeeks: aggregate.lead_weeks ?? 4,
          summary: aggregate.titles?.slice(0, 280) || 'Hiring activity detected',
        });
      }
    }
    computeEmployerMetrics(orgId);
  }

  if (MIRA_WEBHOOK_URL) {
    await pushSignalsToMira(allSignals.slice(0, 25));
  }

  return { added, updated, signals: allSignals.length, organizations: touchedOrgIds.size };
}

async function pushSignalsToMira(signals) {
  for (const signal of signals) {
    try {
      await fetch(MIRA_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal_type: 'hiring',
          company_name: signal.organizationName,
          title: signal.title,
          description: signal.description,
          source_url: signal.sourceUrl,
          confidence: signal.confidence,
          score: signal.score,
          priority: signal.score >= 70 ? 'high' : signal.score >= 45 ? 'medium' : 'low',
          metadata: signal.metadata || {},
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // optional integration
    }
  }
}
