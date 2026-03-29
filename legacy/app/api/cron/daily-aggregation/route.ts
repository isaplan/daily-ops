/**
 * @registry-id: dailyAggregationCronRoute
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Cron route to build daily aggregated dashboard for all locations
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ Vercel cron or external scheduler => POST /api/cron/daily-aggregation
 */

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Location from '@/models/Location';
import { buildDailyAggregation } from '@/lib/services/aggregation/dailyOpsAggregationService';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  try {
    await dbConnect();
    const locations = await Location.find({ is_active: true }).lean();
    if (locations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active locations',
        aggregations: 0,
        date: null,
      });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    const results: Array<{ locationId: string; success: boolean; dashboardId?: string; error?: string }> = [];
    for (const loc of locations) {
      const result = await buildDailyAggregation(dateStr, loc._id.toString());
      results.push({
        locationId: loc._id.toString(),
        success: result.success,
        dashboardId: result.dashboardId,
        error: result.error,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const integrityUrl = process.env.NUXT_APP_URL || process.env.DATA_INTEGRITY_URL;
    if (successCount > 0 && integrityUrl) {
      fetch(`${integrityUrl.replace(/\/$/, '')}/api/cron/data-integrity`).catch(() => {});
    }
    return NextResponse.json({
      success: successCount === results.length,
      date: dateStr,
      aggregations: successCount,
      total_locations: results.length,
      details: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
