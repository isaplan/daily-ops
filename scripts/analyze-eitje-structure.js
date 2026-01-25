const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('=== ENDPOINT BREAKDOWN ===');
    const endpoints = await db.collection('eitje_raw_data').aggregate([
      { $group: { _id: '$endpoint', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    endpoints.forEach(e => console.log(`${e._id}: ${e.count}`));
    
    console.log('\n=== USERS DATA (endpoint=users) ===');
    const users = await db.collection('eitje_raw_data')
      .find({ endpoint: 'users' })
      .limit(5)
      .toArray();
    
    users.forEach((u, i) => {
      console.log(`\n--- User ${i} ---`);
      console.log('ID:', u.extracted?.id);
      console.log('Name:', u.extracted?.name);
      console.log('Email:', u.extracted?.email);
      console.log('Hourly Rate:', u.extracted?.hourlyRate);
      console.log('Wage:', u.extracted?.wage);
      console.log('Rate:', u.extracted?.rate);
      console.log('Contract Type:', u.extracted?.contractType);
      console.log('Team ID:', u.extracted?.teamId);
      console.log('Raw API Response sample keys:');
      const rawKeys = Object.keys(u.rawApiResponse || {}).slice(0, 20);
      console.log(rawKeys);
      console.log('\nRaw API object:');
      console.log(JSON.stringify(u.rawApiResponse, null, 2).slice(0, 800));
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
