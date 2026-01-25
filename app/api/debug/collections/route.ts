/**
 * @registry-id: debugCollectionsRoute
 * @created: 2026-01-25T23:00:00.000Z
 * @last-modified: 2026-01-25T23:00:00.000Z
 * @description: Debug endpoint to inspect MongoDB collections for troubleshooting
 * @last-fix: [2026-01-25] Created debug endpoint for collection inspection
 *
 * @exports-to:
 *   ✓ Development/debugging only - no production dependencies
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/v2-connection';

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();

    const result: any = {};

    // unified_user sample
    const user = await db.collection('unified_user').findOne({});
    result.unified_user_sample = user ? {
      _id: user._id,
      canonicalName: user.canonicalName,
      hourly_rate: user.hourly_rate,
      eitjeIds: user.eitjeIds,
      allIdValues: user.allIdValues,
      keys: Object.keys(user).slice(0, 20),
    } : null;

    // aggregation sample
    const agg = await db.collection('eitje_time_registration_aggregation').findOne({});
    result.aggregation_sample = agg ? {
      user_name: agg.user_name,
      team_name: agg.team_name,
      location_name: agg.location_name,
      hourly_rate: agg.hourly_rate,
      total_cost: agg.total_cost,
      total_hours: agg.total_hours,
      userId: agg.userId,
      teamId: agg.teamId,
      keys: Object.keys(agg).slice(0, 20),
    } : null;

    // raw data sample
    const raw = await db.collection('eitje_raw_data').findOne({endpoint: 'time_registration_shifts'});
    result.raw_data_sample = raw ? {
      extracted_userId: raw.extracted?.userId,
      extracted_hours: raw.extracted?.hours,
      extracted_hourlyRate: raw.extracted?.hourlyRate,
      extracted_amount: raw.extracted?.amount,
      raw_user_id: raw.rawApiResponse?.user_id,
      raw_hours: raw.rawApiResponse?.hours,
    } : null;

    // Check specific user with eitjeId
    const specificUser = await db.collection('unified_user').findOne({eitjeIds: 115448});
    result.unified_user_with_eitjeId_115448 = specificUser ? {
      canonicalName: specificUser.canonicalName,
      hourly_rate: specificUser.hourly_rate,
      allIdValues: specificUser.allIdValues,
    } : 'NOT FOUND';

    return NextResponse.json(result);
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
