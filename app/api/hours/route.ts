/**
 * @registry-id: hoursAPI
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-22T00:00:00.000Z
 * @description: API route for hours data - aggregated by day and location
 * @last-fix: [2026-01-22] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/mongodb.ts => dbConnect
 *   - app/models/LaborRecord.ts => LaborRecord model
 *   - app/models/Location.ts => Location model
 * 
 * @exports-to:
 *   ✓ app/(authenticated)/hours/page.tsx => Fetches hours data
 */

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import LaborRecord from '@/models/LaborRecord';
import Location from '@/models/Location';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const db = await getDatabase();
    
    // Check if models are available
    if (!LaborRecord || !Location) {
      throw new Error('Models not initialized');
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const locationId = searchParams.get('locationId');
    const endpoint = searchParams.get('endpoint') || 'time_registration_shifts';
    const groupBy = searchParams.get('groupBy') || 'date_location'; // date_location, day, worker, team, location
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query for eitje_raw_data collection
    const eitjeQuery: any = {
      endpoint: endpoint,
    };
    
    // Date filtering
    if (startDate || endDate) {
      eitjeQuery.date = {};
      if (startDate) {
        eitjeQuery.date.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        eitjeQuery.date.$lte = end;
      }
    } else {
      // Default to last 30 days if no date range specified
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      eitjeQuery.date = { $gte: thirtyDaysAgo };
    }

    // Location filtering (eitje_raw_data uses locationId, not location_id)
    if (locationId && locationId !== 'all') {
      try {
        eitjeQuery.locationId = new mongoose.Types.ObjectId(locationId);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Invalid location ID' },
          { status: 400 }
        );
      }
    }

    // Aggregate hours from eitje_raw_data
    const aggregation: any[] = [
      { 
        $match: eitjeQuery
      },
    ];

    // For location grouping, we need to lookup unified_location FIRST, then group by primaryId
    if (groupBy === 'location') {
      // Step 1: Lookup unified_location to get primaryId
      aggregation.push({
        $lookup: {
          from: 'unified_location',
          let: { 
            locId: '$locationId',
            envId: '$environmentId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    // Match by primaryId (ObjectId)
                    { $eq: ['$primaryId', '$$locId'] },
                    // Match by eitjeIds when locationId is null (unmapped environments)
                    { 
                      $and: [
                        { $ne: ['$$envId', null] },
                        { $in: ['$$envId', '$eitjeIds'] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: 'location_unified',
        },
      });
      aggregation.push({
        $unwind: {
          path: '$location_unified',
          preserveNullAndEmptyArrays: true,
        },
      });
      // Step 2: Add unified_primary_id field for grouping
      aggregation.push({
        $addFields: {
          unified_primary_id: {
            $ifNull: [
              '$location_unified.primaryId',
              // Fallback: use locationId if available, otherwise create a key from environmentId
              {
                $ifNull: [
                  '$locationId',
                  { $concat: ['env_', { $toString: { $ifNull: ['$environmentId', 'unknown'] } }] }
                ]
              }
            ]
          }
        }
      });
    }

    // Build grouping _id based on groupBy parameter
    let groupId: any = {};
    if (groupBy === 'day') {
      groupId = {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
      };
    } else if (groupBy === 'worker') {
      groupId = {
        worker_id: {
          $ifNull: [
            '$extracted.userId',
            {
              $ifNull: [
                '$rawApiResponse.user_id',
                '$rawApiResponse.user.id'
              ]
            }
          ]
        },
      };
    } else if (groupBy === 'team') {
      groupId = {
        team_id: {
          $ifNull: [
            '$extracted.teamId',
            {
              $ifNull: [
                '$rawApiResponse.team_id',
                '$rawApiResponse.team.id'
              ]
            }
          ]
        },
      };
    } else if (groupBy === 'location') {
      // Group by unified primaryId (already resolved in previous stage)
      groupId = '$unified_primary_id';
    } else {
      // Default: date + location
      groupId = {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        location_id: '$locationId',
      };
    }

    // Build $group stage object
    const groupStageObj: any = {
      _id: groupId,
      // Store environment info for location lookup
      environment_id: { $first: '$environmentId' },
      environment_name: {
        $first: {
          $ifNull: [
            '$extracted.environmentName',
            {
              $ifNull: [
                '$rawApiResponse.environment_name',
                {
                  $ifNull: [
                    '$rawApiResponse.environment.name',
                    null
                  ]
                }
              ]
            }
          ]
        }
      },
      // Extract hours/revenue based on endpoint type
      total_hours: { 
        $sum: {
          $cond: [
            { $eq: ['$endpoint', 'time_registration_shifts'] },
            // For time_registration_shifts: calculate hours from start/end times
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
                            // Calculate hours from start and end times, minus break time
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
                                        {
                                          $subtract: [
                                            { $toDate: '$rawApiResponse.end' },
                                            { $toDate: '$rawApiResponse.start' }
                                          ]
                                        },
                                        3600000 // milliseconds to hours
                                      ]
                                    },
                                    {
                                      $divide: [
                                        { $ifNull: [{ $toDouble: '$rawApiResponse.break_minutes' }, 0] },
                                        60 // break_minutes to hours
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
            // For revenue_days: extract revenue as "hours" (for display consistency)
            {
              $cond: [
                { $ne: ['$extracted.revenue', null] },
                { $toDouble: '$extracted.revenue' },
                {
                  $cond: [
                    { $ne: ['$rawApiResponse.revenue', null] },
                    { $toDouble: '$rawApiResponse.revenue' },
                    0
                  ]
                }
              ]
            }
          ]
        }
      },
      // Extract cost/revenue based on endpoint type
      total_cost: { 
        $sum: {
          $cond: [
            { $eq: ['$endpoint', 'time_registration_shifts'] },
            // For time_registration_shifts: extract cost (try multiple field paths)
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
            },
            // For revenue_days: extract revenue as cost
            {
              $cond: [
                { $ne: ['$extracted.revenue', null] },
                { $toDouble: '$extracted.revenue' },
                {
                  $cond: [
                    { $ne: ['$rawApiResponse.revenue', null] },
                    { $toDouble: '$rawApiResponse.revenue' },
                    0
                  ]
                }
              ]
            }
          ]
        }
      },
      record_count: { $sum: 1 },
      // Count distinct locations, workers, teams for summary stats
      location_ids: { $addToSet: '$locationId' },
      worker_ids: {
        $addToSet: {
          $ifNull: [
            '$extracted.userId',
            {
              $ifNull: [
                '$rawApiResponse.user_id',
                '$rawApiResponse.user.id'
              ]
            }
          ]
        }
      },
      team_ids: {
        $addToSet: {
          $ifNull: [
            '$extracted.teamId',
            {
              $ifNull: [
                '$rawApiResponse.team_id',
                '$rawApiResponse.team.id'
              ]
            }
          ]
        }
      },
    };

    // For location grouping, preserve unified location data
    if (groupBy === 'location') {
      groupStageObj.location_unified_data = { $first: '$location_unified' };
    }

    // Add the $group stage
    aggregation.push({
      $group: groupStageObj,
    });

    // Add lookups based on groupBy
    // For location grouping, unified_location lookup is already done before $group
    // The location_unified data is preserved in the $group stage
    if (groupBy === 'location') {
      // Use the preserved location_unified_data from $group stage
      aggregation.push({
        $addFields: {
          location_unified: '$location_unified_data'
        }
      });
      // Lookup unified_location again using the primaryId from _id (fallback if not preserved)
      aggregation.push({
        $lookup: {
          from: 'unified_location',
          localField: '_id',
          foreignField: 'primaryId',
          as: 'location_unified_fallback',
        },
      });
      aggregation.push({
        $addFields: {
          location_unified: {
            $ifNull: ['$location_unified', { $arrayElemAt: ['$location_unified_fallback', 0] }]
          }
        }
      });
      aggregation.push({
        $project: {
          location_unified_fallback: 0
        }
      });
      // Fallback to regular locations collection
      aggregation.push({
        $lookup: {
          from: 'locations',
          localField: '_id',
          foreignField: '_id',
          as: 'location',
        },
      });
      aggregation.push({
        $unwind: {
          path: '$location',
          preserveNullAndEmptyArrays: true,
        },
      });
    } else if (groupBy === 'date_location') {
      // First try unified locations collection by primaryId OR eitjeIds
      aggregation.push({
        $lookup: {
          from: 'unified_location',
          let: { 
            locId: '$_id.location_id',
            envId: '$environment_id'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    // Match by primaryId (ObjectId)
                    { $eq: ['$primaryId', '$$locId'] },
                    // Match by eitjeIds when locationId is null (unmapped environments)
                    { 
                      $and: [
                        { $ne: ['$$envId', null] },
                        { $in: ['$$envId', '$eitjeIds'] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: 'location_unified',
        },
      });
      aggregation.push({
        $unwind: {
          path: '$location_unified',
          preserveNullAndEmptyArrays: true,
        },
      });
      // Fallback to regular locations collection
      aggregation.push({
        $lookup: {
          from: 'locations',
          localField: '_id.location_id',
          foreignField: '_id',
          as: 'location',
        },
      });
      aggregation.push({
        $unwind: {
          path: '$location',
          preserveNullAndEmptyArrays: true,
        },
      });
    }

    if (groupBy === 'worker') {
      aggregation.push({
        $lookup: {
          from: 'members',
          localField: '_id.worker_id',
          foreignField: '_id',
          as: 'worker',
        },
      });
      aggregation.push({
        $unwind: {
          path: '$worker',
          preserveNullAndEmptyArrays: true,
        },
      });
    }

    if (groupBy === 'team') {
      aggregation.push({
        $lookup: {
          from: 'teams',
          localField: '_id.team_id',
          foreignField: '_id',
          as: 'team',
        },
      });
      aggregation.push({
        $unwind: {
          path: '$team',
          preserveNullAndEmptyArrays: true,
        },
      });
    }

    // Build projection based on groupBy
    let projection: any = {
      _id: 0,
      total_hours: 1,
      total_cost: 1,
      record_count: 1,
      location_count: { $size: '$location_ids' },
      worker_count: { $size: { $filter: { input: '$worker_ids', as: 'w', cond: { $ne: ['$$w', null] } } } },
      team_count: { $size: { $filter: { input: '$team_ids', as: 't', cond: { $ne: ['$$t', null] } } } },
    };

    if (groupBy === 'day' || groupBy === 'date_location') {
      projection.date = '$_id.date';
    }
    if (groupBy === 'location' || groupBy === 'date_location') {
      // For location grouping, _id is the primaryId (ObjectId)
      // For date_location grouping, _id is { date, location_id }
      if (groupBy === 'location') {
        projection.location_id = '$_id';
      } else {
        projection.location_id = '$_id.location_id';
      }
      projection.environment_name = '$environment_name'; // Include for fallback
      // Use unified location names if available, otherwise fallback to regular location name
      if (groupBy === 'location') {
        projection.location_name = {
          $ifNull: [
            '$location_unified.canonicalName',
            {
              $ifNull: [
                '$location.name',
                'Unknown'
              ]
            }
          ]
        };
        // Also include all location names from unified collection (up to 3)
        projection.location_names = {
          $cond: [
            { $ne: ['$location_unified', null] },
            {
              $slice: [
                {
                  $concatArrays: [
                    { $ifNull: ['$location_unified.eitjeNames', []] },
                    {
                      $map: {
                        input: { $ifNull: ['$location_unified.allIds', []] },
                        as: 'item',
                        in: '$$item.name'
                      }
                    }
                  ]
                },
                0,
                3
              ]
            },
            []
          ]
        };
        // Include abbreviation from unified collection
        projection.location_abbreviation = '$location_unified.abbreviation';
      } else {
        projection.location_name = {
          $ifNull: [
            '$location_unified.canonicalName',
            {
              $ifNull: [
                '$location.name',
                'Unknown'
              ]
            }
          ]
        };
      }
    }
    if (groupBy === 'worker') {
      projection.worker_id = '$_id.worker_id';
      projection.worker_name = { $ifNull: ['$worker.name', 'Unknown'] };
    }
    if (groupBy === 'team') {
      projection.team_id = '$_id.team_id';
      projection.team_name = { $ifNull: ['$team.name', 'Unknown'] };
    }

    aggregation.push({
      $project: projection,
    });
    
    // Filter out rows with zero values (no actual data) - only for date_location grouping
    if (groupBy === 'date_location') {
      aggregation.push({
        $match: {
          $or: [
            { total_hours: { $gt: 0 } },
            { total_cost: { $gt: 0 } },
          ],
        },
      });
    }

    // Add sorting - map sortBy to actual field names
    let sortField = 'total_hours';
    if (sortBy === 'date') sortField = 'date';
    else if (sortBy === 'location' || sortBy === 'location_name') sortField = 'location_name';
    else if (sortBy === 'worker' || sortBy === 'worker_name') sortField = 'worker_name';
    else if (sortBy === 'team' || sortBy === 'team_name') sortField = 'team_name';
    else if (sortBy === 'total_hours') sortField = 'total_hours';
    
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    aggregation.push({ $sort: { [sortField]: sortDirection } });

    let results: any[] = [];
    try {
      // Check if eitje_raw_data collection has data
      const totalCount = await db.collection('eitje_raw_data').countDocuments({});
      const endpointCount = await db.collection('eitje_raw_data').countDocuments({ endpoint: 'time_registration_shifts' });
      const queryCount = await db.collection('eitje_raw_data').countDocuments(eitjeQuery);
      
      // Log for debugging - always log data availability
      console.log(`[Hours API] Total eitje_raw_data records: ${totalCount}`);
      console.log(`[Hours API] ${endpoint} records: ${endpointCount}`);
      console.log(`[Hours API] Records matching query: ${queryCount}`);
      
      // Check what endpoints actually exist
      if (totalCount > 0) {
        const endpoints = await db.collection('eitje_raw_data').distinct('endpoint');
        console.log(`[Hours API] Available endpoints in database: ${endpoints.join(', ')}`);
        
        // Count records per endpoint
        for (const ep of endpoints) {
          const epCount = await db.collection('eitje_raw_data').countDocuments({ endpoint: ep });
          console.log(`[Hours API] ${ep}: ${epCount} records`);
        }
      } else {
        console.log(`[Hours API] No data in eitje_raw_data collection yet. Run the sync crons to populate data.`);
      }
      
      if (queryCount === 0) {
        // No data matching query, return empty results
        results = [];
      } else {
        // Debug: Log a sample document FIRST to see actual structure
        const sampleDoc = await db.collection('eitje_raw_data').findOne(eitjeQuery);
        if (sampleDoc) {
          console.log('[Hours API] Sample document structure:');
          console.log('[Hours API] - endpoint:', sampleDoc.endpoint);
          console.log('[Hours API] - date:', sampleDoc.date);
          console.log('[Hours API] - locationId:', sampleDoc.locationId);
          console.log('[Hours API] - extracted keys:', Object.keys(sampleDoc.extracted || {}));
          console.log('[Hours API] - extracted.hours:', sampleDoc.extracted?.hours);
          console.log('[Hours API] - extracted.hoursWorked:', sampleDoc.extracted?.hoursWorked);
          console.log('[Hours API] - extracted.amount:', sampleDoc.extracted?.amount);
          console.log('[Hours API] - extracted.amountInCents:', sampleDoc.extracted?.amountInCents);
          console.log('[Hours API] - rawApiResponse keys:', Object.keys(sampleDoc.rawApiResponse || {}));
          if (sampleDoc.rawApiResponse) {
          console.log('[Hours API] - rawApiResponse.start:', sampleDoc.rawApiResponse.start);
          console.log('[Hours API] - rawApiResponse.end:', sampleDoc.rawApiResponse.end);
          console.log('[Hours API] - rawApiResponse.break_minutes:', sampleDoc.rawApiResponse.break_minutes);
          if (sampleDoc.rawApiResponse.start && sampleDoc.rawApiResponse.end) {
            const start = new Date(sampleDoc.rawApiResponse.start);
            const end = new Date(sampleDoc.rawApiResponse.end);
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            console.log('[Hours API] - Calculated hours from start/end:', hours);
          }
          }
        }
        
        // Run aggregation on eitje_raw_data collection
        results = await db.collection('eitje_raw_data').aggregate(aggregation).toArray();
        
        // For location grouping, deduplicate by location_id to ensure unique locations
        if (groupBy === 'location' && results.length > 0) {
          const deduplicatedMap = new Map<string, any>();
          for (const result of results) {
            const locationId = result.location_id?.toString() || 'unknown';
            if (deduplicatedMap.has(locationId)) {
              // Merge duplicate: sum up values
              const existing = deduplicatedMap.get(locationId);
              existing.total_hours = (existing.total_hours || 0) + (result.total_hours || 0);
              existing.total_cost = (existing.total_cost || 0) + (result.total_cost || 0);
              existing.record_count = (existing.record_count || 0) + (result.record_count || 0);
              // For worker_count, we can't easily merge without worker_ids, so use the larger value
              // (The aggregation already counts distinct workers per group, so max is reasonable)
              existing.worker_count = Math.max(existing.worker_count || 0, result.worker_count || 0);
              // Keep the first location_name/location_names
              if (!existing.location_name && result.location_name) {
                existing.location_name = result.location_name;
              }
              if (!existing.location_names && result.location_names) {
                existing.location_names = result.location_names;
              }
              if (!existing.location_abbreviation && result.location_abbreviation) {
                existing.location_abbreviation = result.location_abbreviation;
              }
            } else {
              deduplicatedMap.set(locationId, { ...result });
            }
          }
          results = Array.from(deduplicatedMap.values());
          console.log('[Hours API] After deduplication:', results.length, 'unique locations');
        }
        
        console.log('[Hours API] Aggregation results count:', results.length);
        if (results.length > 0) {
          console.log('[Hours API] Sample result:', JSON.stringify(results[0], null, 2));
        } else {
          console.log('[Hours API] No results from aggregation - checking if filter is too strict...');
          // Try aggregation without the zero-value filter to see what we get
          const aggregationWithoutFilter = aggregation.slice(0, -1); // Remove last $match
          const resultsWithoutFilter = await db.collection('eitje_raw_data').aggregate(aggregationWithoutFilter).toArray();
          console.log('[Hours API] Results without zero-value filter:', resultsWithoutFilter.length);
          if (resultsWithoutFilter.length > 0) {
            console.log('[Hours API] Sample result (no filter):', JSON.stringify(resultsWithoutFilter[0], null, 2));
          }
        }
      }
    } catch (aggError: any) {
      console.error('Aggregation error:', aggError);
      console.error('Error details:', {
        message: aggError?.message,
        stack: aggError?.stack,
        name: aggError?.name,
      });
      // If aggregation fails, return empty results instead of crashing
      results = [];
    }

    // Get all locations for filter dropdown
    let locations: any[] = [];
    try {
      locations = await Location.find({ is_active: true })
        .select('_id name')
        .sort({ name: 1 })
        .lean();
    } catch (locError) {
      console.error('Location fetch error:', locError);
      locations = [];
    }

    // Convert location _id to string for frontend
    const locationsWithStringIds = locations.map((loc) => ({
      _id: loc._id.toString(),
      name: loc.name,
    }));

    // Convert location_id in results to string and ensure location_name is set
    // Also handle environment-based grouping (location_id starting with "env_")
    const resultsWithStringIds = results.map((result) => {
      const locationIdStr = result.location_id?.toString() || '';
      
      // If location_id starts with "env_", extract the environment ID for lookup
      let envIdForLookup: number | null = null;
      if (locationIdStr.startsWith('env_')) {
        const envIdStr = locationIdStr.replace('env_', '');
        envIdForLookup = Number(envIdStr);
        if (isNaN(envIdForLookup)) {
          envIdForLookup = null;
        }
      }
      
      // Get location names and abbreviation from result (already populated by aggregation)
      const location_names = result.location_names && Array.isArray(result.location_names) && result.location_names.length > 0
        ? result.location_names.slice(0, 3)
        : result.location_name 
          ? [result.location_name]
          : ['Unknown'];
      
      return {
        ...result,
        location_id: locationIdStr,
        location_name: result.location_name || location_names[0] || 'Unknown',
        location_names: location_names, // Array of up to 3 names
        location_abbreviation: result.location_abbreviation || undefined,
        // Ensure numeric values are properly set (not null/undefined)
        total_hours: result.total_hours || 0,
        total_cost: result.total_cost || 0,
        record_count: result.record_count || 0,
      };
    }).filter((result) => {
      // Additional filter: only include rows with actual data
      return result.total_hours > 0 || result.total_cost > 0;
    });

    return NextResponse.json({
      success: true,
      data: resultsWithStringIds,
      locations: locationsWithStringIds,
    });
  } catch (error) {
    console.error('Error fetching hours data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch hours data',
        details: process.env.NODE_ENV === 'development' ? {
          message: errorMessage,
          stack: errorStack,
        } : undefined
      },
      { status: 500 }
    );
  }
}
