/**
 * @registry-id: aggregationService
 * @created: 2026-01-25T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Service to aggregate eitje_raw_data into time-series collections (hour/day/week/month/year). Stores names with IDs and master data (hourly_rate, contract_type) to eliminate lookups at query time.
 * @last-fix: [2026-01-26] CRITICAL FIX: Now properly extracts locationId from unified_location.primaryId (ObjectId) and stores it in aggregated documents. Also extracts location_name, user_name, and team_name from unified collections and stores them directly. Added $addFields stage after lookups to resolve all IDs and names before $group stage.
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
  
  // If date range provided, filter by date (for incremental updates)
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
      // Extract userId, teamId, and location name for lookups
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
          },
          // Extract location name from extracted fields or raw API response (before unified_location lookup)
          extracted_location_name: {
            $ifNull: [
              '$extracted.locationName',
              {
                $ifNull: [
                  '$extracted.environment_name',
                  {
                    $ifNull: [
                      '$rawApiResponse.location_name',
                      {
                        $ifNull: [
                          '$rawApiResponse.location?.name',
                          {
                            $ifNull: [
                              '$rawApiResponse.environment_name',
                              '$rawApiResponse.environment?.name'
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
      // Fix: Match ObjectId properly with allIdValues array
      {
        $lookup: {
          from: 'unified_location',
          let: { 
            locId: '$locationId',
            locIdStr: { $toString: { $ifNull: ['$locationId', ''] } },
            envId: '$environmentId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    // Match by primaryId (ObjectId) - direct comparison
                    { $eq: ['$primaryId', '$$locId'] },
                    // Match by allIdValues - check if locationId (as string) is in array
                    // allIdValues contains mixed types, so we check both string and ObjectId forms
                    { $in: ['$$locId', { $ifNull: ['$allIdValues', []] }] },
                    { $in: ['$$locIdStr', { $ifNull: ['$allIdValues', []] }] },
                    // Match by eitjeIds (array of numbers) - for environmentId matching
                    { 
                      $and: [
                        { $ne: ['$$envId', null] },
                        { $in: ['$$envId', { $ifNull: ['$eitjeIds', []] }] }
                      ]
                    }
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
      // CRITICAL: Set locationId, userId, teamId from unified collections AFTER lookups
      {
        $addFields: {
          // Set locationId from unified_location.primaryId (ObjectId)
          locationId: {
            $ifNull: [
              '$location_unified.primaryId',
              '$locationId' // Fallback to original if not found
            ]
          },
          // Set resolved user_name from unified_user
          resolved_user_name: {
            $ifNull: [
              '$user_unified.canonicalName',
              {
                $ifNull: [
                  '$user_unified.primaryName',
                  'Unknown'
                ]
              }
            ]
          },
          // Set resolved team_name from unified_team
          resolved_team_name: {
            $ifNull: [
              '$team_unified.canonicalName',
              {
                $ifNull: [
                  '$team_unified.primaryName',
                  'Unknown'
                ]
              }
            ]
          },
          // Set resolved location_name from unified_location
          resolved_location_name: {
            $ifNull: [
              '$location_unified.canonicalName',
              {
                $ifNull: [
                  '$location_unified.primaryName',
                  {
                    $ifNull: [
                      '$extracted_location_name',
                      'Unknown'
                    ]
                  }
                ]
              }
            ]
          },
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
          // Store resolved names from unified collections (already resolved in $addFields above)
          location_name: { $first: '$resolved_location_name' },
          user_name: { $first: '$resolved_user_name' },
          team_name: { $first: '$resolved_team_name' },
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
    
    // ROBUST APPROACH: Delete documents for periods that have new/changed data, then insert new ones
    // Find which periods have new/changed data and only delete those
    const collection = db.collection('eitje_time_registration_aggregation');
    
    // Get unique periods from aggregatedData (these are the periods with new/changed data)
    const periodsToUpdate = new Set<string>();
    aggregatedData.forEach((doc: any) => {
      if (doc.period) {
        periodsToUpdate.add(doc.period);
      }
    });
    
    // Build delete filter: delete only documents for periods that have new/changed data
    const deleteFilter: any = {
      period_type: period,
    };
    
    if (periodsToUpdate.size > 0) {
      // Only delete documents for periods that have new/changed data
      deleteFilter.period = { $in: Array.from(periodsToUpdate) };
    } else if (!startDate && !endDate) {
      // No date range and no periods found = full rebuild, delete all
      // (deleteFilter.period stays undefined, so we delete all for this period_type)
    } else {
      // Date range provided but no data found = nothing to delete or insert
      results.push({
        period,
        type: 'time_registration',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const deleteResult = await collection.deleteMany(deleteFilter);
    
    // Insert all new documents
    let insertResult;
    if (aggregatedData.length > 0) {
      insertResult = await collection.insertMany(aggregatedData, { ordered: false });
    } else {
      insertResult = { insertedCount: 0, insertedIds: {} };
    }
    
    results.push({
      period,
      type: 'time_registration',
      recordsProcessed: aggregatedData.length,
      recordsCreated: insertResult.insertedCount || 0,
      recordsUpdated: 0, // No updates when using delete+insert
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
      // Extract userId, teamId, and location name for lookups
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
          },
          // Extract location name from extracted fields or raw API response (before unified_location lookup)
          extracted_location_name: {
            $ifNull: [
              '$extracted.locationName',
              {
                $ifNull: [
                  '$extracted.environment_name',
                  {
                    $ifNull: [
                      '$rawApiResponse.location_name',
                      {
                        $ifNull: [
                          '$rawApiResponse.location?.name',
                          {
                            $ifNull: [
                              '$rawApiResponse.environment_name',
                              '$rawApiResponse.environment?.name'
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
      // Lookup unified_user to get names and master data
      {
        $lookup: {
          from: 'unified_user',
          let: { 
            userId: '$extracted_user_id'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$$userId', null] },
                    {
                      $or: [
                        { $in: ['$$userId', { $ifNull: ['$eitjeIds', []] }] },
                        { $in: ['$$userId', { $ifNull: ['$allIdValues', []] }] }
                      ]
                    }
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
      // Fix: Match ObjectId properly with allIdValues array
      {
        $lookup: {
          from: 'unified_location',
          let: { 
            locId: '$locationId',
            locIdStr: { $toString: { $ifNull: ['$locationId', ''] } },
            envId: '$environmentId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    // Match by primaryId (ObjectId) - direct comparison
                    { $eq: ['$primaryId', '$$locId'] },
                    // Match by allIdValues - check if locationId (as string) is in array
                    // allIdValues contains mixed types, so we check both string and ObjectId forms
                    { $in: ['$$locId', { $ifNull: ['$allIdValues', []] }] },
                    { $in: ['$$locIdStr', { $ifNull: ['$allIdValues', []] }] },
                    // Match by eitjeIds (array of numbers) - for environmentId matching
                    { 
                      $and: [
                        { $ne: ['$$envId', null] },
                        { $in: ['$$envId', { $ifNull: ['$eitjeIds', []] }] }
                      ]
                    }
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
      // CRITICAL: Set locationId, userId, teamId from unified collections AFTER lookups
      {
        $addFields: {
          // Set locationId from unified_location.primaryId (ObjectId)
          locationId: {
            $ifNull: [
              '$location_unified.primaryId',
              '$locationId' // Fallback to original if not found
            ]
          },
          // Set resolved user_name from unified_user
          resolved_user_name: {
            $ifNull: [
              '$user_unified.canonicalName',
              {
                $ifNull: [
                  '$user_unified.primaryName',
                  'Unknown'
                ]
              }
            ]
          },
          // Set resolved team_name from unified_team
          resolved_team_name: {
            $ifNull: [
              '$team_unified.canonicalName',
              {
                $ifNull: [
                  '$team_unified.primaryName',
                  'Unknown'
                ]
              }
            ]
          },
          // Set resolved location_name from unified_location
          resolved_location_name: {
            $ifNull: [
              '$location_unified.canonicalName',
              {
                $ifNull: [
                  '$location_unified.primaryName',
                  {
                    $ifNull: [
                      '$extracted_location_name',
                      'Unknown'
                    ]
                  }
                ]
              }
            ]
          },
        }
      },
      {
        $group: {
          _id: {
            period: getPeriodExpression(period),
            locationId: '$locationId',
            userId: '$extracted_user_id',
            teamId: '$extracted_team_id',
          },
          // Store resolved names from unified collections (already resolved in $addFields above)
          location_name: { $first: '$resolved_location_name' },
          user_name: { $first: '$resolved_user_name' },
          team_name: { $first: '$resolved_team_name' },
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
    
    // ROBUST APPROACH: Delete documents for periods that have new/changed data, then insert new ones
    const collection = db.collection('eitje_planning_registration_aggregation');
    
    const periodsToUpdate = new Set<string>();
    aggregatedData.forEach((doc: any) => {
      if (doc.period) periodsToUpdate.add(doc.period);
    });
    
    const deleteFilter: any = { period_type: period };
    
    if (periodsToUpdate.size > 0) {
      deleteFilter.period = { $in: Array.from(periodsToUpdate) };
    } else if (!startDate && !endDate) {
      // Full rebuild
    } else {
      results.push({
        period,
        type: 'planning_registration',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const deleteResult = await collection.deleteMany(deleteFilter);
    
    let insertResult;
    if (aggregatedData.length > 0) {
      insertResult = await collection.insertMany(aggregatedData, { ordered: false });
    } else {
      insertResult = { insertedCount: 0, insertedIds: {} };
    }
    
    results.push({
      period,
      type: 'planning_registration',
      recordsProcessed: aggregatedData.length,
      recordsCreated: insertResult.insertedCount || 0,
      recordsUpdated: 0,
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
      // Extract IDs for lookups
      {
        $addFields: {
          extracted_team_id: {
            $ifNull: [
              '$extracted.teamId',
              '$rawApiResponse.team_id'
            ]
          },
          extracted_location_name: {
            $ifNull: [
              '$extracted.locationName',
              {
                $ifNull: [
                  '$extracted.environment_name',
                  {
                    $ifNull: [
                      '$rawApiResponse.location_name',
                      {
                        $ifNull: [
                          '$rawApiResponse.location?.name',
                          {
                            $ifNull: [
                              '$rawApiResponse.environment_name',
                              '$rawApiResponse.environment?.name'
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
      // Lookup unified_location
      {
        $lookup: {
          from: 'unified_location',
          let: { 
            locId: '$locationId',
            locIdStr: { $toString: { $ifNull: ['$locationId', ''] } },
            envId: '$environmentId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$primaryId', '$$locId'] },
                    { $in: ['$$locId', { $ifNull: ['$allIdValues', []] }] },
                    { $in: ['$$locIdStr', { $ifNull: ['$allIdValues', []] }] },
                    { 
                      $and: [
                        { $ne: ['$$envId', null] },
                        { $in: ['$$envId', { $ifNull: ['$eitjeIds', []] }] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: 'location_unified',
        },
      },
      { $unwind: { path: '$location_unified', preserveNullAndEmptyArrays: true } },
      // Lookup unified_team
      {
        $lookup: {
          from: 'unified_team',
          let: { teamId: '$extracted_team_id' },
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
      // CRITICAL: Set locationId and names from unified collections
      {
        $addFields: {
          locationId: {
            $ifNull: [
              '$location_unified.primaryId',
              '$locationId'
            ]
          },
          resolved_location_name: {
            $ifNull: [
              '$location_unified.canonicalName',
              {
                $ifNull: [
                  '$location_unified.primaryName',
                  'Unknown'
                ]
              }
            ]
          },
          resolved_team_name: {
            $ifNull: [
              '$team_unified.canonicalName',
              {
                $ifNull: [
                  '$team_unified.primaryName',
                  'Unknown'
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            period: getPeriodExpression(period),
            teamId: '$extracted_team_id',
            locationId: '$locationId',
          },
          location_name: { $first: '$resolved_location_name' },
          team_name: { $first: '$resolved_team_name' },
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
          location_name: 1,
          team_name: 1,
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
    
    // ROBUST APPROACH: Delete documents for periods that have new/changed data, then insert new ones
    const collection = db.collection('eitje_team_aggregation');
    
    const periodsToUpdate = new Set<string>();
    aggregatedData.forEach((doc: any) => {
      if (doc.period) periodsToUpdate.add(doc.period);
    });
    
    const deleteFilter: any = { period_type: period };
    
    if (periodsToUpdate.size > 0) {
      deleteFilter.period = { $in: Array.from(periodsToUpdate) };
    } else if (!startDate && !endDate) {
      // Full rebuild
    } else {
      results.push({
        period,
        type: 'team',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const deleteResult = await collection.deleteMany(deleteFilter);
    
    let insertResult;
    if (aggregatedData.length > 0) {
      insertResult = await collection.insertMany(aggregatedData, { ordered: false });
    } else {
      insertResult = { insertedCount: 0, insertedIds: {} };
    }
    
    results.push({
      period,
      type: 'team',
      recordsProcessed: aggregatedData.length,
      recordsCreated: insertResult.insertedCount || 0,
      recordsUpdated: 0,
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
      // Extract location name for lookup
      {
        $addFields: {
          extracted_location_name: {
            $ifNull: [
              '$extracted.locationName',
              {
                $ifNull: [
                  '$extracted.environment_name',
                  {
                    $ifNull: [
                      '$rawApiResponse.location_name',
                      {
                        $ifNull: [
                          '$rawApiResponse.location?.name',
                          {
                            $ifNull: [
                              '$rawApiResponse.environment_name',
                              '$rawApiResponse.environment?.name'
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
      // Lookup unified_location
      {
        $lookup: {
          from: 'unified_location',
          let: { 
            locId: '$locationId',
            locIdStr: { $toString: { $ifNull: ['$locationId', ''] } },
            envId: '$environmentId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$primaryId', '$$locId'] },
                    { $in: ['$$locId', { $ifNull: ['$allIdValues', []] }] },
                    { $in: ['$$locIdStr', { $ifNull: ['$allIdValues', []] }] },
                    { 
                      $and: [
                        { $ne: ['$$envId', null] },
                        { $in: ['$$envId', { $ifNull: ['$eitjeIds', []] }] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: 'location_unified',
        },
      },
      { $unwind: { path: '$location_unified', preserveNullAndEmptyArrays: true } },
      // CRITICAL: Set locationId and name from unified_location
      {
        $addFields: {
          locationId: {
            $ifNull: [
              '$location_unified.primaryId',
              '$locationId'
            ]
          },
          resolved_location_name: {
            $ifNull: [
              '$location_unified.canonicalName',
              {
                $ifNull: [
                  '$location_unified.primaryName',
                  {
                    $ifNull: [
                      '$extracted_location_name',
                      'Unknown'
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
            period: getPeriodExpression(period),
            locationId: '$locationId',
          },
          location_name: { $first: '$resolved_location_name' },
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
          location_name: 1,
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
    
    // ROBUST APPROACH: Delete documents for periods that have new/changed data, then insert new ones
    const collection = db.collection('eitje_location_aggregation');
    
    const periodsToUpdate = new Set<string>();
    aggregatedData.forEach((doc: any) => {
      if (doc.period) periodsToUpdate.add(doc.period);
    });
    
    const deleteFilter: any = { period_type: period };
    
    if (periodsToUpdate.size > 0) {
      deleteFilter.period = { $in: Array.from(periodsToUpdate) };
    } else if (!startDate && !endDate) {
      // Full rebuild
    } else {
      results.push({
        period,
        type: 'location',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const deleteResult = await collection.deleteMany(deleteFilter);
    
    let insertResult;
    if (aggregatedData.length > 0) {
      insertResult = await collection.insertMany(aggregatedData, { ordered: false });
    } else {
      insertResult = { insertedCount: 0, insertedIds: {} };
    }
    
    results.push({
      period,
      type: 'location',
      recordsProcessed: aggregatedData.length,
      recordsCreated: insertResult.insertedCount || 0,
      recordsUpdated: 0,
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
      // Extract IDs for lookups
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
          },
          extracted_location_name: {
            $ifNull: [
              '$extracted.locationName',
              {
                $ifNull: [
                  '$extracted.environment_name',
                  {
                    $ifNull: [
                      '$rawApiResponse.location_name',
                      {
                        $ifNull: [
                          '$rawApiResponse.location?.name',
                          {
                            $ifNull: [
                              '$rawApiResponse.environment_name',
                              '$rawApiResponse.environment?.name'
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
      // Lookup unified_location
      {
        $lookup: {
          from: 'unified_location',
          let: { 
            locId: '$locationId',
            locIdStr: { $toString: { $ifNull: ['$locationId', ''] } },
            envId: '$environmentId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$primaryId', '$$locId'] },
                    { $in: ['$$locId', { $ifNull: ['$allIdValues', []] }] },
                    { $in: ['$$locIdStr', { $ifNull: ['$allIdValues', []] }] },
                    { 
                      $and: [
                        { $ne: ['$$envId', null] },
                        { $in: ['$$envId', { $ifNull: ['$eitjeIds', []] }] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: 'location_unified',
        },
      },
      { $unwind: { path: '$location_unified', preserveNullAndEmptyArrays: true } },
      // Lookup unified_user
      {
        $lookup: {
          from: 'unified_user',
          let: { userId: '$extracted_user_id' },
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
      // Lookup unified_team
      {
        $lookup: {
          from: 'unified_team',
          let: { teamId: '$extracted_team_id' },
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
      // CRITICAL: Set locationId and names from unified collections
      {
        $addFields: {
          locationId: {
            $ifNull: [
              '$location_unified.primaryId',
              '$locationId'
            ]
          },
          resolved_location_name: {
            $ifNull: [
              '$location_unified.canonicalName',
              {
                $ifNull: [
                  '$location_unified.primaryName',
                  {
                    $ifNull: [
                      '$extracted_location_name',
                      'Unknown'
                    ]
                  }
                ]
              }
            ]
          },
          resolved_user_name: {
            $ifNull: [
              '$user_unified.canonicalName',
              {
                $ifNull: [
                  '$user_unified.primaryName',
                  'Unknown'
                ]
              }
            ]
          },
          resolved_team_name: {
            $ifNull: [
              '$team_unified.canonicalName',
              {
                $ifNull: [
                  '$team_unified.primaryName',
                  'Unknown'
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            period: getPeriodExpression(period),
            userId: '$extracted_user_id',
            locationId: '$locationId',
            teamId: '$extracted_team_id',
          },
          location_name: { $first: '$resolved_location_name' },
          user_name: { $first: '$resolved_user_name' },
          team_name: { $first: '$resolved_team_name' },
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
          location_name: 1,
          user_name: 1,
          team_name: 1,
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
    
    // ROBUST APPROACH: Delete documents for periods that have new/changed data, then insert new ones
    const collection = db.collection('eitje_user_aggregation');
    
    const periodsToUpdate = new Set<string>();
    aggregatedData.forEach((doc: any) => {
      if (doc.period) periodsToUpdate.add(doc.period);
    });
    
    const deleteFilter: any = { period_type: period };
    
    if (periodsToUpdate.size > 0) {
      deleteFilter.period = { $in: Array.from(periodsToUpdate) };
    } else if (!startDate && !endDate) {
      // Full rebuild
    } else {
      results.push({
        period,
        type: 'user',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const deleteResult = await collection.deleteMany(deleteFilter);
    
    let insertResult;
    if (aggregatedData.length > 0) {
      insertResult = await collection.insertMany(aggregatedData, { ordered: false });
    } else {
      insertResult = { insertedCount: 0, insertedIds: {} };
    }
    
    results.push({
      period,
      type: 'user',
      recordsProcessed: aggregatedData.length,
      recordsCreated: insertResult.insertedCount || 0,
      recordsUpdated: 0,
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
      // Lookup unified_location
      {
        $lookup: {
          from: 'unified_location',
          let: { 
            locId: '$locationId',
            locIdStr: { $toString: { $ifNull: ['$locationId', ''] } },
            envId: '$environmentId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$primaryId', '$$locId'] },
                    { $in: ['$$locId', { $ifNull: ['$allIdValues', []] }] },
                    { $in: ['$$locIdStr', { $ifNull: ['$allIdValues', []] }] },
                    { 
                      $and: [
                        { $ne: ['$$envId', null] },
                        { $in: ['$$envId', { $ifNull: ['$eitjeIds', []] }] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: 'location_unified',
        },
      },
      { $unwind: { path: '$location_unified', preserveNullAndEmptyArrays: true } },
      // CRITICAL: Set locationId and name from unified_location
      {
        $addFields: {
          locationId: {
            $ifNull: [
              '$location_unified.primaryId',
              '$locationId'
            ]
          },
          resolved_location_name: {
            $ifNull: [
              '$location_unified.canonicalName',
              {
                $ifNull: [
                  '$location_unified.primaryName',
                  'Unknown'
                ]
              }
            ]
          }
        }
      },
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
          location_name: { $first: '$resolved_location_name' },
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
          location_name: 1,
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
    
    // ROBUST APPROACH: Delete documents for periods that have new/changed data, then insert new ones
    const collection = db.collection('eitje_event_aggregation');
    
    const periodsToUpdate = new Set<string>();
    aggregatedData.forEach((doc: any) => {
      if (doc.period) periodsToUpdate.add(doc.period);
    });
    
    const deleteFilter: any = { period_type: period };
    
    if (periodsToUpdate.size > 0) {
      deleteFilter.period = { $in: Array.from(periodsToUpdate) };
    } else if (!startDate && !endDate) {
      // Full rebuild
    } else {
      results.push({
        period,
        type: 'event',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      });
      continue;
    }
    
    const deleteResult = await collection.deleteMany(deleteFilter);
    
    let insertResult;
    if (aggregatedData.length > 0) {
      insertResult = await collection.insertMany(aggregatedData, { ordered: false });
    } else {
      insertResult = { insertedCount: 0, insertedIds: {} };
    }
    
    results.push({
      period,
      type: 'event',
      recordsProcessed: aggregatedData.length,
      recordsCreated: insertResult.insertedCount || 0,
      recordsUpdated: 0,
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

/**
 * Validate that aggregated collections don't have more documents than raw data
 * This helps detect duplicates. Also validates specific users like Alvinio.
 */
