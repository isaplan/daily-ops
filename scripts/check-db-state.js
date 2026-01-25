const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily_ops');
    
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    if (collections.find(c => c.name === 'eitje_raw_data')) {
      const count = await db.collection('eitje_raw_data').countDocuments();
      console.log('\nTotal records in eitje_raw_data:', count);
      
      const sample = await db.collection('eitje_raw_data').findOne({});
      console.log('\nSample record keys:', sample ? Object.keys(sample) : 'none');
    }
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
