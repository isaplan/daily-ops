/**
 * @registry-id: hoursAggregatedAPI
 * @created: 2026-01-25T20:00:00.000Z
 * @last-modified: 2026-01-25T20:00:00.000Z
 * @description: API route for hours data - reads from pre-aggregated collections with denormalized names and costs
 * @last-fix: [2026-01-25] Created new endpoint to query eitje_time_registration_aggregation instead of raw data. Eliminates lookups, uses pre-calculated costs and stored names.
 * 
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 * 
 * @exports-to:
 *   ✓ app/daily-ops/hours/** => All hours views use this endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/v2-connection';

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const searchParams = request.nextUrl.searchParams;
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const locationId = searchParams.get('locationId');
    const groupBy = searchParams.get('groupBy') || 'day'; // day, date_location, worker, team, location
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query for aggregated collection
    const query: any = {};
    
    if (startDate || endDate) {
      query.period = {};
      if (startDate) {
        // Extract just the date part (YYYY-MM-DD)
        query.period.$gte = startDate;
      }
      if (endDate) {
        query.period.$lte = endDate;
      }
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startStr = thirtyDaysAgo.toISOString().split('T')[0];
      query.period = { $gte: startStr };
    }

    // Filter by location if provided
    if (locationId && locationId !== 'all') {
      query.locationId = locationId;
    }

    // Query aggregated collection
    let aggregation: any[] = [
      { $match: query },
    ];

    // Build aggregation based on groupBy
    if (groupBy === 'day') {
      aggregation.push({
        $group: {
          _id: '$period',
          total_hours: { $sum: '$total_hours' },
          total_cost: { $sum: '$total_cost' },
          record_count: { $sum: '$record_count' },
          location_count: { $sum: 1 },
          worker_count: { $addToSet: '$userId' },
          team_count: { $addToSet: '$teamId' },
        }
      });
      aggregation.push({
        $project: {
          _id: 0,
          date: '$_id',
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          location_count: 1,
          worker_count: { $size: { $filter: { input: '$worker_count', as: 'w', cond: { $ne: ['$$w', null] } } } },
          team_count: { $size: { $filter: { input: '$team_count', as: 't', cond: { $ne: ['$$t', null] } } } },
        }
      });
    } else if (groupBy === 'team') {
      aggregation.push({
        $group: {
          _id: {
            teamId: '$teamId',
            team_name: '$team_name',
          },
          total_hours: { $sum: '$total_hours' },
          total_cost: { $sum: '$total_cost' },
          record_count: { $sum: '$record_count' },
          location_count: { $addToSet: '$locationId' },
          worker_count: { $addToSet: '$userId' },
          hourly_rate: { $first: '$hourly_rate' },
          contract_type: { $first: '$contract_type' },
        }
      });
      aggregation.push({
        $project: {
          _id: 0,
          team_id: '$_id.teamId',
          team_name: { $ifNull: ['$_id.team_name', 'Unknown'] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          location_count: { $size: { $filter: { input: '$location_count', as: 'l', cond: { $ne: ['$$l', null] } } } },
          worker_count: { $size: { $filter: { input: '$worker_count', as: 'w', cond: { $ne: ['$$w', null] } } } },
          hourly_rate: 1,
          contract_type: 1,
        }
      });
    } else if (groupBy === 'worker') {
      aggregation.push({
        $group: {
          _id: {
            userId: '$userId',
            user_name: '$user_name',
          },
          total_hours: { $sum: '$total_hours' },
          total_cost: { $sum: '$total_cost' },
          record_count: { $sum: '$record_count' },
          location_count: { $addToSet: '$locationId' },
          team_count: { $addToSet: '$teamId' },
          hourly_rate: { $first: '$hourly_rate' },
          contract_type: { $first: '$contract_type' },
        }
      });
      aggregation.push({
        $project: {
          _id: 0,
          worker_id: '$_id.userId',
          worker_name: { $ifNull: ['$_id.user_name', 'Unknown'] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          location_count: { $size: { $filter: { input: '$location_count', as: 'l', cond: { $ne: ['$$l', null] } } } },
          team_count: { $size: { $filter: { input: '$team_count', as: 't', cond: { $ne: ['$$t', null] } } } },
          hourly_rate: 1,
          contract_type: 1,
        }
      });
    } else if (groupBy === 'location') {
      aggregation.push({
        $group: {
          _id: {
            locationId: '$locationId',
            location_name: '$location_name',
          },
          total_hours: { $sum: '$total_hours' },
          total_cost: { $sum: '$total_cost' },
          record_count: { $sum: '$record_count' },
          worker_count: { $addToSet: '$userId' },
          team_count: { $addToSet: '$teamId' },
        }
      });
      aggregation.push({
        $project: {
          _id: 0,
          location_id: '$_id.locationId',
          location_name: { $ifNull: ['$_id.location_name', 'Unknown'] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          worker_count: { $size: { $filter: { input: '$worker_count', as: 'w', cond: { $ne: ['$$w', null] } } } },
          team_count: { $size: { $filter: { input: '$team_count', as: 't', cond: { $ne: ['$$t', null] } } } },
        }
      });
    } else {
      // date_location (default)
      aggregation.push({
        $project: {
          date: '$period',
          location_id: 1,
          location_name: 1,
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          worker_count: 1,
          team_count: 1,
        }
      });
    }

    // Add sorting
    let sortField = 'date';
    if (sortBy === 'location' || sortBy === 'location_name') sortField = 'location_name';
    else if (sortBy === 'team' || sortBy === 'team_name') sortField = 'team_name';
    else if (sortBy === 'worker' || sortBy === 'worker_name') sortField = 'worker_name';
    else if (sortBy === 'total_hours') sortField = 'total_hours';
    else if (sortBy === 'total_cost') sortField = 'total_cost';

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    aggregation.push({ $sort: { [sortField]: sortDirection } });

    const results = await db.collection('eitje_time_registration_aggregation').aggregate(aggregation).toArray();

    console.log(`[Hours API] Aggregation results from eitje_time_registration_aggregation: ${results.length} records`);
    if (results.length > 0) {
      console.log('[Hours API] Sample result:', JSON.stringify(results[0], null, 2).slice(0, 300));
    }

    return NextResponse.json({
      success: true,
      data: results,
      locations: [], // TODO: fetch from unified_location if needed
    });
  } catch (error) {
    console.error('Error fetching hours data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch hours data',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
