const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('=== TIME_REGISTRATION_SHIFTS SAMPLE ===\n');
    const shifts = await db.collection('eitje_raw_data')
      .find({ endpoint: 'time_registration_shifts' })
      .limit(3)
      .toArray();
    
    shifts.forEach((s, i) => {
      console.log(`\n--- Shift ${i} ---`);
      console.log('User ID:', s.extracted?.userId);
      console.log('Hours:', s.extracted?.hours || s.extracted?.hoursWorked);
      console.log('Amount In Cents:', s.extracted?.amountInCents);
      console.log('Amount:', s.extracted?.amount);
      console.log('Hourly Rate:', s.extracted?.hourlyRate);
      console.log('Revenue:', s.extracted?.revenue);
      console.log('\nRaw API keys:');
      const rawKeys = Object.keys(s.rawApiResponse || {});
      console.log(rawKeys);
      console.log('\nRaw API (truncated):');
      console.log(JSON.stringify(s.rawApiResponse, null, 2).slice(0, 600));
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
