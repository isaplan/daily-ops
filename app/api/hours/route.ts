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
      groupId = {
        location_id: {
          $ifNull: ['$locationId', null]
        },
      };
    } else {
      // Default: date + location
      groupId = {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        location_id: '$locationId',
      };
    }

    // Aggregate hours from eitje_raw_data
    const aggregation: any[] = [
      { 
        $match: eitjeQuery
      },
      {
        $group: {
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
        },
      },
    ];

    // Add lookups based on groupBy
    if (groupBy === 'location' || groupBy === 'date_location') {
      // First try unified locations collection by primaryId
      aggregation.push({
        $lookup: {
          from: 'location_unified',
          let: { locId: '$_id.location_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$primaryId', '$$locId']
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
      projection.location_id = '$_id.location_id';
      projection.environment_name = '$environment_name'; // Include for fallback
      // Use unified location names if available, otherwise fallback to regular location name
      if (groupBy === 'location') {
        projection.location_name = {
          $ifNull: [
            '$location_unified.canonicalName',
            {
              $ifNull: [
                '$location.name',
                {
                  $ifNull: [
                    '$environment_name',
                    'Unknown'
                  ]
                }
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

    // Fetch unified locations for location name mapping
    const locationIds = [...new Set(results.map((r) => r.location_id).filter(Boolean))];
    const unifiedLocationsMap = new Map<string, string[]>();
    
    if (locationIds.length > 0) {
      try {
        // Convert location IDs to ObjectIds and numbers for querying
        const objectIds: mongoose.Types.ObjectId[] = [];
        const eitjeNumbers: number[] = [];
        
        for (const id of locationIds) {
          try {
            // Try as ObjectId
            const objId = new mongoose.Types.ObjectId(id);
            objectIds.push(objId);
          } catch {
            // Try as number (Eitje ID)
            const num = Number(id);
            if (!isNaN(num)) {
              eitjeNumbers.push(num);
            }
          }
        }
        
        // Build query conditions
        const queryConditions: Array<{ primaryId?: { $in: mongoose.Types.ObjectId[] }; eitjeIds?: { $in: number[] } }> = [];
        if (objectIds.length > 0) {
          queryConditions.push({ primaryId: { $in: objectIds } });
        }
        if (eitjeNumbers.length > 0) {
          queryConditions.push({ eitjeIds: { $in: eitjeNumbers } });
        }
        
        if (queryConditions.length > 0) {
          const unifiedLocations = await db.collection('location_unified')
            .find({ $or: queryConditions })
            .toArray();
          
          // Build map: location_id -> array of location names (up to 3)
          for (const unified of unifiedLocations) {
            const names: string[] = [];
            
            // Add canonical name first
            if (unified.canonicalName) {
              names.push(unified.canonicalName);
            }
            
            // Add eitje names (up to 2 more to make 3 total)
            if (unified.eitjeNames && Array.isArray(unified.eitjeNames)) {
              for (const eitjeName of unified.eitjeNames) {
                if (names.length >= 3) break;
                if (eitjeName && !names.includes(eitjeName)) {
                  names.push(eitjeName);
                }
              }
            }
            
            // Add from allIds if we still need more
            if (names.length < 3 && unified.allIds && Array.isArray(unified.allIds)) {
              for (const idEntry of unified.allIds) {
                if (names.length >= 3) break;
                if (idEntry.name && !names.includes(idEntry.name)) {
                  names.push(idEntry.name);
                }
              }
            }
            
            // Map by primaryId (as string)
            if (unified.primaryId) {
              const primaryIdStr = unified.primaryId.toString();
              unifiedLocationsMap.set(primaryIdStr, names);
            }
            
            // Also map by eitjeIds (as strings)
            if (unified.eitjeIds && Array.isArray(unified.eitjeIds)) {
              for (const eitjeId of unified.eitjeIds) {
                unifiedLocationsMap.set(eitjeId.toString(), names);
              }
            }
          }
        }
      } catch (unifiedError) {
        console.error('Error fetching unified locations:', unifiedError);
      }
    }

    // Convert location_id in results to string and ensure location_name is set
    const resultsWithStringIds = results.map((result) => {
      const locationIdStr = result.location_id?.toString() || '';
      const unifiedNames = unifiedLocationsMap.get(locationIdStr) || [];
      
      // Get up to 3 location names from unified collection, or fallback to single name
      const location_names = unifiedNames.length > 0 
        ? unifiedNames.slice(0, 3)
        : result.location_name 
          ? [result.location_name]
          : ['Unknown'];
      
      return {
        ...result,
        location_id: locationIdStr,
        location_name: result.location_name || location_names[0] || 'Unknown',
        location_names: location_names, // Array of up to 3 names
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
