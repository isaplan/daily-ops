const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily_ops');
    
    const count = await db.collection('eitje_raw_data').countDocuments();
    console.log('Total eitje_raw_data records:', count);
    
    const userCount = await db.collection('eitje_raw_data').countDocuments({ endpoint: 'users' });
    console.log('Users records:', userCount);
    
    console.log('\n=== First 3 users ===');
    const users = await db.collection('eitje_raw_data')
      .find({ endpoint: 'users' })
      .limit(3)
      .toArray();
    
    users.forEach((u, i) => {
      console.log(`\n--- User ${i} ---`);
      console.log('ID:', u.extracted?.id);
      console.log('Name:', u.extracted?.name);
      console.log('Email:', u.extracted?.email);
      console.log('Hourly Rate:', u.extracted?.hourlyRate);
      console.log('Contract Type:', u.extracted?.contractType);
      console.log('Team ID:', u.extracted?.teamId);
      console.log('Team Name:', u.extracted?.teamName);
      console.log('Raw Keys:', Object.keys(u.rawApiResponse || {}).slice(0, 15));
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
