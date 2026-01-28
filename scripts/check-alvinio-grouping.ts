import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { getDatabase } from '../app/lib/mongodb/v2-connection';

async function check() {
  const db = await getDatabase();
  const userId = 30396;
  
  // Check raw data - how many records per day+location+team combination
  const rawGrouped = await db.collection('eitje_raw_data').aggregate([
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
      $addFields: {
        dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        locationId: 1, // We'll check this
        teamId: {
          $ifNull: [
            '$extracted.teamId',
            '$rawApiResponse.team_id'
          ]
        }
      }
    },
    {
      $group: {
        _id: {
          date: '$dateStr',
          locationId: '$locationId',
          teamId: '$teamId'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        totalGroups: { $sum: 1 },
        totalRecords: { $sum: '$count' }
      }
    }
  ]).toArray();
  
  console.log('=== Raw Data Grouping ===');
  console.log(`Total unique groups (date+location+team): ${rawGrouped[0]?.totalGroups || 0}`);
  console.log(`Total records: ${rawGrouped[0]?.totalRecords || 0}`);
  
  // Check aggregated - how many documents
  const aggGrouped = await db.collection('eitje_time_registration_aggregation').aggregate([
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
        _id: null,
        totalDocs: { $sum: 1 },
        totalRecords: { $sum: '$record_count' },
        totalHours: { $sum: '$total_hours' }
      }
    }
  ]).toArray();
  
  console.log('\n=== Aggregated Data ===');
  console.log(`Total documents: ${aggGrouped[0]?.totalDocs || 0}`);
  console.log(`Total records (sum of record_count): ${aggGrouped[0]?.totalRecords || 0}`);
  console.log(`Total hours: ${aggGrouped[0]?.totalHours?.toFixed(2) || 0}`);
  
  // Check if there are documents with same period but different locationId/teamId
  const byPeriod = await db.collection('eitje_time_registration_aggregation').aggregate([
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
        _id: '$period',
        docs: { $sum: 1 },
        records: { $sum: '$record_count' },
        hours: { $sum: '$total_hours' },
        locations: { $addToSet: '$locationId' },
        teams: { $addToSet: '$teamId' }
      }
    },
    {
      $match: { docs: { $gt: 1 } }
    },
    {
      $limit: 5
    }
  ]).toArray();
  
  console.log('\n=== Periods with Multiple Documents ===');
  byPeriod.forEach(p => {
    console.log(`${p._id}: ${p.docs} docs, ${p.records} records, ${p.hours.toFixed(2)} hours`);
    console.log(`  Locations: ${p.locations.length}, Teams: ${p.teams.length}`);
  });
}

check().catch(console.error);