export async function validateAggregationCounts(): Promise<{
  valid: boolean;
  issues: Array<{
    collection: string;
    aggregatedCount: number;
    rawDataCount: number;
    issue: string;
  }>;
  userValidation: Array<{
    userName: string;
    userId: any;
    rawDataRecords: number;
    rawDataHours: number;
    aggregatedRecords: number;
    aggregatedHours: number;
    issue?: string;
  }>;
}> {
  const db = await getDatabase();
  const issues: Array<{
    collection: string;
    aggregatedCount: number;
    rawDataCount: number;
    issue: string;
  }> = [];
  
  // Count raw data records for time_registration and planning
  const timeRegRawCount = await db.collection('eitje_raw_data').countDocuments({
    endpoint: 'time_registration_shifts'
  });
  const planningRawCount = await db.collection('eitje_raw_data').countDocuments({
    endpoint: 'planning_shifts'
  });
  
  // Count aggregated records by period_type
  const timeRegByPeriod = await db.collection('eitje_time_registration_aggregation').aggregate([
    { $group: { _id: '$period_type', count: { $sum: 1 } } }
  ]).toArray();
  const planningByPeriod = await db.collection('eitje_planning_registration_aggregation').aggregate([
    { $group: { _id: '$period_type', count: { $sum: 1 } } }
  ]).toArray();
  
  const timeRegAggCount = timeRegByPeriod.reduce((sum, p) => sum + p.count, 0);
  const planningAggCount = planningByPeriod.reduce((sum, p) => sum + p.count, 0);
  
  // Check for actual duplicates: same period+period_type+locationId+userId+teamId combination
  const timeRegDuplicates = await db.collection('eitje_time_registration_aggregation').aggregate([
    {
      $group: {
        _id: {
          period: '$period',
          period_type: '$period_type',
          locationId: '$locationId',
          userId: '$userId',
          teamId: '$teamId',
        },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $count: 'duplicates' }
  ]).toArray();
  
  const planningDuplicates = await db.collection('eitje_planning_registration_aggregation').aggregate([
    {
      $group: {
        _id: {
          period: '$period',
          period_type: '$period_type',
          locationId: '$locationId',
          userId: '$userId',
          teamId: '$teamId',
        },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $count: 'duplicates' }
  ]).toArray();
  
  const timeRegDuplicateCount = timeRegDuplicates[0]?.duplicates || 0;
  const planningDuplicateCount = planningDuplicates[0]?.duplicates || 0;
  
  // Only report as issue if there are actual duplicates (same period+location+user+team)
  // Note: One raw record can create multiple aggregated documents (one per period type), so
  // aggregated count > raw count is expected and NOT an issue
  if (timeRegDuplicateCount > 0) {
    issues.push({
      collection: 'eitje_time_registration_aggregation',
      aggregatedCount: timeRegAggCount,
      rawDataCount: timeRegRawCount,
      issue: `Found ${timeRegDuplicateCount} duplicate groups (same period+location+user+team combination). This indicates duplicates.`
    });
  }
  
  if (planningDuplicateCount > 0) {
    issues.push({
      collection: 'eitje_planning_registration_aggregation',
      aggregatedCount: planningAggCount,
      rawDataCount: planningRawCount,
      issue: `Found ${planningDuplicateCount} duplicate groups (same period+location+user+team combination). This indicates duplicates.`
    });
  }
  
  // Validate specific users - check Alvinio and others
  const userValidation: Array<{
    userName: string;
    userId: any;
    rawDataRecords: number;
    rawDataHours: number;
    aggregatedRecords: number;
    aggregatedHours: number;
    issue?: string;
  }> = [];
  
  // Find users in raw data
  const rawUsers = await db.collection('eitje_raw_data').aggregate([
    {
      $match: {
        endpoint: 'time_registration_shifts',
        $or: [
          { 'extracted.userId': { $ne: null } },
          { 'rawApiResponse.user_id': { $ne: null } }
        ]
      }
    },
    {
      $group: {
        _id: {
          $ifNull: ['$extracted.userId', '$rawApiResponse.user_id']
        },
        userName: {
          $first: {
            $ifNull: [
              '$extracted.user_name',
              { $ifNull: ['$rawApiResponse.user_name', '$rawApiResponse.user?.name'] }
            ]
          }
        },
        recordCount: { $sum: 1 },
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
  
  // Check aggregated data for same users
  for (const rawUser of rawUsers) {
    const userId = rawUser._id;
    const userName = rawUser.userName || 'Unknown';
    
    // Get aggregated data for this user
    const aggregatedUser = await db.collection('eitje_time_registration_aggregation').aggregate([
      {
        $match: {
          userId: userId
        }
      },
      {
        $group: {
          _id: null,
          recordCount: { $sum: '$record_count' },
          totalHours: { $sum: '$total_hours' }
        }
      }
    ]).toArray();
    
    const aggRecordCount = aggregatedUser[0]?.recordCount || 0;
    const aggTotalHours = aggregatedUser[0]?.totalHours || 0;
    
    // Check for issues
    let issue: string | undefined;
    if (aggRecordCount > rawUser.recordCount) {
      issue = `Aggregated has ${aggRecordCount} records but raw data only has ${rawUser.recordCount} records`;
    }
    if (Math.abs(aggTotalHours - rawUser.totalHours) > 0.1) {
      issue = (issue || '') + ` | Hours mismatch: aggregated=${aggTotalHours.toFixed(2)}, raw=${rawUser.totalHours.toFixed(2)}`;
    }
    
    userValidation.push({
      userName,
      userId,
      rawDataRecords: rawUser.recordCount,
      rawDataHours: rawUser.totalHours,
      aggregatedRecords: aggRecordCount,
      aggregatedHours: aggTotalHours,
      issue
    });
  }
  
  // Sort by issue (users with issues first)
  userValidation.sort((a, b) => {
    if (a.issue && !b.issue) return -1;
    if (!a.issue && b.issue) return 1;
    return 0;
  });
  
  return {
    valid: issues.length === 0 && userValidation.every(u => !u.issue),
    issues,
    userValidation
  };
}

/**
 * Clear all aggregated collections and reaggregate from scratch
 * This ensures no duplicates remain
 */
export async function clearAndReaggregateAll(
  startDate?: Date,
  endDate?: Date,
  types: AggregationType[] = ['time_registration', 'planning_registration', 'team', 'location', 'user', 'event'],
  periods: AggregationPeriod[] = ['day', 'week', 'month', 'year']
): Promise<{
  cleared: string[];
  results: AggregationResult[];
  validation: Awaited<ReturnType<typeof validateAggregationCounts>>;
}> {
  const db = await getDatabase();
  const cleared: string[] = [];
  
  // Clear all aggregated collections
  const collectionsToClear = [
    'eitje_time_registration_aggregation',
    'eitje_planning_registration_aggregation',
    'eitje_team_aggregation',
    'eitje_location_aggregation',
    'eitje_user_aggregation',
    'eitje_event_aggregation',
  ];
  
  for (const collectionName of collectionsToClear) {
    const result = await db.collection(collectionName).deleteMany({});
    cleared.push(`${collectionName}: ${result.deletedCount} documents deleted`);
    console.log(`[clearAndReaggregateAll] Cleared ${collectionName}: ${result.deletedCount} documents`);
  }
  
  // Reaggregate all
  const results = await aggregateAll(startDate, endDate, types, periods);
  
  // Validate counts
  const validation = await validateAggregationCounts();
  
  return {
    cleared,
    results,
    validation
  };
}
