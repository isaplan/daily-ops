/**
 * @registry-id: hoursAggregatedAPI
 * @created: 2026-01-25T20:00:00.000Z
 * @last-modified: 2026-02-02T14:00:00.000Z
 * @description: API route for hours data - reads from pre-aggregated collections with denormalized names and costs; groupBy=worker&source=contracts reads test-eitje-contracts (* totaal gewerkte uren)
 * @last-fix: [2026-02-02] Added source=contracts for Hours by Worker from contract CSV
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
    const endpoint = searchParams.get('endpoint') || 'time_registration_shifts';
    const groupBy = searchParams.get('groupBy') || 'day'; // day, date_location, worker, team, location
    const source = searchParams.get('source'); // 'contracts' = Hours by worker from contract CSV (* totaal gewerkte uren)
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // When groupBy=worker and source=contracts, return worker totals from contract CSV (test-eitje-contracts)
    if (groupBy === 'worker' && source === 'contracts') {
      const contractDocs = await db.collection('test-eitje-contracts').find({}).toArray();
      const results = contractDocs
        .filter((d: { total_worked_hours?: number }) => (d.total_worked_hours ?? 0) > 0)
        .map((d: { employee_name?: string; support_id?: string; total_worked_hours?: number; hourly_rate?: number; total_worked_days?: number; contract_location?: string }) => ({
          worker_id: d.support_id ?? '',
          worker_name: d.employee_name ?? 'Unknown',
          total_hours: d.total_worked_hours ?? 0,
          total_cost: Math.round((d.total_worked_hours ?? 0) * (d.hourly_rate ?? 0) * 100) / 100,
          record_count: d.total_worked_days ?? 0,
          location_count: d.contract_location ? 1 : 0,
        }));
      const sortField = sortBy === 'total_cost' ? 'total_cost' : sortBy === 'worker_name' ? 'worker_name' : 'total_hours';
      const dir = sortOrder === 'asc' ? 1 : -1;
      results.sort((a: { total_hours: number; total_cost: number; worker_name: string }, b: { total_hours: number; total_cost: number; worker_name: string }) => {
        const va = sortField === 'worker_name' ? a.worker_name : sortField === 'total_cost' ? a.total_cost : a.total_hours;
        const vb = sortField === 'worker_name' ? b.worker_name : sortField === 'total_cost' ? b.total_cost : b.total_hours;
        return dir * (va < vb ? -1 : va > vb ? 1 : 0);
      });
      return NextResponse.json({
        success: true,
        data: results,
        summary: { total_records: results.length, group_by: 'worker', source: 'contracts' },
        locations: [],
      });
    }

    // Build query for aggregated collection
    // CRITICAL: Only query 'day' period_type to avoid counting same records multiple times
    // (one raw record creates documents for day/week/month/year, so summing all would 4x the count)
    const query: any = {
      period_type: 'day', // Only use day period to get accurate counts
    };
    
    if (startDate || endDate) {
      query.period = {};
      if (startDate) {
        // Period format is "YYYY-MM-DDT00:00:00.000Z" (e.g., "2025-12-27T00:00:00.000Z")
        // String comparison: "2025-12-27" < "2025-12-27T00:00:00.000Z" is true
        // So $gte with "2025-12-27" will match "2025-12-27T00:00:00.000Z" and later
        query.period.$gte = startDate;
      }
      if (endDate) {
        // For $lte, "2026-01-26" will match "2026-01-26T00:00:00.000Z" and earlier
        // But we want to include the full day, so we need to match up to "2026-01-26T23:59:59.999Z"
        // Since period is always "T00:00:00.000Z", "2026-01-26" <= "2026-01-26T00:00:00.000Z" is true
        // But "2026-01-27" > "2026-01-26T00:00:00.000Z" is true, so we need to use the next day
        // Actually, since period is always at start of day, $lte with endDate should work
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
      try {
        // Try to convert to ObjectId for proper matching
        const { ObjectId } = await import('mongodb');
        query.locationId = new ObjectId(locationId);
      } catch {
        // If conversion fails, use as string (might match if stored as string)
        query.locationId = locationId;
      }
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
      // Group by locationId, but use environmentId as fallback if locationId is null
      // This ensures locations with missing locationId but different environmentIds are grouped separately
      aggregation.push({
        $addFields: {
          grouping_location_id: {
            $ifNull: [
              '$locationId',
              // Fallback to environmentId if locationId is null (for unmapped locations)
              '$environmentId'
            ]
          }
        }
      });
      aggregation.push({
        $group: {
          _id: '$grouping_location_id',
          total_hours: { $sum: '$total_hours' },
          total_cost: { $sum: '$total_cost' },
          record_count: { $sum: '$record_count' },
          worker_count: { $addToSet: '$userId' },
          team_count: { $addToSet: '$teamId' },
          // Preserve original locationId and environmentId for lookup
          original_location_id: { $first: '$locationId' },
          original_environment_id: { $first: '$environmentId' },
        }
      });
      // Lookup unified_location to get proper location names and abbreviations
      // Fix: Handle null locationId and match ObjectId properly with multiple strategies
      aggregation.push({
        $lookup: {
          from: 'unified_location',
          let: { 
            locId: '$original_location_id',
            envId: '$original_environment_id',
            groupingId: '$_id',
            locIdStr: { 
              $cond: [
                { $eq: [{ $type: '$original_location_id' }, 'objectId'] },
                { $toString: '$original_location_id' },
                { $toString: { $ifNull: ['$original_location_id', ''] } }
              ]
            },
            envIdStr: { $toString: { $ifNull: ['$original_environment_id', ''] } }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    // Match by primaryId (ObjectId) - direct comparison with locationId
                    { $eq: ['$primaryId', '$$locId'] },
                    // Match by allIdValues - check both ObjectId and string forms
                    { $in: ['$$locId', { $ifNull: ['$allIdValues', []] }] },
                    { $in: ['$$locIdStr', { $ifNull: ['$allIdValues', []] }] },
                    // Match by eitjeIds (for unmapped environments) - check both locationId and environmentId
                    { $in: ['$$locId', { $ifNull: ['$eitjeIds', []] }] },
                    { $in: ['$$locIdStr', { $ifNull: ['$eitjeIds', []] }] },
                    { $in: ['$$envId', { $ifNull: ['$eitjeIds', []] }] },
                    { $in: ['$$envIdStr', { $ifNull: ['$eitjeIds', []] }] },
                    // Match by extracting IDs from allIds array structure (fallback)
                    {
                      $anyElementTrue: {
                        $map: {
                          input: { $ifNull: ['$allIds', []] },
                          as: 'idObj',
                          in: {
                            $or: [
                              { $eq: ['$$idObj.id', '$$locId'] },
                              { $eq: [{ $toString: '$$idObj.id' }, '$$locIdStr'] },
                              { $eq: ['$$idObj.id', '$$envId'] },
                              { $eq: [{ $toString: '$$idObj.id' }, '$$envIdStr'] }
                            ]
                          }
                        }
                      }
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
      aggregation.push({
        $project: {
          _id: 0,
          location_id: {
            $ifNull: ['$original_location_id', '$original_environment_id', '$_id']
          },
          location_name: {
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
          location_names: {
            $ifNull: [
              '$location_unified.eitjeNames',
              []
            ]
          },
          location_abbreviation: {
            $ifNull: ['$location_unified.abbreviation', null]
          },
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

    // Determine collection name based on endpoint
    let collectionName = 'eitje_time_registration_aggregation';
    if (endpoint === 'planning_shifts') {
      collectionName = 'eitje_planning_registration_aggregation';
    }

    const results = await db.collection(collectionName).aggregate(aggregation).toArray();

    // Build summary based on groupBy
    let summary: any = {
      total_records: results.length,
      group_by: groupBy,
    };

    if (groupBy === 'location' && results.length > 0) {
      const locationSummary = results.map((r: any) => ({
        location_id: r.location_id?.toString() || 'null',
        location_name: r.location_name || 'Unknown',
        location_abbreviation: r.location_abbreviation || null,
        total_hours: r.total_hours,
        total_cost: r.total_cost,
        worker_count: r.worker_count,
        record_count: r.record_count,
        matched_unified: !!r.location_names && r.location_names.length > 0,
      }));

      summary.locations = locationSummary;
      summary.total_locations = results.length;
      summary.total_hours = results.reduce((sum: number, r: any) => sum + (r.total_hours || 0), 0);
      summary.total_cost = results.reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0);
      summary.unknown_locations = results.filter((r: any) => r.location_name === 'Unknown').length;
    }

    console.log(`[Hours API] Aggregation results from ${collectionName}: ${results.length} records`);
    if (groupBy === 'location') {
      console.log('[Hours API] Location Summary:', JSON.stringify(summary, null, 2));
    }
    if (results.length > 0) {
      console.log('[Hours API] Sample result:', JSON.stringify(results[0], null, 2).slice(0, 500));
    }

    return NextResponse.json({
      success: true,
      data: results,
      summary: summary,
      locations: groupBy === 'location' ? summary.locations : [],
    });
  } catch (error) {
    console.error('[Hours Aggregated API] Error fetching hours data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[Hours Aggregated API] Error details:', {
      message: errorMessage,
      stack: errorStack,
      query: searchParams.toString()
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch hours data',
        details: process.env.NODE_ENV === 'development' ? {
          message: errorMessage,
          stack: errorStack
        } : undefined
      },
      { status: 500 }
    );
  }
}
