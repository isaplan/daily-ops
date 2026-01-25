const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('🧹 Clearing aggregation...');
    await db.collection('eitje_aggregation_lock').deleteMany({});
    await db.collection('eitje_time_registration_aggregation').deleteMany({});
    await db.collection('eitje_planning_registration_aggregation').deleteMany({});
    console.log('✓ Cleared');
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
