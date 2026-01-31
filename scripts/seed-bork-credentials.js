/**
 * Seed Bork credentials and locations into api_credentials and locations collections.
 * Run: node scripts/seed-bork-credentials.js
 * Uses MONGODB_URI and MONGODB_DB_NAME from .env.local.
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops';
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'daily-ops';

// Same location names as V2 Bork API settings page
const BORK_CREDENTIALS = [
  {
    locationId: new ObjectId('6916766daf9930f74a6960be'),
    baseUrl: 'https://GGRZ28Q3MDRQ2UQ3MDRQ.trivecgateway.com',
    apiKey: '1f518c6dce0a466d8d0f7c95b0717de4',
    locationName: "Bar Bea",
  },
  {
    locationId: new ObjectId('6916766daf9930f74a6960bc'),
    baseUrl: 'https://7ARQ28QXMGRQ6UUXTGVW2UQ.trivecgateway.com',
    apiKey: '1f518c6dce0a466d8d0f7c95b0717de4',
    locationName: "Van Kinsbergen",
  },
  {
    locationId: new ObjectId('6916766daf9930f74a6960bd'),
    baseUrl: 'https://7JFC2JUXTGVR2UTXUARY28QX.trivecgateway.com',
    apiKey: '1f518c6dce0a466d8d0f7c95b0717de4',
    locationName: "L'Amour Toujours",
  },
];

async function run() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const locationsCol = db.collection('locations');
    const credsCol = db.collection('api_credentials');

    for (const item of BORK_CREDENTIALS) {
      await locationsCol.updateOne(
        { _id: item.locationId },
        {
          $set: {
            name: item.locationName,
            isActive: true,
            updatedAt: new Date(),
            systemMappings: [{ system: 'bork', externalId: item.locationId.toString() }],
          },
          $setOnInsert: {
            code: item.locationId.toString().slice(-6).toUpperCase(),
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
      console.log('Location upserted:', item.locationName, item.locationId.toString());
    }

    for (const item of BORK_CREDENTIALS) {
      const result = await credsCol.updateOne(
        { provider: 'bork', locationId: item.locationId },
        {
          $set: {
            provider: 'bork',
            locationId: item.locationId,
            baseUrl: item.baseUrl,
            apiKey: item.apiKey,
            isActive: true,
            locationName: item.locationName,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      console.log(
        result.upsertedCount ? 'Bork credential inserted:' : 'Bork credential updated:',
        item.locationName,
        item.baseUrl
      );
    }

    const count = await credsCol.countDocuments({ provider: 'bork' });
    console.log('Done. Bork credentials in api_credentials:', count);
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
