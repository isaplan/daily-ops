/**
 * Check if we have synced data for both Eitje and Bork in the DB.
 * Reports counts and date ranges for eitje_raw_data and bork_raw_data,
 * and cron lastRun for reference.
 *
 * Usage: node scripts/check-eitje-bork-data.js
 */
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops';
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'daily-ops';

function formatDate(d) {
  if (!d || !(d instanceof Date)) return '—';
  return d.toISOString().slice(0, 10);
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);

    const out = { eitje: null, bork: null, cronEitje: null, cronBork: null };

    // Eitje: eitje_raw_data
    const eitjeColl = db.collection('eitje_raw_data');
    const eitjeCount = await eitjeColl.countDocuments();
    const eitjeWithDate = await eitjeColl
      .find({ date: { $exists: true, $ne: null } })
      .sort({ date: 1 })
      .limit(1)
      .toArray();
    const eitjeMaxDate = await eitjeColl
      .find({ date: { $exists: true, $ne: null } })
      .sort({ date: -1 })
      .limit(1)
      .toArray();
    out.eitje = {
      count: eitjeCount,
      minDate: eitjeWithDate[0]?.date,
      maxDate: eitjeMaxDate[0]?.date,
    };

    // Bork: bork_raw_data
    const borkColl = db.collection('bork_raw_data');
    const borkCount = await borkColl.countDocuments();
    const borkMin = await borkColl.find({ date: { $exists: true } }).sort({ date: 1 }).limit(1).toArray();
    const borkMax = await borkColl.find({ date: { $exists: true } }).sort({ date: -1 }).limit(1).toArray();
    out.bork = {
      count: borkCount,
      minDate: borkMin[0]?.date,
      maxDate: borkMax[0]?.date,
    };

    // Cron last run (for reference)
    const cronJob = await db.collection('cron_jobs').findOne({ jobType: 'daily-data' });
    const borkCronJob = await db.collection('bork_cron_jobs').findOne({ jobType: 'daily-data' });
    out.cronEitje = cronJob?.lastRun ? new Date(cronJob.lastRun) : null;
    out.cronBork = borkCronJob?.lastRun ? new Date(borkCronJob.lastRun) : null;

    // Print
    console.log('--- Eitje ---');
    console.log('  eitje_raw_data:', out.eitje.count, 'records');
    console.log('  Date range (date-based records):', formatDate(out.eitje.minDate), '–', formatDate(out.eitje.maxDate));
    console.log('  Cron daily-data lastRun:', out.cronEitje ? out.cronEitje.toISOString() : '—');

    console.log('\n--- Bork ---');
    console.log('  bork_raw_data:', out.bork.count, 'records');
    console.log('  Date range:', formatDate(out.bork.minDate), '–', formatDate(out.bork.maxDate));
    console.log('  Cron daily-data lastRun:', out.cronBork ? out.cronBork.toISOString() : '—');

    const hasEitje = out.eitje.count > 0;
    const hasBork = out.bork.count > 0;
    console.log('\n--- Summary ---');
    console.log('  Eitje has data:', hasEitje ? 'Yes' : 'No');
    console.log('  Bork has data:', hasBork ? 'Yes' : 'No');
    console.log('  Do we have data for both?', hasEitje && hasBork ? 'Yes' : 'No');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
