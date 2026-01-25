const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('\n=== RAW DATA SAMPLE ===');
    const rawSample = await db.collection('eitje_raw_data').findOne({endpoint: 'time_registration_shifts'});
    if (rawSample) {
      console.log('Endpoint:', rawSample.endpoint);
      console.log('Has extracted:', !!rawSample.extracted);
      console.log('Extracted keys:', rawSample.extracted ? Object.keys(rawSample.extracted).slice(0, 20) : 'NONE');
      console.log('User ID from extracted:', rawSample.extracted?.userId);
      console.log('User ID from raw:', rawSample.rawApiResponse?.user_id);
      console.log('Hours from extracted:', rawSample.extracted?.hours);
      console.log('Amount from extracted:', rawSample.extracted?.amount);
    }
    
    console.log('\n=== UNIFIED USER SAMPLE ===');
    const userSample = await db.collection('unified_user').findOne({});
    if (userSample) {
      console.log('Name:', userSample.canonicalName);
      console.log('Email:', userSample.canonicalEmail);
      console.log('Hourly rate:', userSample.hourly_rate);
      console.log('Contract type:', userSample.contract_type);
      console.log('Team ID:', userSample.team_id);
      console.log('Team name:', userSample.team_name);
      console.log('EitjeIds:', userSample.eitjeIds);
    }
    
    console.log('\n=== AGGREGATION SAMPLE ===');
    const aggSample = await db.collection('eitje_time_registration_aggregation').findOne({});
    if (aggSample) {
      console.log('Keys:', Object.keys(aggSample));
      console.log('Has user_name:', 'user_name' in aggSample);
      console.log('Has location_name:', 'location_name' in aggSample);
      console.log('Has team_name:', 'team_name' in aggSample);
      console.log('Has hourly_rate:', 'hourly_rate' in aggSample);
      console.log('Total cost:', aggSample.total_cost);
      console.log('Total hours:', aggSample.total_hours);
    } else {
      console.log('NO AGGREGATION DATA FOUND');
    }
    
    console.log('\n=== COLLECTION COUNTS ===');
    console.log('eitje_raw_data:', await db.collection('eitje_raw_data').countDocuments());
    console.log('unified_user:', await db.collection('unified_user').countDocuments());
    console.log('eitje_time_registration_aggregation:', await db.collection('eitje_time_registration_aggregation').countDocuments());
    console.log('eitje_planning_registration_aggregation:', await db.collection('eitje_planning_registration_aggregation').countDocuments());
    
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}

check();
