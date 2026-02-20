/**
 * Migrate collection from v2_daily_ops_dashboard_aggregated to daily_ops_dashboard_aggregated
 * Usage: node scripts/migrate-daily-ops-collection.js
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops';

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    const oldName = 'v2_daily_ops_dashboard_aggregated';
    const newName = 'daily_ops_dashboard_aggregated';

    console.log(`🔄 Migrating ${oldName} → ${newName}...`);

    const collections = await db.listCollections().toArray();
    const oldExists = collections.some((c) => c.name === oldName);
    const newExists = collections.some((c) => c.name === newName);

    if (!oldExists) {
      console.log(`⚠️  Old collection ${oldName} doesn't exist. Nothing to migrate.`);
      process.exit(0);
    }

    if (newExists) {
      console.log(`🗑️  New collection ${newName} already exists. Dropping it first...`);
      await db.dropCollection(newName);
      console.log(`✅ Dropped ${newName}`);
    }

    // Rename collection
    await db.collection(oldName).rename(newName);
    console.log(`✅ Renamed ${oldName} → ${newName}`);

    // Verify
    const count = await db.collection(newName).countDocuments();
    console.log(`📈 Documents in ${newName}: ${count}`);

    console.log('\n✨ Migration complete!');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
