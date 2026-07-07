import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { fetchJobsFromSources, upsertExternalJobs, pruneStaleExternalJobs } from './fetchJobs.js';

const demoUser = {
  email: 'demo@haymarket.jobs',
  password: 'Demo1234',
  name: 'Demo User',
};

const adminUser = {
  email: 'admin@haymarket.jobs',
  password: 'Admin1234',
  name: 'Admin User',
};

function ensureUser({ email, password, name, isAdmin }) {
  const existing = db.prepare('SELECT id, is_admin FROM users WHERE email = ?').get(email);

  if (existing) {
    const passwordHash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password_hash = ?, name = ? WHERE id = ?').run(
      passwordHash,
      name,
      existing.id
    );
    if (isAdmin && !existing.is_admin) {
      db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
      console.log(`Promoted ${email} to admin`);
    }
    return existing.id;
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare('INSERT INTO users (email, password_hash, name, is_admin) VALUES (?, ?, ?, ?)')
    .run(email, passwordHash, name, isAdmin ? 1 : 0);

  console.log(`Created ${isAdmin ? 'admin' : 'demo'} user: ${email}`);
  return result.lastInsertRowid;
}

const userId = ensureUser({ ...demoUser, isAdmin: false });
ensureUser({ ...adminUser, isAdmin: true });

console.log('Fetching jobs from real sources...');
const { jobs, sources, total } = await fetchJobsFromSources();

if (total > 0) {
  const { added, updated } = upsertExternalJobs(db, jobs, userId);
  const removed = pruneStaleExternalJobs(db, jobs);
  console.log(`Fetched ${total} jobs from sources:`, sources);
  console.log(`Added ${added} new listings, updated ${updated}, removed ${removed} stale`);
} else {
  console.log('No jobs fetched from external sources. Is the Python service running?');
}

const jobCount = db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count;
console.log(`Database now has ${jobCount} total jobs`);

console.log('\nDemo credentials:');
console.log(`  Email: ${demoUser.email}`);
console.log(`  Password: ${demoUser.password}`);
console.log('\nAdmin credentials:');
console.log(`  Email: ${adminUser.email}`);
console.log(`  Password: ${adminUser.password}`);
