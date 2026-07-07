import 'dotenv/config';
import db from './db.js';
import { fetchJobsFromSources, upsertExternalJobs, pruneStaleExternalJobs } from './fetchJobs.js';
import { reindexOrganizationsFromJobs } from './services/employerMetrics.js';
import { syncLaborIntelligence } from './services/intelligenceSync.js';

const systemUser = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
if (!systemUser) {
  console.error('No users in database. Run npm run seed first.');
  process.exit(1);
}

console.log('Syncing jobs from real sources...');
const { jobs, sources, total } = await fetchJobsFromSources();

if (total === 0) {
  console.error('No jobs returned. Ensure the Python service is running.');
  process.exit(1);
}

const { added, updated } = upsertExternalJobs(db, jobs, systemUser.id);
const removed = pruneStaleExternalJobs(db, jobs);
const linked = reindexOrganizationsFromJobs();
const intelligence = await syncLaborIntelligence();
console.log(`Sources:`, sources);
console.log(`Fetched ${total} jobs, added ${added}, updated ${updated}, removed ${removed} stale`);
console.log(`Organizations linked: ${linked}, intelligence signals: ${intelligence.signals}`);
