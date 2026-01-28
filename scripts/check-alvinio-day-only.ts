import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { getDatabase } from '../app/lib/mongodb/v2-connection';

async function checkAlvinio() {
  const db = await getDatabase();
  
  const alvinioUser = await db.collection('unified_user').findOne({
    $or: [
      { canonicalEmail: 'alviniomolina@gmail.com' },
      { eitjeEmails: 'alviniomolina@gmail.com' },
      { canonicalName: { $regex: /alvinio/i } }
    ]
  });
  
  const userId = alvinioUser?.eitjeIds?.[0] || alvinioUser?.primaryId;
  
  // Date range: Dec 27, 2025 to Jan 26, 2026
  const startDate = '2025-12-27';
  const endDate = '2026-01-26';
  
  // Query with date filter and day period_type only
  const dayOnly = await db.collection('eitje_time_registration_aggregation').aggregate([
    {
      $match: {
        userId: userId,
        period_type: 'day',
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
        docCount: { $sum: 1 },
        uniquePeriods: { $addToSet: '$period' }
      }
    }
  ]).toArray();
  
  console.log('=== Day Period Only (Dec 27, 2025 - Jan 26, 2026) ===');
  console.log(`Total Hours: ${dayOnly[0]?.totalHours?.toFixed(2) || 0}`);
  console.log(`Total Records: ${dayOnly[0]?.totalRecords || 0}`);
  console.log(`Document Count: ${dayOnly[0]?.docCount || 0}`);
  console.log(`Unique Periods: ${dayOnly[0]?.uniquePeriods?.length || 0}`);
  
  // Check for duplicates within day period
  const duplicates = await db.collection('eitje_time_registration_aggregation').aggregate([
    {
      $match: {
        userId: userId,
        period_type: 'day',
        period: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          period: '$period',
          locationId: '$locationId',
          userId: '$userId',
          teamId: '$teamId',
        },
        count: { $sum: 1 },
        totalHours: { $sum: '$total_hours' },
        totalRecords: { $sum: '$record_count' }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    {
      $limit: 10
    }
  ]).toArray();
  
  console.log(`\n=== Duplicates Found: ${duplicates.length} ===`);
  duplicates.forEach((dup, idx) => {
    console.log(`\nDuplicate ${idx + 1}:`);
    console.log(`  Period: ${dup._id.period}`);
    console.log(`  LocationId: ${dup._id.locationId}, UserId: ${dup._id.userId}, TeamId: ${dup._id.teamId}`);
    console.log(`  Count: ${dup.count}`);
    console.log(`  Total Hours: ${dup.totalHours.toFixed(2)}`);
    console.log(`  Total Records: ${dup.totalRecords}`);
  });
  
  // Check raw data for same period
  const rawData = await db.collection('eitje_raw_data').aggregate([
    {
      $match: {
        endpoint: 'time_registration_shifts',
        $or: [
          { 'extracted.userId': userId },
          { 'rawApiResponse.user_id': userId }
        ],
        date: {
          $gte: new Date('2025-12-27'),
          $lte: new Date('2026-01-26T23:59:59.999Z')
        }
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalHours: {
          $sum: {
            $ifNull: [
              { $toDouble: '$extracted.hours' },
              {
                $ifNull: [
                  { $toDouble: '$extracted.hoursWorked' },
                  {
                    $ifNull: [
                      { $toDouble: '$rawApiResponse.hours' },
                      {
                        $ifNull: [
                          { $toDouble: '$rawApiResponse.hours_worked' },
                          0
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    }
  ]).toArray();
  
  console.log(`\n=== Raw Data (Dec 27, 2025 - Jan 26, 2026) ===`);
  console.log(`Record Count: ${rawData[0]?.count || 0}`);
  console.log(`Total Hours: ${rawData[0]?.totalHours?.toFixed(2) || 0}`);
}

checkAlvinio().catch(console.error);
