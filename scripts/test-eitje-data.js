const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily_ops');
    
    // Check what collections exist
    const collections = await db.listCollections().toArray();
    console.log('=== Collections ===');
    collections.forEach(c => console.log('-', c.name));
    
    // Check eitje_raw_data for structure
    console.log('\n=== eitje_raw_data sample ===');
    const rawSample = await db.collection('eitje_raw_data').findOne({});
    console.log(JSON.stringify(rawSample, null, 2));
    
    // Check for users endpoint data
    console.log('\n=== eitje_raw_data where endpoint=users ===');
    const usersSample = await db.collection('eitje_raw_data').findOne({ endpoint: 'users' });
    console.log(JSON.stringify(usersSample, null, 2));
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
