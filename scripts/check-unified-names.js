const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('=== Sample unified_user records ===\n');
    const samples = await db.collection('unified_user')
      .find({})
      .limit(15)
      .toArray();
    
    samples.forEach((u, i) => {
      console.log(`${i + 1}. ${u.canonicalName || 'Unknown'}`);
      console.log(`   canonicalName: "${u.canonicalName}"`);
      console.log(`   eitjeNames: ${JSON.stringify(u.eitjeNames)}`);
      console.log(`   eitjeIds: ${JSON.stringify(u.eitjeIds)}`);
      console.log(`   allIdValues: ${JSON.stringify(u.allIdValues)}`);
      console.log(`   support_id: ${u.support_id}`);
      console.log();
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
