const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    
    // List all databases
    const admin = client.db('admin');
    const dbs = await admin.admin().listDatabases();
    console.log('All databases:', dbs.databases.map(d => d.name));
    
    // Check daily-ops (with hyphen)
    const db = client.db('daily-ops');
    const collections = await db.listCollections().toArray();
    console.log('\n"daily-ops" collections:', collections.map(c => c.name));
    
    if (collections.find(c => c.name === 'eitje_raw_data')) {
      const count = await db.collection('eitje_raw_data').countDocuments();
      console.log('eitje_raw_data count:', count);
      
      const sample = await db.collection('eitje_raw_data').findOne({});
      if (sample) {
        console.log('\nSample record:');
        console.log('  endpoint:', sample.endpoint);
        console.log('  extracted.id:', sample.extracted?.id);
        console.log('  extracted.name:', sample.extracted?.name);
        console.log('  extracted.hourlyRate:', sample.extracted?.hourlyRate);
      }
    }
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
