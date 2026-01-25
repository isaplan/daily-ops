/**
 * @registry-id: aggregationService
 * @created: 2026-01-25T00:00:00.000Z
 * @last-modified: 2026-01-25T19:30:00.000Z
 * @description: Service to aggregate eitje_raw_data into time-series collections (hour/day/week/month/year). Stores names with IDs and master data (hourly_rate, contract_type) to eliminate lookups at query time.
 * @last-fix: [2026-01-25] Added display fields (location_display, user_display, team_display) that combine ID and name (e.g., "87983 - John Smith"). Fixed lookups to use allIdValues array for reliable matching. Cost calculated using hourly_rate during aggregation.
 * 
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 * 
 * @exports-to:
 *   ✓ app/api/aggregations/sync/route.ts => triggers aggregation updates
 *   ✓ app/lib/cron/v2-cron-manager.ts => scheduled aggregation after sync
 */

import { getDatabase } from '@/lib/mongodb/v2-connection';
import { ObjectId } from 'mongodb';

export type AggregationPeriod = 'hour' | 'day' | 'week' | 'month' | 'year';
export type AggregationType = 
  | 'time_registration' 
  | 'planning_registration' 
  | 'team' 
  | 'location' 
  | 'user' 
  | 'event';

interface AggregationResult {
  period: AggregationPeriod;
  type: AggregationType;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
}

/**
 * Get date boundaries for a period
 */
