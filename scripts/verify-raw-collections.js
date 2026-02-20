/**
 * Verify raw data collections: document counts and date ranges.
 * Run against actual DB to see what Eitje/Bork historical sync actually populated.
 * Usage: node scripts/verify-raw-collections.js
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { MongoClient } = require('mongodb');

async function getDateRange(db, collectionName, dateField = 'date', extraMatch = {}) {
  const col = db.collection(collectionName);
  const count = await col.countDocuments(extraMatch);
  if (count === 0) return { count: 0, dates: [], min: null, max: null };

  const pipeline = [
    { $match: extraMatch },
    { $group: { _id: null, min: { $min: '$' + dateField }, max: { $max: '$' + dateField } } },
  ];
  const range = await col.aggregate(pipeline).toArray();
  const min = range[0]?.min;
  const max = range[0]?.max;

  // Distinct dates (as YYYY-MM-DD)
  const datePipeline = [
    { $match: extraMatch },
    { $project: { d: { $dateToString: { format: '%Y-%m-%d', date: '$' + dateField } } } },
    { $group: { _id: '$d' } },
    { $sort: { _id: 1 } },
    { $limit: 100 },
  ];
  const datesResult = await col.aggregate(datePipeline).toArray();
  const dates = datesResult.map((x) => x._id);

  return { count, dates, min: min ? new Date(min).toISOString().slice(0, 10) : null, max: max ? new Date(max).toISOString().slice(0, 10) : null };
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops';

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    console.log('=== Raw data collections (actual DB)\n');
    console.log('DB:', dbName);
    console.log('');

    // 1) eitje_raw_data (where Eitje historical sync writes)
    let colList = await db.listCollections().toArray();
    const hasEitjeRaw = colList.some((c) => c.name === 'eitje_raw_data');
    if (hasEitjeRaw) {
      const total = await db.collection('eitje_raw_data').countDocuments({});
      const timeReg = await db.collection('eitje_raw_data').countDocuments({ endpoint: 'time_registration_shifts' });
      const tr = await getDateRange(db, 'eitje_raw_data', 'date', { endpoint: 'time_registration_shifts' });
      console.log('eitje_raw_data (Eitje sync target)');
      console.log('  Total documents:', total);
      console.log('  time_registration_shifts:', timeReg);
      console.log('  Date range (time_registration_shifts):', tr.min ?? 'N/A', '→', tr.max ?? 'N/A');
      console.log('  Unique dates (time_registration_shifts):', tr.dates.length, tr.dates.length <= 15 ? tr.dates.join(', ') : tr.dates.slice(0, 5).join(', ') + ' ... ' + tr.dates.slice(-3).join(', '));
      console.log('');
    } else {
      console.log('eitje_raw_data: collection does not exist');
      console.log('');
    }

    // 2) bork_raw_data (where Bork historical sync writes)
    const hasBorkRaw = colList.some((c) => c.name === 'bork_raw_data');
    if (hasBorkRaw) {
      const br = await getDateRange(db, 'bork_raw_data', 'date');
      console.log('bork_raw_data (Bork sync target)');
      console.log('  Total documents:', br.count);
      console.log('  Date range:', br.min ?? 'N/A', '→', br.max ?? 'N/A');
      console.log('  Unique dates:', br.dates.length, br.dates.length <= 15 ? br.dates.join(', ') : br.dates.slice(0, 5).join(', ') + ' ... ' + br.dates.slice(-3).join(', '));
      console.log('');
    } else {
      console.log('bork_raw_data: collection does not exist');
      console.log('');
    }

    // 3) test-eitje-hours (what Daily Ops labor aggregation reads)
    const hasTestEitje = colList.some((c) => c.name === 'test-eitje-hours');
    if (hasTestEitje) {
      const te = await getDateRange(db, 'test-eitje-hours', 'date');
      console.log('test-eitje-hours (Daily Ops labor source)');
      console.log('  Total documents:', te.count);
      console.log('  Date range:', te.min ?? 'N/A', '→', te.max ?? 'N/A');
      console.log('  Unique dates:', te.dates.length, te.dates.join(', '));
      console.log('');
    } else {
      console.log('test-eitje-hours: collection does not exist');
      console.log('');
    }

    // 4) test-bork-sales-unified (what Daily Ops sales aggregation reads)
    const hasTestBork = colList.some((c) => c.name === 'test-bork-sales-unified');
    if (hasTestBork) {
      const tb = await getDateRange(db, 'test-bork-sales-unified', 'date');
      console.log('test-bork-sales-unified (Daily Ops sales source)');
      console.log('  Total documents:', tb.count);
      console.log('  Date range:', tb.min ?? 'N/A', '→', tb.max ?? 'N/A');
      console.log('  Unique dates:', tb.dates.length, tb.dates.join(', ') || 'none');
      console.log('');
    } else {
      console.log('test-bork-sales-unified: collection does not exist');
      console.log('');
    }

    console.log('---');
    console.log('Daily Ops aggregation discovers dates from: test-eitje-hours + test-bork-sales-unified.');
    console.log('If you ran historical sync, data is in eitje_raw_data / bork_raw_data; sync those into test-* to aggregate all dates.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
