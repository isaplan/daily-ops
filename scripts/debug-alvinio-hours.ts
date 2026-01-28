import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { getDatabase } from '../app/lib/mongodb/v2-connection';

async function debug() {
  const db = await getDatabase();
  
  const userId = 30396; // Alvinio's eitje ID
  
  // Get raw records with date breakdown
  const rawByDate = await db.collection('eitje_raw_data').aggregate([
    {
      $match: {
        endpoint: 'time_registration_shifts',
        $or: [
          { 'extracted.userId': userId },
          { 'rawApiResponse.user_id': userId }
        ]
      }
    },
    {
      $project: {
        date: 1,
        dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        hours: {
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
        },
        hasStartEnd: {
          $and: [
            { $ne: ['$rawApiResponse.start', null] },
            { $ne: ['$rawApiResponse.end', null] }
          ]
        },
        start: '$rawApiResponse.start',
        end: '$rawApiResponse.end',
        breakMinutes: '$rawApiResponse.break_minutes'
      }
    },
    {
      $match: {
        dateStr: {
          $gte: '2025-12-27',
          $lte: '2026-01-26'
        }
      }
    },
    {
      $group: {
        _id: '$dateStr',
        count: { $sum: 1 },
        totalHours: { $sum: '$hours' },
        withStartEnd: { $sum: { $cond: ['$hasStartEnd', 1, 0] } }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]).toArray();
  
  console.log('=== Raw Records by Date (Dec 27, 2025 - Jan 26, 2026) ===');
  let totalCount = 0;
  let totalHours = 0;
  rawByDate.forEach(item => {
    console.log(`${item._id}: ${item.count} records, ${item.totalHours.toFixed(2)} hours (${item.withStartEnd} with start/end)`);
    totalCount += item.count;
    totalHours += item.totalHours;
  });
  console.log(`\nTotal: ${totalCount} records, ${totalHours.toFixed(2)} hours`);
  
  // Check aggregated documents by date
  const aggByDate = await db.collection('eitje_time_registration_aggregation').aggregate([
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
        count: { $sum: 1 },
        totalHours: { $sum: '$total_hours' },
        totalRecords: { $sum: '$record_count' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]).toArray();
  
  console.log('\n=== Aggregated Documents by Date ===');
  let aggTotalCount = 0;
  let aggTotalHours = 0;
  let aggTotalRecords = 0;
  aggByDate.forEach(item => {
    console.log(`${item._id}: ${item.count} docs, ${item.totalHours.toFixed(2)} hours, ${item.totalRecords} records`);
    aggTotalCount += item.count;
    aggTotalHours += item.totalHours;
    aggTotalRecords += item.totalRecords;
  });
  console.log(`\nTotal: ${aggTotalCount} docs, ${aggTotalHours.toFixed(2)} hours, ${aggTotalRecords} records`);
  
  // Compare dates
  console.log('\n=== Date Comparison ===');
  const rawDates = new Set(rawByDate.map(r => r._id));
  const aggDates = new Set(aggByDate.map(a => a._id));
  
  const missingInAgg = Array.from(rawDates).filter(d => !aggDates.has(d));
  const extraInAgg = Array.from(aggDates).filter(d => !rawDates.has(d));
  
  if (missingInAgg.length > 0) {
    console.log(`Dates in raw but not in aggregated: ${missingInAgg.join(', ')}`);
  }
  if (extraInAgg.length > 0) {
    console.log(`Dates in aggregated but not in raw: ${extraInAgg.join(', ')}`);
  }
}

debug().catch(console.error);
