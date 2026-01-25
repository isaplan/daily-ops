const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('🧮 Testing cost calculation with unified_user data\n');
    
    // Check time_registration aggregation
    const aggCollection = db.collection('eitje_time_registration_aggregation');
    
    const results = await aggCollection
      .find({ total_hours: { $gt: 0 } })
      .sort({ total_hours: -1 })
      .limit(5)
      .toArray();
    
    console.log('📊 Top 5 aggregated records:\n');
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.user_name || 'Unknown'}`);
      console.log(`   Location: ${r.location_name}`);
      console.log(`   Team: ${r.team_name}`);
      console.log(`   Hours: ${r.total_hours}`);
      console.log(`   Total Cost: €${r.total_cost}`);
      console.log(`   Hourly Rate: €${r.hourly_rate || 'N/A'}`);
      if (r.total_hours && r.total_cost) {
        const calculated = r.total_cost / r.total_hours;
        console.log(`   Calculated hourly: €${calculated.toFixed(2)}`);
      }
      console.log();
    });
    
    // Check unified_user with rates
    const withRates = await db.collection('unified_user')
      .find({ hourly_rate: { $ne: null } })
      .limit(5)
      .toArray();
    
    console.log('\n💰 Sample unified_user with rates:\n');
    withRates.forEach((u, i) => {
      console.log(`${i + 1}. ${u.canonicalName}`);
      console.log(`   Rate: €${u.hourly_rate}`);
      console.log(`   Type: ${u.contract_type}`);
      console.log(`   support_id: ${u.support_id}`);
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
