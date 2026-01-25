const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('🧹 Clearing aggregation lock...');
    await db.collection('eitje_aggregation_lock').deleteMany({});
    console.log('✓ Lock cleared');
    
    console.log('\n🔄 Clearing aggregation collections...');
    const cleared1 = await db.collection('eitje_time_registration_aggregation').deleteMany({});
    console.log(`✓ Deleted ${cleared1.deletedCount} old aggregation records`);
    
    const cleared2 = await db.collection('eitje_planning_registration_aggregation').deleteMany({});
    console.log(`✓ Deleted ${cleared2.deletedCount} old planning records`);
    
    console.log('\n✅ Ready for re-aggregation. Triggering sync...');
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
