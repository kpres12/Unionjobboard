export function slugifyOrganization(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function findOrCreateOrganization(db, { name, location, orgType }) {
  const slug = slugifyOrganization(name);
  let org = db.prepare('SELECT * FROM organizations WHERE slug = ?').get(slug);

  if (!org) {
    const result = db
      .prepare(
        `INSERT INTO organizations (name, slug, location, org_type)
         VALUES (?, ?, ?, ?)`
      )
      .run(name.trim(), slug, location || null, orgType || null);
    org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(result.lastInsertRowid);
  }

  return org;
}

export function formatOrganization(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    location: row.location,
    orgType: row.org_type,
    domain: row.domain,
    description: row.description,
    createdAt: row.created_at,
    ...extras,
  };
}

export function formatSignal(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    signalType: row.signal_type,
    title: row.title,
    description: row.description,
    source: row.source,
    sourceUrl: row.source_url,
    confidence: row.confidence,
    score: row.score,
    leadWeeks: row.lead_weeks,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

export function formatIntentScore(row) {
  if (!row) return null;
  return {
    organizationId: row.organization_id,
    score: row.score,
    leadWeeks: row.lead_weeks,
    summary: row.summary,
    computedAt: row.computed_at,
  };
}

export function formatEmployerMetrics(row) {
  if (!row) return null;
  return {
    organizationId: row.organization_id,
    applicationCount: row.application_count,
    pendingApplications: row.pending_applications,
    reviewedRate: row.reviewed_rate,
    acceptedRate: row.accepted_rate,
    ghostRate: row.ghost_rate,
    medianResponseDays: row.median_response_days,
    activeListings: row.active_listings,
    computedAt: row.computed_at,
  };
}