function getPeriodBoundaries(date: Date, period: AggregationPeriod): { start: Date; end: Date } {
  const d = new Date(date);
  
  switch (period) {
    case 'hour':
      d.setMinutes(0, 0, 0);
      return {
        start: d,
        end: new Date(d.getTime() + 60 * 60 * 1000 - 1),
      };
    case 'day':
      d.setHours(0, 0, 0, 0);
      return {
        start: d,
        end: new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    case 'week':
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return {
        start: d,
        end: new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
      };
    case 'month':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      const nextMonth = new Date(d);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return {
        start: d,
        end: new Date(nextMonth.getTime() - 1),
      };
    case 'year':
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      const nextYear = new Date(d);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      return {
        start: d,
        end: new Date(nextYear.getTime() - 1),
      };
    default:
      throw new Error(`Unknown period: ${period}`);
  }
}

/**
 * Format period key for aggregation
 */
function formatPeriodKey(date: Date, period: AggregationPeriod): string {
  const d = new Date(date);
  
  switch (period) {
    case 'hour':
      return d.toISOString().slice(0, 13) + ':00:00.000Z';
    case 'day':
      return d.toISOString().slice(0, 10) + 'T00:00:00.000Z';
    case 'week':
      const boundaries = getPeriodBoundaries(d, 'week');
      return boundaries.start.toISOString().slice(0, 10) + 'T00:00:00.000Z';
    case 'month':
      return d.toISOString().slice(0, 7) + '-01T00:00:00.000Z';
    case 'year':
      return d.getFullYear().toString() + '-01-01T00:00:00.000Z';
    default:
      throw new Error(`Unknown period: ${period}`);
  }
}

/**
 * Get MongoDB date expression for period grouping
 */
function getPeriodExpression(period: AggregationPeriod): any {
  switch (period) {
    case 'hour':
      return { $dateToString: { format: '%Y-%m-%dT%H', date: '$date' } };
    case 'day':
      return { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
    case 'week':
      // Get start of week (Monday)
      // $dayOfWeek returns 1 (Sunday) to 7 (Saturday)
      // We want Monday (2) to be 0, Tuesday (3) to be 1, etc.
      return {
        $dateToString: {
          format: '%Y-%m-%d',
          date: {
            $subtract: [
              '$date',
              {
                $multiply: [
                  {
                    $cond: [
                      { $eq: [{ $dayOfWeek: '$date' }, 1] }, // Sunday
                      6, // Go back 6 days to Monday
                      { $subtract: [{ $dayOfWeek: '$date' }, 2] } // For Mon-Sat, subtract 2
                    ]
                  },
                  86400000 // milliseconds in a day
                ]
              }
            ]
          }
        }
      };
    case 'month':
      return { $dateToString: { format: '%Y-%m', date: '$date' } };
    case 'year':
      return { $dateToString: { format: '%Y', date: '$date' } };
    default:
      return { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
  }
}

/**
 * Aggregate time_registration data
 */
async function aggregateTimeRegistration(
  db: any,
  startDate?: Date,
  endDate?: Date,
  periods: AggregationPeriod[] = ['day', 'week', 'month', 'year']
): Promise<AggregationResult[]> {
  const results: AggregationResult[] = [];
  
  // Build match query
  const matchQuery: any = {
    endpoint: 'time_registration_shifts',
  };
  
  if (startDate || endDate) {
    matchQuery.date = {};
    if (startDate) matchQuery.date.$gte = startDate;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchQuery.date.$lte = end;
    }
  }
  
  for (const period of periods) {
    const periodExpression = getPeriodExpression(period);
    
    const aggregation: any[] = [
      { $match: matchQuery },
      // Extract userId for unified_user lookup
      {
        $addFields: {
          extracted_user_id: {
            $ifNull: [
              '$extracted.userId',
              '$rawApiResponse.user_id'
            ]
          },
          extracted_team_id: {
            $ifNull: [
              '$extracted.teamId',
              '$rawApiResponse.team_id'
            ]
          }
        }
      },
      // Lookup unified_user to get names and master data (hourly_rate, contract_type)
      {
        $lookup: {
          from: 'unified_user',
          let: { 
            userId: {
              $ifNull: [
                '$extracted.userId',
                '$rawApiResponse.user_id'
              ]
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$$userId', { $ifNull: ['$allIdValues', []] }] },
                    { $in: ['$$userId', { $ifNull: ['$eitjeIds', []] }] }
                  ]
                }
              }
            }
          ],
          as: 'user_unified',
        },
      },
      { $unwind: { path: '$user_unified', preserveNullAndEmptyArrays: true } },
      // Lookup unified_location to get location name
      {
        $lookup: {
          from: 'unified_location',
          let: { locId: '$locationId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$$locId', { $ifNull: ['$allIdValues', []] }] },
                    { $eq: ['$primaryId', '$$locId'] },
                    { $in: ['$$locId', { $ifNull: ['$eitjeIds', []] }] }
                  ]
                }
              }
            }
          ],
          as: 'location_unified',
        },
      },
      { $unwind: { path: '$location_unified', preserveNullAndEmptyArrays: true } },
      // Lookup unified_team to get team name
      {
        $lookup: {
          from: 'unified_team',
          let: { 
            teamId: {
              $ifNull: [
                '$extracted.teamId',
                '$rawApiResponse.team_id'
              ]
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$$teamId', { $ifNull: ['$allIdValues', []] }] },
                    { $eq: ['$primaryId', '$$teamId'] },
                    { $in: ['$$teamId', { $ifNull: ['$eitjeIds', []] }] }
                  ]
                }
              }
            }
          ],
          as: 'team_unified',
        },
      },
      { $unwind: { path: '$team_unified', preserveNullAndEmptyArrays: true } },
      // Calculate hours per record
      {
        $addFields: {
          calculated_hours: {
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
                          {
                            $cond: [
                              {
                                $and: [
                                  { $ne: ['$rawApiResponse.start', null] },
                                  { $ne: ['$rawApiResponse.end', null] }
                                ]
                              },
                              {
                                $subtract: [
                                  {
                                    $divide: [
                                      { $subtract: [{ $toDate: '$rawApiResponse.end' }, { $toDate: '$rawApiResponse.start' }] },
                                      3600000
                                    ]
                                  },
                                  {
                                    $divide: [
                                      { $ifNull: [{ $toDouble: '$rawApiResponse.break_minutes' }, 0] },
                                      60
                                    ]
                                  }
                                ]
                              },
                              0
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          // Calculate cost using hourly_rate from unified_user
          calculated_cost: {
            $cond: [
              {
                $and: [
                  { $ne: ['$user_unified.hourly_rate', null] },
                  { $gt: ['$user_unified.hourly_rate', 0] }
                ]
              },
              {
                $multiply: [
                  {
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
                                  {
                                    $cond: [
                                      {
                                        $and: [
                                          { $ne: ['$rawApiResponse.start', null] },
                                          { $ne: ['$rawApiResponse.end', null] }
                                        ]
                                      },
                                      {
                                        $subtract: [
                                          {
                                            $divide: [
                                              { $subtract: [{ $toDate: '$rawApiResponse.end' }, { $toDate: '$rawApiResponse.start' }] },
                                              3600000
                                            ]
                                          },
                                          {
                                            $divide: [
                                              { $ifNull: [{ $toDouble: '$rawApiResponse.break_minutes' }, 0] },
                                              60
                                            ]
                                          }
                                        ]
                                      },
                                      0
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  '$user_unified.hourly_rate'
                ]
              },
              {
                $ifNull: [
                  { $divide: [{ $toDouble: '$extracted.amountInCents' }, 100] },
                  {
                    $ifNull: [
                      { $divide: [{ $toDouble: '$rawApiResponse.amt_in_cents' }, 100] },
                      {
                        $ifNull: [
                          { $toDouble: '$extracted.amount' },
                          {
                            $ifNull: [
                              { $toDouble: '$rawApiResponse.amount' },
                              0
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            period: periodExpression,
            locationId: '$locationId',
            userId: '$extracted_user_id',
            teamId: '$extracted_team_id',
          },
          // Store names and master data (first value since they should be consistent per ID)
          location_name: { $first: { $ifNull: ['$location_unified.canonicalName', 'Unknown'] } },
          user_name: { $first: { $ifNull: ['$user_unified.canonicalName', 'Unknown'] } },
          team_name: { $first: { $ifNull: ['$team_unified.canonicalName', 'Unknown'] } },
          hourly_rate: { $first: '$user_unified.hourly_rate' },
          contract_type: { $first: '$user_unified.contract_type' },
          total_hours: {
            $sum: '$calculated_hours'
          },
          total_cost: {
            $sum: '$calculated_cost'
          },
          record_count: { $sum: 1 },
          first_date: { $min: '$date' },
          last_date: { $max: '$date' },
        }
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          period_type: period,
          locationId: '$_id.locationId',
          location_name: 1,
          location_display: {
            $cond: [
              { $and: [{ $ne: ['$location_name', 'Unknown'] }, { $ne: ['$location_name', null] }] },
              { $concat: [{ $toString: '$_id.locationId' }, ' - ', '$location_name'] },
              { $toString: '$_id.locationId' }
            ]
          },
          userId: '$_id.userId',
          user_name: 1,
          user_display: {
            $cond: [
              { $and: [{ $ne: ['$user_name', 'Unknown'] }, { $ne: ['$user_name', null] }] },
              { $concat: [{ $toString: '$_id.userId' }, ' - ', '$user_name'] },
              { $toString: '$_id.userId' }
            ]
          },
          teamId: '$_id.teamId',
          team_name: 1,
          team_display: {
            $cond: [
              { $and: [{ $ne: ['$team_name', 'Unknown'] }, { $ne: ['$team_name', null] }] },
              { $concat: [{ $toString: '$_id.teamId' }, ' - ', '$team_name'] },
              { $toString: '$_id.teamId' }
            ]
          },
          hourly_rate: 1,
          contract_type: 1,
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          first_date: 1,
          last_date: 1,
          updatedAt: new Date(),
        }
      }
    ];
    
    const aggregatedData = await db.collection('eitje_raw_data').aggregate(aggregation).toArray();
    
    if (aggregatedData.length === 0) {
      results.push({
        period,
        type: 'time_registration',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    // Upsert aggregated data
    const operations = aggregatedData.map((doc: any) => ({
      updateOne: {
        filter: {
          period: doc.period,
          period_type: period,
          locationId: doc.locationId,
          userId: doc.userId,
          teamId: doc.teamId,
        },
        update: { $set: doc },
        upsert: true,
      }
    }));
    
    const bulkResult = await db.collection('eitje_time_registration_aggregation').bulkWrite(operations);
    
    results.push({
      period,
      type: 'time_registration',
      recordsProcessed: aggregatedData.length,
      recordsCreated: bulkResult.upsertedCount,
      recordsUpdated: bulkResult.modifiedCount,
    });
  }
  
  return results;
}

/**
 * Aggregate planning_registration data
 */
async function aggregatePlanningRegistration(
  db: any,
  startDate?: Date,
  endDate?: Date,
  periods: AggregationPeriod[] = ['day', 'week', 'month', 'year']
): Promise<AggregationResult[]> {
  const results: AggregationResult[] = [];
  
  const matchQuery: any = {
    endpoint: 'planning_shifts',
  };
  
  if (startDate || endDate) {
    matchQuery.date = {};
    if (startDate) matchQuery.date.$gte = startDate;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchQuery.date.$lte = end;
    }
  }
  
  for (const period of periods) {
    const aggregation: any[] = [
      { $match: matchQuery },
      // Extract userId and teamId for lookups
      {
        $addFields: {
          extracted_user_id: {
            $ifNull: [
              '$extracted.userId',
              '$rawApiResponse.user_id'
            ]
          },
          extracted_team_id: {
            $ifNull: [
              '$extracted.teamId',
              '$rawApiResponse.team_id'
            ]
          }
        }
      },
      // Lookup unified_user to get names and master data
      {
        $lookup: {
          from: 'unified_user',
          let: { 
            userId: {
              $cond: [
                { $eq: [{ $type: '$extracted_user_id' }, 'number'] },
                '$extracted_user_id',
                {
                  $cond: [
                    { $eq: [{ $type: '$extracted_user_id' }, 'string'] },
                    { $toInt: { $ifNull: ['$extracted_user_id', '0'] } },
                    null
                  ]
                }
              ]
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$$userId', null] },
                    { $in: ['$$userId', '$eitjeIds'] }
                  ]
                }
              }
            }
          ],
          as: 'user_unified',
        },
      },
      { $unwind: { path: '$user_unified', preserveNullAndEmptyArrays: true } },
      // Lookup unified_location to get location name
      {
        $lookup: {
          from: 'unified_location',
          let: { locId: '$locationId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$$locId', { $ifNull: ['$allIdValues', []] }] },
                    { $eq: ['$primaryId', '$$locId'] },
                    { $in: ['$$locId', { $ifNull: ['$eitjeIds', []] }] }
                  ]
                }
              }
            }
          ],
          as: 'location_unified',
        },
      },
      { $unwind: { path: '$location_unified', preserveNullAndEmptyArrays: true } },
      // Lookup unified_team to get team name
      {
        $lookup: {
          from: 'unified_team',
          let: { 
            teamId: {
              $ifNull: [
                '$extracted.teamId',
                '$rawApiResponse.team_id'
              ]
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$$teamId', { $ifNull: ['$allIdValues', []] }] },
                    { $eq: ['$primaryId', '$$teamId'] },
                    { $in: ['$$teamId', { $ifNull: ['$eitjeIds', []] }] }
                  ]
                }
              }
            }
          ],
          as: 'team_unified',
        },
      },
      { $unwind: { path: '$team_unified', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            period: getPeriodExpression(period),
            locationId: '$locationId',
            userId: '$extracted_user_id',
            teamId: '$extracted_team_id',
          },
          // Store names and master data (first value since they should be consistent per ID)
          location_name: { $first: { $ifNull: ['$location_unified.canonicalName', 'Unknown'] } },
          user_name: { $first: { $ifNull: ['$user_unified.canonicalName', 'Unknown'] } },
          team_name: { $first: { $ifNull: ['$team_unified.canonicalName', 'Unknown'] } },
          hourly_rate: { $first: '$user_unified.hourly_rate' },
          contract_type: { $first: '$user_unified.contract_type' },
          planned_hours: {
            $sum: {
              $ifNull: [
                { $toDouble: '$extracted.hours' },
                {
                  $ifNull: [
                    { $toDouble: '$extracted.hoursWorked' },
                    {
                      $ifNull: [
                        { $toDouble: '$rawApiResponse.hours' },
                        0
                      ]
                    }
                  ]
                }
              ]
            }
          },
          shift_count: { $sum: 1 },
          first_date: { $min: '$date' },
          last_date: { $max: '$date' },
        }
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          period_type: period,
          locationId: '$_id.locationId',
          location_name: 1,
          location_display: {
            $cond: [
              { $and: [{ $ne: ['$location_name', 'Unknown'] }, { $ne: ['$location_name', null] }] },
              { $concat: [{ $toString: '$_id.locationId' }, ' - ', '$location_name'] },
              { $toString: '$_id.locationId' }
            ]
          },
          userId: '$_id.userId',
          user_name: 1,
          user_display: {
            $cond: [
              { $and: [{ $ne: ['$user_name', 'Unknown'] }, { $ne: ['$user_name', null] }] },
              { $concat: [{ $toString: '$_id.userId' }, ' - ', '$user_name'] },
              { $toString: '$_id.userId' }
            ]
          },
          teamId: '$_id.teamId',
          team_name: 1,
          team_display: {
            $cond: [
              { $and: [{ $ne: ['$team_name', 'Unknown'] }, { $ne: ['$team_name', null] }] },
              { $concat: [{ $toString: '$_id.teamId' }, ' - ', '$team_name'] },
              { $toString: '$_id.teamId' }
            ]
          },
          hourly_rate: 1,
          contract_type: 1,
          planned_hours: 1,
          shift_count: 1,
          first_date: 1,
          last_date: 1,
          updatedAt: new Date(),
        }
      }
    ];
    
    const aggregatedData = await db.collection('eitje_raw_data').aggregate(aggregation).toArray();
    
    if (aggregatedData.length === 0) {
      results.push({
        period,
        type: 'planning_registration',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const operations = aggregatedData.map((doc: any) => ({
      updateOne: {
        filter: {
          period: doc.period,
          period_type: period,
          locationId: doc.locationId,
          userId: doc.userId,
          teamId: doc.teamId,
        },
        update: { $set: doc },
        upsert: true,
      }
    }));
    
    const bulkResult = await db.collection('eitje_planning_registration_aggregation').bulkWrite(operations);
    
    results.push({
      period,
      type: 'planning_registration',
      recordsProcessed: aggregatedData.length,
      recordsCreated: bulkResult.upsertedCount,
      recordsUpdated: bulkResult.modifiedCount,
    });
  }
  
  return results;
}

/**
 * Aggregate by team
 */
async function aggregateByTeam(
  db: any,
  startDate?: Date,
  endDate?: Date,
  periods: AggregationPeriod[] = ['day', 'week', 'month', 'year']
): Promise<AggregationResult[]> {
  const results: AggregationResult[] = [];
  
  const matchQuery: any = {
    $or: [
      { endpoint: 'time_registration_shifts' },
      { endpoint: 'planning_shifts' },
    ],
    'extracted.teamId': { $ne: null },
  };
  
  if (startDate || endDate) {
    matchQuery.date = {};
    if (startDate) matchQuery.date.$gte = startDate;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchQuery.date.$lte = end;
    }
  }
  
  for (const period of periods) {
    const aggregation: any[] = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            period: getPeriodExpression(period),
            teamId: {
              $ifNull: [
                '$extracted.teamId',
                '$rawApiResponse.team_id'
              ]
            },
            locationId: '$locationId',
          },
          total_hours: {
            $sum: {
              $ifNull: [
                { $toDouble: '$extracted.hours' },
                {
                  $ifNull: [
                    { $toDouble: '$extracted.hoursWorked' },
                    0
                  ]
                }
              ]
            }
          },
          total_cost: {
            $sum: {
              $ifNull: [
                { $divide: [{ $toDouble: '$extracted.amountInCents' }, 100] },
                {
                  $ifNull: [
                    { $toDouble: '$extracted.amount' },
                    0
                  ]
                }
              ]
            }
          },
          worker_count: { $addToSet: { $ifNull: ['$extracted.userId', '$rawApiResponse.user_id'] } },
          record_count: { $sum: 1 },
        }
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          period_type: period,
          teamId: '$_id.teamId',
          locationId: '$_id.locationId',
          total_hours: 1,
          total_cost: 1,
          worker_count: { $size: '$worker_count' },
          record_count: 1,
          updatedAt: new Date(),
        }
      }
    ];
    
    const aggregatedData = await db.collection('eitje_raw_data').aggregate(aggregation).toArray();
    
    if (aggregatedData.length === 0) {
      results.push({
        period,
        type: 'team',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const operations = aggregatedData.map((doc: any) => ({
      updateOne: {
        filter: {
          period: doc.period,
          period_type: period,
          teamId: doc.teamId,
          locationId: doc.locationId,
        },
        update: { $set: doc },
        upsert: true,
      }
    }));
    
    const bulkResult = await db.collection('eitje_team_aggregation').bulkWrite(operations);
    
    results.push({
      period,
      type: 'team',
      recordsProcessed: aggregatedData.length,
      recordsCreated: bulkResult.upsertedCount,
      recordsUpdated: bulkResult.modifiedCount,
    });
  }
  
  return results;
}

/**
 * Aggregate by location
 */
async function aggregateByLocation(
  db: any,
  startDate?: Date,
  endDate?: Date,
  periods: AggregationPeriod[] = ['day', 'week', 'month', 'year']
): Promise<AggregationResult[]> {
  const results: AggregationResult[] = [];
  
  const matchQuery: any = {
    $or: [
      { endpoint: 'time_registration_shifts' },
      { endpoint: 'planning_shifts' },
      { endpoint: 'revenue_days' },
    ],
    locationId: { $ne: null },
  };
  
  if (startDate || endDate) {
    matchQuery.date = {};
    if (startDate) matchQuery.date.$gte = startDate;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchQuery.date.$lte = end;
    }
  }
  
  for (const period of periods) {
    const aggregation: any[] = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            period: getPeriodExpression(period),
            locationId: '$locationId',
          },
          total_hours: {
            $sum: {
              $ifNull: [
                { $toDouble: '$extracted.hours' },
                {
                  $ifNull: [
                    { $toDouble: '$extracted.hoursWorked' },
                    0
                  ]
                }
              ]
            }
          },
          total_cost: {
            $sum: {
              $ifNull: [
                { $divide: [{ $toDouble: '$extracted.amountInCents' }, 100] },
                {
                  $ifNull: [
                    { $toDouble: '$extracted.amount' },
                    0
                  ]
                }
              ]
            }
          },
          total_revenue: {
            $sum: {
              $ifNull: [
                { $toDouble: '$extracted.revenue' },
                {
                  $ifNull: [
                    { $toDouble: '$rawApiResponse.revenue' },
                    0
                  ]
                }
              ]
            }
          },
          worker_count: { $addToSet: { $ifNull: ['$extracted.userId', '$rawApiResponse.user_id'] } },
          team_count: { $addToSet: { $ifNull: ['$extracted.teamId', '$rawApiResponse.team_id'] } },
          record_count: { $sum: 1 },
        }
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          period_type: period,
          locationId: '$_id.locationId',
          total_hours: 1,
          total_cost: 1,
          total_revenue: 1,
          worker_count: { $size: '$worker_count' },
          team_count: { $size: '$team_count' },
          record_count: 1,
          updatedAt: new Date(),
        }
      }
    ];
    
    const aggregatedData = await db.collection('eitje_raw_data').aggregate(aggregation).toArray();
    
    if (aggregatedData.length === 0) {
      results.push({
        period,
        type: 'location',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const operations = aggregatedData.map((doc: any) => ({
      updateOne: {
        filter: {
          period: doc.period,
          period_type: period,
          locationId: doc.locationId,
        },
        update: { $set: doc },
        upsert: true,
      }
    }));
    
    const bulkResult = await db.collection('eitje_location_aggregation').bulkWrite(operations);
    
    results.push({
      period,
      type: 'location',
      recordsProcessed: aggregatedData.length,
      recordsCreated: bulkResult.upsertedCount,
      recordsUpdated: bulkResult.modifiedCount,
    });
  }
  
  return results;
}

/**
 * Aggregate by user
 */
async function aggregateByUser(
  db: any,
  startDate?: Date,
  endDate?: Date,
  periods: AggregationPeriod[] = ['day', 'week', 'month', 'year']
): Promise<AggregationResult[]> {
  const results: AggregationResult[] = [];
  
  const matchQuery: any = {
    $and: [
      {
        $or: [
          { endpoint: 'time_registration_shifts' },
          { endpoint: 'planning_shifts' },
        ],
      },
      {
        $or: [
          { 'extracted.userId': { $ne: null } },
          { 'rawApiResponse.user_id': { $ne: null } },
          { 'rawApiResponse.user.id': { $ne: null } },
        ],
      },
    ],
  };
  
  if (startDate || endDate) {
    matchQuery.date = {};
    if (startDate) matchQuery.date.$gte = startDate;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchQuery.date.$lte = end;
    }
  }
  
  for (const period of periods) {
    const aggregation: any[] = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            period: getPeriodExpression(period),
            userId: {
              $ifNull: [
                '$extracted.userId',
                '$rawApiResponse.user_id'
              ]
            },
            locationId: '$locationId',
            teamId: {
              $ifNull: [
                '$extracted.teamId',
                '$rawApiResponse.team_id'
              ]
            },
          },
          total_hours: {
            $sum: {
              $ifNull: [
                { $toDouble: '$extracted.hours' },
                {
                  $ifNull: [
                    { $toDouble: '$extracted.hoursWorked' },
                    0
                  ]
                }
              ]
            }
          },
          total_cost: {
            $sum: {
              $ifNull: [
                { $divide: [{ $toDouble: '$extracted.amountInCents' }, 100] },
                {
                  $ifNull: [
                    { $toDouble: '$extracted.amount' },
                    0
                  ]
                }
              ]
            }
          },
          shift_count: { $sum: 1 },
        }
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          period_type: period,
          userId: '$_id.userId',
          locationId: '$_id.locationId',
          teamId: '$_id.teamId',
          total_hours: 1,
          total_cost: 1,
          shift_count: 1,
          updatedAt: new Date(),
        }
      }
    ];
    
    const aggregatedData = await db.collection('eitje_raw_data').aggregate(aggregation).toArray();
    
    if (aggregatedData.length === 0) {
      results.push({
        period,
        type: 'user',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const operations = aggregatedData.map((doc: any) => ({
      updateOne: {
        filter: {
          period: doc.period,
          period_type: period,
          userId: doc.userId,
          locationId: doc.locationId,
        },
        update: { $set: doc },
        upsert: true,
      }
    }));
    
    const bulkResult = await db.collection('eitje_user_aggregation').bulkWrite(operations);
    
    results.push({
      period,
      type: 'user',
      recordsProcessed: aggregatedData.length,
      recordsCreated: bulkResult.upsertedCount,
      recordsUpdated: bulkResult.modifiedCount,
    });
  }
  
  return results;
}

/**
 * Aggregate by event
 */
async function aggregateByEvent(
  db: any,
  startDate?: Date,
  endDate?: Date,
  periods: AggregationPeriod[] = ['day', 'week', 'month', 'year']
): Promise<AggregationResult[]> {
  const results: AggregationResult[] = [];
  
  const matchQuery: any = {
    endpoint: 'events',
  };
  
  if (startDate || endDate) {
    matchQuery.date = {};
    if (startDate) matchQuery.date.$gte = startDate;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchQuery.date.$lte = end;
    }
  }
  
  for (const period of periods) {
    const aggregation: any[] = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            period: getPeriodExpression(period),
            eventId: {
              $ifNull: [
                '$extracted.id',
                '$rawApiResponse.id'
              ]
            },
            locationId: '$locationId',
          },
          event_count: { $sum: 1 },
          total_guest_count: {
            $sum: {
              $ifNull: [
                { $toDouble: '$extracted.guestCount' },
                {
                  $ifNull: [
                    { $toDouble: '$rawApiResponse.guest_count' },
                    0
                  ]
                }
              ]
            }
          },
          total_revenue: {
            $sum: {
              $ifNull: [
                { $toDouble: '$extracted.revenue' },
                {
                  $ifNull: [
                    { $toDouble: '$rawApiResponse.revenue' },
                    0
                  ]
                }
              ]
            }
          },
        }
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          period_type: period,
          eventId: '$_id.eventId',
          locationId: '$_id.locationId',
          event_count: 1,
          total_guest_count: 1,
          total_revenue: 1,
          updatedAt: new Date(),
        }
      }
    ];
    
    const aggregatedData = await db.collection('eitje_raw_data').aggregate(aggregation).toArray();
    
    if (aggregatedData.length === 0) {
      results.push({
        period,
        type: 'event',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const operations = aggregatedData.map((doc: any) => ({
      updateOne: {
        filter: {
          period: doc.period,
          period_type: period,
          eventId: doc.eventId,
          locationId: doc.locationId,
        },
        update: { $set: doc },
        upsert: true,
      }
    }));
    
    const bulkResult = await db.collection('eitje_event_aggregation').bulkWrite(operations);
    
    results.push({
      period,
      type: 'event',
      recordsProcessed: aggregatedData.length,
      recordsCreated: bulkResult.upsertedCount,
      recordsUpdated: bulkResult.modifiedCount,
    });
  }
  
  return results;
}

/**
 * Main aggregation function - aggregates all types
 */
export async function aggregateAll(
  startDate?: Date,
  endDate?: Date,
  types: AggregationType[] = ['time_registration', 'planning_registration', 'team', 'location', 'user', 'event'],
  periods: AggregationPeriod[] = ['day', 'week', 'month', 'year']
): Promise<AggregationResult[]> {
  const db = await getDatabase();
  const allResults: AggregationResult[] = [];
  
  for (const type of types) {
    let results: AggregationResult[] = [];
    
    switch (type) {
      case 'time_registration':
        results = await aggregateTimeRegistration(db, startDate, endDate, periods);
        break;
      case 'planning_registration':
        results = await aggregatePlanningRegistration(db, startDate, endDate, periods);
        break;
      case 'team':
        results = await aggregateByTeam(db, startDate, endDate, periods);
        break;
      case 'location':
        results = await aggregateByLocation(db, startDate, endDate, periods);
        break;
      case 'user':
        results = await aggregateByUser(db, startDate, endDate, periods);
        break;
      case 'event':
        results = await aggregateByEvent(db, startDate, endDate, periods);
        break;
    }
    
    allResults.push(...results);
  }
  
  return allResults;
}
