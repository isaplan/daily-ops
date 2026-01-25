const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('🔍 Debugging unified_user structure\n');
    
    // Get records with support_id set
    const withSupportId = await db.collection('unified_user')
      .find({ support_id: { $exists: true } })
      .limit(10)
      .toArray();
    
    console.log(`Records with support_id: ${withSupportId.length}\n`);
    withSupportId.forEach((u, i) => {
      console.log(`${i + 1}. ${u.canonicalName}`);
      console.log(`   support_id: ${u.support_id} (type: ${typeof u.support_id})`);
      console.log(`   hourly_rate: €${u.hourly_rate}`);
    });
    
    console.log('\n---');
    console.log(`Total unified_user: ${await db.collection('unified_user').countDocuments()}`);
    console.log(`With support_id: ${await db.collection('unified_user').countDocuments({ support_id: { $exists: true } })}`);
    console.log(`With hourly_rate: ${await db.collection('unified_user').countDocuments({ hourly_rate: { $exists: true } })}`);
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
