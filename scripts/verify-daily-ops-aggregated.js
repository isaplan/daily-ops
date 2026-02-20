/**
 * Verify v2_daily_ops_dashboard_aggregated collection exists and report count.
 * Usage: node scripts/verify-daily-ops-aggregated.js
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { MongoClient } = require('mongodb');

const COLLECTION = 'daily_ops_dashboard_aggregated';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops';

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    const collections = await db.listCollections().toArray();
    const names = collections.map((c) => c.name);
    const exists = names.includes(COLLECTION);

    console.log('DB:', dbName);
    console.log('Collection', COLLECTION, 'exists:', exists);

    if (exists) {
      const count = await db.collection(COLLECTION).countDocuments();
      console.log('Document count:', count);
      if (count > 0) {
        const sample = await db.collection(COLLECTION).findOne({});
        const keys = sample ? Object.keys(sample) : [];
        console.log('Sample keys:', keys.join(', '));
      }
    } else {
      console.log('All collections:', names.join(', '));
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
