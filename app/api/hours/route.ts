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

    // Aggregate hours by date and location from eitje_raw_data
    const aggregation: any[] = [
      { 
        $match: eitjeQuery
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            location_id: '$locationId',
          },
          // Extract hours/revenue based on endpoint type
          total_hours: { 
            $sum: {
              $cond: [
                { $eq: ['$endpoint', 'time_registration_shifts'] },
                // For time_registration_shifts: extract hours
                {
                  $cond: [
                    { $ne: ['$extracted.hours', null] },
                    { $toDouble: '$extracted.hours' },
                    {
                      $cond: [
                        { $ne: ['$extracted.hoursWorked', null] },
                        { $toDouble: '$extracted.hoursWorked' },
                        {
                          $cond: [
                            { $ne: ['$rawApiResponse.hours', null] },
                            { $toDouble: '$rawApiResponse.hours' },
                            {
                              $cond: [
                                { $ne: ['$rawApiResponse.hours_worked', null] },
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
                // For time_registration_shifts: extract cost
                {
                  $cond: [
                    { $ne: ['$extracted.amount', null] },
                    { $divide: [{ $toDouble: '$extracted.amount' }, 100] },
                    {
                      $cond: [
                        { $ne: ['$extracted.amountInCents', null] },
                        { $divide: [{ $toDouble: '$extracted.amountInCents' }, 100] },
                        {
                          $cond: [
                            { $ne: ['$rawApiResponse.amt_in_cents', null] },
                            { $divide: [{ $toDouble: '$rawApiResponse.amt_in_cents' }, 100] },
                            0
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
        },
      },
      {
        $lookup: {
          from: 'locations',
          localField: '_id.location_id',
          foreignField: '_id',
          as: 'location',
        },
      },
      {
        $unwind: {
          path: '$location',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          location_id: '$_id.location_id',
          location_name: '$location.name',
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
        },
      },
    ];

    // Add sorting
    const sortField = sortBy === 'date' ? 'date' : sortBy === 'location' ? 'location_name' : 'total_hours';
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
        // Run aggregation on eitje_raw_data collection
        results = await db.collection('eitje_raw_data').aggregate(aggregation).toArray();
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

    // Convert location_id in results to string
    const resultsWithStringIds = results.map((result) => ({
      ...result,
      location_id: result.location_id?.toString() || '',
    }));

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
