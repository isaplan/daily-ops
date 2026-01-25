const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('👤 Analyzing name mapping between data sources\n');
    
    // Sample time_registration_shifts users
    console.log('📊 Sample users from time_registration_shifts:');
    const shifts = await db.collection('eitje_raw_data')
      .find({ endpoint: 'time_registration_shifts' })
      .limit(10)
      .toArray();
    
    const userSet = new Set();
    shifts.forEach(s => {
      if (s.rawApiResponse?.user?.name) {
        userSet.add(s.rawApiResponse.user.name);
      }
    });
    
    console.log('Unique user names from shifts:');
    Array.from(userSet).slice(0, 10).forEach(u => console.log(`  - "${u}"`));
    
    // Compare with unified_user
    console.log('\n👥 Sample names from unified_user:');
    const unified = await db.collection('unified_user')
      .find({ canonicalName: { $ne: 'Unknown' } })
      .limit(10)
      .toArray();
    
    unified.forEach(u => console.log(`  - "${u.canonicalName}"`));
    
    // Check if support_id from shifts matches unified_user
    console.log('\n🔍 Checking if shifts data has support_id or user.id:');
    const sample = await db.collection('eitje_raw_data').findOne({ endpoint: 'time_registration_shifts' });
    if (sample) {
      console.log('Sample shift:');
      console.log('  user.id:', sample.rawApiResponse?.user?.id);
      console.log('  user.name:', sample.rawApiResponse?.user?.name);
      console.log('  extracted.userId:', sample.extracted?.userId);
    }
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
