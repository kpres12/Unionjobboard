import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/jobboard.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    auth_provider TEXT DEFAULT 'local',
    google_id TEXT UNIQUE,
    apple_id TEXT UNIQUE,
    role TEXT DEFAULT 'seeker' CHECK (role IN ('seeker', 'poster', 'both')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    salary TEXT,
    contact_email TEXT NOT NULL,
    posted_by INTEGER NOT NULL,
    source TEXT,
    source_url TEXT,
    external_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (posted_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    cover_letter TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
    match_score REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(job_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all();
const userColumnNames = userColumns.map((col) => col.name);

const userMigrations = [
  ['is_admin', 'ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0'],
  ['auth_provider', "ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local'"],
  ['google_id', 'ALTER TABLE users ADD COLUMN google_id TEXT'],
  ['apple_id', 'ALTER TABLE users ADD COLUMN apple_id TEXT'],
  ['role', "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'seeker'"],
  ['stripe_customer_id', 'ALTER TABLE users ADD COLUMN stripe_customer_id TEXT'],
  ['subscription_status', "ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'inactive'"],
  ['subscription_plan_id', 'ALTER TABLE users ADD COLUMN subscription_plan_id TEXT'],
  ['subscription_current_period_end', 'ALTER TABLE users ADD COLUMN subscription_current_period_end TEXT'],
  ['subscription_cancel_at_period_end', 'ALTER TABLE users ADD COLUMN subscription_cancel_at_period_end INTEGER DEFAULT 0'],
];

for (const [name, sql] of userMigrations) {
  if (!userColumnNames.includes(name)) {
    db.exec(sql);
  }
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id) WHERE apple_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
`);

const jobColumns = db.prepare('PRAGMA table_info(jobs)').all();
const jobColumnNames = jobColumns.map((col) => col.name);
if (!jobColumnNames.includes('source')) db.exec('ALTER TABLE jobs ADD COLUMN source TEXT');
if (!jobColumnNames.includes('source_url')) db.exec('ALTER TABLE jobs ADD COLUMN source_url TEXT');
if (!jobColumnNames.includes('external_id')) db.exec('ALTER TABLE jobs ADD COLUMN external_id TEXT');
if (!jobColumnNames.includes('published_at')) db.exec('ALTER TABLE jobs ADD COLUMN published_at TEXT');
if (!jobColumnNames.includes('approval_status')) {
  db.exec("ALTER TABLE jobs ADD COLUMN approval_status TEXT DEFAULT 'approved'");
  db.exec("UPDATE jobs SET approval_status = 'pending' WHERE type = 'B-Corp'");
}
if (!jobColumnNames.includes('listing_tier')) db.exec('ALTER TABLE jobs ADD COLUMN listing_tier TEXT');
if (!jobColumnNames.includes('payment_status')) {
  db.exec("ALTER TABLE jobs ADD COLUMN payment_status TEXT DEFAULT 'not_required'");
}
if (!jobColumnNames.includes('expires_at')) db.exec('ALTER TABLE jobs ADD COLUMN expires_at TEXT');
if (!jobColumnNames.includes('featured_until')) db.exec('ALTER TABLE jobs ADD COLUMN featured_until TEXT');
if (!jobColumnNames.includes('stripe_checkout_session_id')) {
  db.exec('ALTER TABLE jobs ADD COLUMN stripe_checkout_session_id TEXT');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    location TEXT,
    org_type TEXT,
    domain TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS labor_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    signal_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    source_url TEXT,
    external_id TEXT,
    confidence REAL DEFAULT 0.5,
    score REAL DEFAULT 0,
    lead_weeks INTEGER DEFAULT 4,
    occurred_at TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_labor_signals_external
    ON labor_signals(source, external_id) WHERE external_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS hiring_intent_scores (
    organization_id INTEGER PRIMARY KEY,
    score REAL NOT NULL DEFAULT 0,
    lead_weeks INTEGER DEFAULT 4,
    summary TEXT,
    computed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS employer_metrics (
    organization_id INTEGER PRIMARY KEY,
    application_count INTEGER DEFAULT 0,
    pending_applications INTEGER DEFAULT 0,
    reviewed_rate REAL,
    accepted_rate REAL,
    ghost_rate REAL,
    median_response_days REAL,
    active_listings INTEGER DEFAULT 0,
    computed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_labor_signals_org ON labor_signals(organization_id);
  CREATE INDEX IF NOT EXISTS idx_labor_signals_occurred ON labor_signals(occurred_at);
`);

if (!jobColumnNames.includes('organization_id')) {
  db.exec('ALTER TABLE jobs ADD COLUMN organization_id INTEGER REFERENCES organizations(id)');
}

db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_organization ON jobs(organization_id)');

db.exec(`
  UPDATE jobs SET payment_status = 'not_required' WHERE external_id IS NOT NULL;
  UPDATE jobs
  SET payment_status = 'waived', listing_tier = COALESCE(listing_tier, 'community')
  WHERE external_id IS NULL AND (payment_status IS NULL OR payment_status = 'not_required');
`);

db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_external ON jobs(source, external_id);`);

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}/;

function repairCorruptedJobRows() {
  db.prepare(
    `UPDATE jobs
     SET created_at = source, source = NULL
     WHERE source GLOB '????-??-??*'
       AND (external_id IS NULL OR external_id = '')`
  ).run();

  const rows = db
    .prepare(
      `SELECT id, source, source_url, external_id, created_at
       FROM jobs
       WHERE source GLOB '????-??-??*'
          OR external_id GLOB 'http*'
          OR (created_at NOT GLOB '????-??-??*' AND created_at NOT NULL)`
    )
    .all();

  const update = db.prepare(
    `UPDATE jobs
     SET source = ?, source_url = ?, external_id = ?, created_at = ?
     WHERE id = ?`
  );

  for (const row of rows) {
    if (!DATETIME_RE.test(String(row.source)) || !String(row.external_id).startsWith('http')) {
      continue;
    }

    const fixedCreatedAt = row.source;
    const fixedSourceUrl = row.external_id;
    const fixedExternalId = row.created_at;
    const fixedSource = String(fixedExternalId).split('-')[0] || 'imported';

    update.run(fixedSource, fixedSourceUrl, fixedExternalId, fixedCreatedAt, row.id);
  }
}

repairCorruptedJobRows();

const jobsTableSql = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'jobs'")
  .get()?.sql;

if (jobsTableSql?.includes("'Union', 'Co-op')") && !jobsTableSql.includes('Nonprofit')) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  db.exec(`
    CREATE TABLE jobs_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      salary TEXT,
      contact_email TEXT NOT NULL,
      posted_by INTEGER NOT NULL,
      source TEXT,
      source_url TEXT,
      external_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (posted_by) REFERENCES users(id)
    );
  `);
  db.exec('INSERT INTO jobs_new SELECT * FROM jobs');
  db.exec('DROP TABLE jobs');
  db.exec('ALTER TABLE jobs_new RENAME TO jobs');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_external ON jobs(source, external_id)');
  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');
}

export default db;
