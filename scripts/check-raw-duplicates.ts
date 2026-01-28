import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { getDatabase } from '../app/lib/mongodb/v2-connection';

async function check() {
  const db = await getDatabase();
  const userId = 30396;
  
  // Check for duplicate raw records (same date+location+user+team)
  const rawDuplicates = await db.collection('eitje_raw_data').aggregate([
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
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          locationId: '$locationId',
          userId: {
            $ifNull: [
              '$extracted.userId',
              '$rawApiResponse.user_id'
            ]
          },
          teamId: {
            $ifNull: [
              '$extracted.teamId',
              '$rawApiResponse.team_id'
            ]
          },
          // Also check by support ID if available
          supportId: {
            $ifNull: [
              '$extracted.supportId',
              '$rawApiResponse.support_id'
            ]
          }
        },
        count: { $sum: 1 },
        docs: { $push: '$_id' }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    {
      $limit: 10
    }
  ]).toArray();
  
  console.log(`=== Raw Data Duplicates: ${rawDuplicates.length} ===`);
  rawDuplicates.forEach((dup, idx) => {
    console.log(`\nDuplicate ${idx + 1}:`);
    console.log(`  Date: ${dup._id.date}, LocationId: ${dup._id.locationId}, TeamId: ${dup._id.teamId}, SupportId: ${dup._id.supportId}`);
    console.log(`  Count: ${dup.count}`);
    console.log(`  Document IDs: ${dup.docs.slice(0, 3).join(', ')}${dup.docs.length > 3 ? '...' : ''}`);
  });
  
  // Total raw records
  const totalRaw = await db.collection('eitje_raw_data').countDocuments({
    endpoint: 'time_registration_shifts',
    $or: [
      { 'extracted.userId': userId },
      { 'rawApiResponse.user_id': userId }
    ],
    date: {
      $gte: new Date('2025-12-27'),
      $lte: new Date('2026-01-26T23:59:59.999Z')
    }
  });
  
  console.log(`\n=== Total Raw Records: ${totalRaw} ===`);
  
  // Check aggregated - how many unique period+location+user+team combinations
  const aggUnique = await db.collection('eitje_time_registration_aggregation').aggregate([
    {
      $match: {
        userId: userId,
        period_type: 'day',
        period: {
          $gte: '2025-12-27',
          $lte: '2026-01-26'
        }
      }
    },
    {
      $group: {
        _id: {
          period: '$period',
          locationId: '$locationId',
          userId: '$userId',
          teamId: '$teamId'
        },
        record_count: { $first: '$record_count' },
        total_hours: { $first: '$total_hours' }
      }
    },
    {
      $group: {
        _id: null,
        totalGroups: { $sum: 1 },
        totalRecords: { $sum: '$record_count' },
        totalHours: { $sum: '$total_hours' }
      }
    }
  ]).toArray();
  
  console.log(`\n=== Aggregated Unique Groups ===`);
  console.log(`Total Groups: ${aggUnique[0]?.totalGroups || 0}`);
  console.log(`Total Records (sum): ${aggUnique[0]?.totalRecords || 0}`);
  console.log(`Total Hours: ${aggUnique[0]?.totalHours?.toFixed(2) || 0}`);
}

check().catch(console.error);
