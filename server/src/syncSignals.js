import 'dotenv/config';
import db from './db.js';
import { reindexOrganizationsFromJobs } from './services/employerMetrics.js';
import { syncLaborIntelligence } from './services/intelligenceSync.js';

console.log('Indexing organizations from jobs...');
const linked = reindexOrganizationsFromJobs();
console.log(`Linked ${linked} jobs to organizations`);

console.log('Syncing labor intelligence signals...');
const result = await syncLaborIntelligence();
console.log(
  `Signals: ${result.signals} total (${result.added} added, ${result.updated} updated), ` +
    `${result.organizations} organizations touched`
);
