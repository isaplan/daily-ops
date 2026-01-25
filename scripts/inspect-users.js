const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily_ops');
    
    console.log('=== Users data sample ===');
    const userSample = await db.collection('eitje_raw_data').findOne({ endpoint: 'users' });
    if (userSample) {
      console.log('Keys in rawApiResponse:', Object.keys(userSample.rawApiResponse || {}));
      console.log('Keys in extracted:', Object.keys(userSample.extracted || {}));
      console.log('\nFull user object:');
      console.log(JSON.stringify(userSample, null, 2));
    } else {
      console.log('No users found');
    }
    
    console.log('\n=== Check for hourly_rate fields ===');
    const users = await db.collection('eitje_raw_data').find({ endpoint: 'users' }).limit(3).toArray();
    users.forEach((u, i) => {
      console.log(`\nUser ${i}:`);
      console.log('  rawApiResponse keys:', Object.keys(u.rawApiResponse || {}));
      console.log('  extracted.hourlyRate:', u.extracted?.hourlyRate);
      console.log('  extracted.name:', u.extracted?.name);
      console.log('  extracted.id:', u.extracted?.id);
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
