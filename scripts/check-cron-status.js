/**
 * Check if cron jobs are configured, active, and have run.
 * Cron runs in-process (node-cron): only when the Next.js app is running
 * and after the cron API has been hit at least once (lazy init).
 *
 * Usage: node scripts/check-cron-status.js
 */
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops';
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'daily-ops';

function formatDate(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? '—' : date.toISOString();
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);

    console.log('=== Eitje cron (cron_jobs) ===\n');
    const eitjeJobs = await db.collection('cron_jobs').find({}).toArray();
    if (eitjeJobs.length === 0) {
      console.log('  No Eitje cron jobs in DB. Toggle "Enable Daily Data Sync" in Eitje API settings to create.\n');
    } else {
      for (const j of eitjeJobs) {
        console.log(`  ${j.jobType}:`);
        console.log(`    exists: yes`);
        console.log(`    isActive: ${j.isActive}`);
        console.log(`    schedule: ${j.schedule}`);
        console.log(`    lastRun: ${formatDate(j.lastRun)}`);
        console.log('');
      }
    }

    console.log('=== Bork cron (bork_cron_jobs) ===\n');
    const borkJobs = await db.collection('bork_cron_jobs').find({}).toArray();
    if (borkJobs.length === 0) {
      console.log('  No Bork cron jobs in DB. Toggle "Enable Daily Data Sync" in Bork API settings to create.\n');
    } else {
      for (const j of borkJobs) {
        console.log(`  ${j.jobType}:`);
        console.log(`    exists: yes`);
        console.log(`    isActive: ${j.isActive}`);
        console.log(`    schedule: ${j.schedule}`);
        console.log(`    lastRun: ${formatDate(j.lastRun)}`);
        console.log('');
      }
    }

    const eitjeDaily = eitjeJobs.find((j) => j.jobType === 'daily-data');
    const borkDaily = borkJobs.find((j) => j.jobType === 'daily-data');

    console.log('--- Summary ---');
    console.log('  Eitje daily-data: ', eitjeDaily ? (eitjeDaily.isActive ? 'active' : 'inactive (toggle ON in settings)') : 'not configured');
    console.log('  Bork daily-data:  ', borkDaily ? (borkDaily.isActive ? 'active' : 'inactive (toggle ON in settings)') : 'not configured');
    console.log('');
    console.log('  Is cron *running*? Cron runs inside the Next.js process (node-cron).');
    console.log('  - App must be running: npm run dev or npm run start');
    console.log('  - Manager starts on first API hit: open Daily Ops → Settings → Eitje API or Bork API → Cron Jobs tab once');
    console.log('  - Then it runs at the scheduled times (e.g. 01:00, 08:00, 15:00... Amsterdam)');
    console.log('  - If the app is stopped, no cron runs until you start it again.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
