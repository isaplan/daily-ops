import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { getDatabase } from '../app/lib/mongodb/v2-connection';

async function checkAlvinio() {
  const db = await getDatabase();
  
  // Find Alvinio's user ID
  const alvinioUser = await db.collection('unified_user').findOne({
    $or: [
      { canonicalEmail: 'alviniomolina@gmail.com' },
      { eitjeEmails: 'alviniomolina@gmail.com' },
      { canonicalName: { $regex: /alvinio/i } }
    ]
  });
  
  if (!alvinioUser) {
    console.error('Alvinio not found');
    return;
  }
  
  const userId = alvinioUser.eitjeIds?.[0] || alvinioUser.primaryId;
  console.log(`Alvinio ID: ${userId}`);
  
  // Check date range: Dec 27, 2025 to Jan 26, 2026
  const startDate = '2025-12-27';
  const endDate = '2026-01-26';
  
  // Query with date filter (like the API does)
  const withDateFilter = await db.collection('eitje_time_registration_aggregation').aggregate([
    {
      $match: {
        userId: userId,
        period: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: null,
        totalHours: { $sum: '$total_hours' },
        totalRecords: { $sum: '$record_count' },
        docCount: { $sum: 1 }
      }
    }
  ]).toArray();
  
  // Query WITHOUT date filter (all data)
  const withoutDateFilter = await db.collection('eitje_time_registration_aggregation').aggregate([
    {
      $match: {
        userId: userId
      }
    },
    {
      $group: {
        _id: null,
        totalHours: { $sum: '$total_hours' },
        totalRecords: { $sum: '$record_count' },
        docCount: { $sum: 1 }
      }
    }
  ]).toArray();
  
  console.log('\n=== With Date Filter (Dec 27, 2025 - Jan 26, 2026) ===');
  console.log(`Total Hours: ${withDateFilter[0]?.totalHours?.toFixed(2) || 0}`);
  console.log(`Total Records: ${withDateFilter[0]?.totalRecords || 0}`);
  console.log(`Document Count: ${withDateFilter[0]?.docCount || 0}`);
  
  console.log('\n=== Without Date Filter (ALL DATA) ===');
  console.log(`Total Hours: ${withoutDateFilter[0]?.totalHours?.toFixed(2) || 0}`);
  console.log(`Total Records: ${withoutDateFilter[0]?.totalRecords || 0}`);
  console.log(`Document Count: ${withoutDateFilter[0]?.docCount || 0}`);
  
  // Check period formats
  const sampleDocs = await db.collection('eitje_time_registration_aggregation').find({
    userId: userId
  }).limit(5).toArray();
  
  console.log('\n=== Sample Period Formats ===');
  sampleDocs.forEach((doc, idx) => {
    console.log(`Doc ${idx + 1}: period="${doc.period}", period_type="${doc.period_type}"`);
  });
  
  // Check if period format matches the filter
  const periodFormats = await db.collection('eitje_time_registration_aggregation').aggregate([
    {
      $match: { userId: userId }
    },
    {
      $group: {
        _id: '$period_type',
        periods: { $addToSet: '$period' }
      }
    }
  ]).toArray();
  
  console.log('\n=== Period Formats by Type ===');
  periodFormats.forEach(pt => {
    const samplePeriods = pt.periods.slice(0, 3);
    console.log(`${pt._id}: ${samplePeriods.join(', ')}${pt.periods.length > 3 ? '...' : ''}`);
  });
}

checkAlvinio().catch(console.error);
