/**
 * @registry-id: aggregationsSyncRoute
 * @created: 2026-01-25T00:00:00.000Z
 * @last-modified: 2026-01-25T00:00:00.000Z
 * @description: API route to trigger aggregation and unified collection syncs
 * @last-fix: [2026-01-25] Updated collection names to use eitje_ prefix
 * 
 * @imports-from:
 *   - app/lib/services/aggregationService.ts => aggregateAll
 *   - app/lib/services/unifiedCollectionsService.ts => syncAllUnified
 * 
 * @exports-to:
 *   ✓ app/lib/cron/v2-cron-manager.ts => triggers after data sync
 *   ✓ app/(authenticated)/settings/eitje-api/page.tsx => manual sync trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { aggregateAll, AggregationType, AggregationPeriod } from '@/lib/services/aggregationService';
import { syncAllUnified } from '@/lib/services/unifiedCollectionsService';
import { triggerAggregationIfChanged, getAggregationStatus } from '@/lib/services/aggregationTrigger';

export const maxDuration = 600; // 10 minutes
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // Empty body is OK, use defaults
      body = {};
    }
    
    const {
      aggregationTypes = ['time_registration', 'planning_registration', 'team', 'location', 'user', 'event'],
      periods = ['day', 'week', 'month', 'year'],
      startDate,
      endDate,
      syncUnified = true,
      force = false, // Force aggregation even if no changes detected
      useTrigger = true, // Use smart trigger (change detection) vs direct aggregation
    } = body;

    // Use smart trigger if enabled (checks for changes, runs only once)
    if (useTrigger) {
      const triggerResult = await triggerAggregationIfChanged(
        force,
        aggregationTypes as AggregationType[],
        periods as AggregationPeriod[]
      );

      return NextResponse.json({
        success: triggerResult.triggered || !triggerResult.error,
        triggered: triggerResult.triggered,
        reason: triggerResult.reason,
        error: triggerResult.error,
        results: triggerResult.results,
      });
    }

    // Direct aggregation (legacy mode - no change detection)
    const results: any = {
      aggregations: [],
      unified: null,
    };

    // Run aggregations
    if (aggregationTypes.length > 0) {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      const aggregationResults = await aggregateAll(
        start,
        end,
        aggregationTypes as AggregationType[],
        periods as AggregationPeriod[]
      );

      results.aggregations = aggregationResults;
    }

    // Sync unified collections
    if (syncUnified) {
      const unifiedResults = await syncAllUnified();
      results.unified = unifiedResults;
    }

    // Calculate totals
    const totalProcessed = results.aggregations.reduce((sum: number, r: any) => sum + r.recordsProcessed, 0);
    const totalCreated = results.aggregations.reduce((sum: number, r: any) => sum + r.recordsCreated, 0);
    const totalUpdated = results.aggregations.reduce((sum: number, r: any) => sum + r.recordsUpdated, 0);

    return NextResponse.json({
      success: true,
      message: `Aggregation completed: ${totalProcessed} records processed, ${totalCreated} created, ${totalUpdated} updated`,
      results: {
        aggregations: {
          totalProcessed,
          totalCreated,
          totalUpdated,
          details: results.aggregations,
        },
        unified: results.unified,
      },
    });
  } catch (error: any) {
    console.error('[API /aggregations/sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync aggregations',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check aggregation status
 */
export async function GET(request: NextRequest) {
  try {
    const { getDatabase } = await import('@/lib/mongodb/v2-connection');
    const db = await getDatabase();

    // Get aggregation lock status
    const lockStatus = await getAggregationStatus();

    const collections = [
      'eitje_time_registration_aggregation',
      'eitje_planning_registration_aggregation',
      'eitje_team_aggregation',
      'eitje_location_aggregation',
      'eitje_user_aggregation',
      'eitje_event_aggregation',
      'location_unified',
      'team_unified',
      'user_unified',
    ];

    const stats: Record<string, any> = {};

    for (const collectionName of collections) {
      const count = await db.collection(collectionName).countDocuments({});
      const latest = await db.collection(collectionName)
        .findOne({}, { sort: { updatedAt: -1 } });

      stats[collectionName] = {
        count,
        lastUpdated: latest?.updatedAt || null,
      };
    }

    return NextResponse.json({
      success: true,
      lock: lockStatus,
      stats,
    });
  } catch (error: any) {
    console.error('[API /aggregations/sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get aggregation status',
      },
      { status: 500 }
    );
  }
}
