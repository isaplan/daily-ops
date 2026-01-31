/**
 * Check if the last cron run actually fetched and stored new data.
 * Counts records in eitje_raw_data and bork_raw_data created/updated
 * in a window around the last run time.
 *
 * Usage: node scripts/check-last-cron-writes.js
 */
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops';
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'daily-ops';

// Window: from 2 min before lastRun to 15 min after (cron run can take a bit)
const WINDOW_BEFORE_MS = 2 * 60 * 1000;
const WINDOW_AFTER_MS = 15 * 60 * 1000;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);

    const eitjeCron = await db.collection('cron_jobs').findOne({ jobType: 'daily-data' });
    const borkCron = await db.collection('bork_cron_jobs').findOne({ jobType: 'daily-data' });

    const eitjeLastRun = eitjeCron?.lastRun ? new Date(eitjeCron.lastRun) : null;
    const borkLastRun = borkCron?.lastRun ? new Date(borkCron.lastRun) : null;

    console.log('Last run times (UTC):');
    console.log('  Eitje daily-data:', eitjeLastRun ? eitjeLastRun.toISOString() : '—');
    console.log('  Bork daily-data: ', borkLastRun ? borkLastRun.toISOString() : '—');
    console.log('');

    // Eitje: records are $set with createdAt on every sync
    if (eitjeLastRun) {
      const eitjeStart = new Date(eitjeLastRun.getTime() - WINDOW_BEFORE_MS);
      const eitjeEnd = new Date(eitjeLastRun.getTime() + WINDOW_AFTER_MS);
      const eitjeWritten = await db.collection('eitje_raw_data').countDocuments({
        createdAt: { $gte: eitjeStart, $lte: eitjeEnd },
      });
      console.log('Eitje (eitje_raw_data):');
      console.log('  Records with createdAt in [lastRun - 2m, lastRun + 15m]:', eitjeWritten);
      console.log('  Did last run store new/updated data?', eitjeWritten > 0 ? 'Yes' : 'No (or no date-based records changed)');
      console.log('');
    }

    // Bork: updatedAt on every upsert, createdAt on insert
    if (borkLastRun) {
      const borkStart = new Date(borkLastRun.getTime() - WINDOW_BEFORE_MS);
      const borkEnd = new Date(borkLastRun.getTime() + WINDOW_AFTER_MS);
      const borkUpdated = await db.collection('bork_raw_data').countDocuments({
        updatedAt: { $gte: borkStart, $lte: borkEnd },
      });
      const borkCreated = await db.collection('bork_raw_data').countDocuments({
        createdAt: { $gte: borkStart, $lte: borkEnd },
      });
      console.log('Bork (bork_raw_data):');
      console.log('  Records with updatedAt in [lastRun - 2m, lastRun + 15m]:', borkUpdated);
      console.log('  Records with createdAt in same window:', borkCreated);
      console.log('  Did last run store new/updated data?', borkUpdated > 0 || borkCreated > 0 ? 'Yes' : 'No');
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
