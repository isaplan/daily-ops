/**
 * @registry-id: v3AggregationOrchestrator
 * @created: 2026-04-28T20:05:00.000Z
 * @last-modified: 2026-04-28T20:05:00.000Z
 * @description: Orchestrates V3 snapshot aggregation pipeline for all locations
 * @last-fix: [2026-04-28] Initial V3 orchestrator
 * 
 * @exports-to:
 * ✓ server/services/borkSyncService.ts (trigger after Bork sync)
 * ✓ server/services/eitjeSyncService.ts (trigger after Eitje sync)
 * ✓ server/api/v3-aggregation/run.post.ts
 * 
 * @data-flow:
 * Raw data available → trigger orchestrator → run sales snapshot → run labor snapshot → run dashboard snapshot
 * 
 * @business-day: 06:00-05:59:59 UTC
 * @update-frequency: 6x daily (after each sync, or on schedule)
 */

import { Db, ObjectId } from 'mongodb'
import type { V3AggregationPipelineResult, SnapshotAggregationResult } from '~/types/daily-ops-v3'
import { getCurrentBusinessDate, isScheduledAggregationTime } from '~/server/utils/v3BusinessDay'
import { recordAggregationMetadata } from '~/server/utils/v3Snapshots'
import { rebuildV3SaleSnapshot } from './v3SalesSnapshot'
import { rebuildV3LaborSnapshot } from './v3LaborSnapshot'
import { rebuildV3DashboardSnapshot } from './v3DashboardSnapshot'

/**
 * Main V3 aggregation orchestrator
 * Call this after Bork sync or Eitje sync completes
 * Runs sales → labor → dashboard snapshots for all locations
 */
export async function runV3AggregationPipeline(
  db: Db,
  businessDate?: string,
  logFn?: (message: string) => void,
): Promise<V3AggregationPipelineResult> {
  const startTime = Date.now()
  const log = logFn || console.log

  try {
    // Use provided business date or current one
    const targetBusinessDate = businessDate || getCurrentBusinessDate()

    log(`[V3 Aggregation] Starting pipeline for business date: ${targetBusinessDate}`)

    // Get all locations
    const locations = await db
      .collection('locations')
      .find({})
      .toArray()

    log(`[V3 Aggregation] Found ${locations.length} locations`)

    if (locations.length === 0) {
      return {
        success: false,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0,
        locations: [],
        totalLocations: 0,
        successCount: 0,
        failureCount: 0,
        businessDate: targetBusinessDate,
        workingDayFinished: false,
        syncCount: 0,
        message: 'No locations found',
        error: 'No locations',
      }
    }

    const results: SnapshotAggregationResult[] = []
    let successCount = 0
    let failureCount = 0
    const allSteps: string[] = []

    // Process each location
    for (const location of locations) {
      const locationId = location._id as ObjectId
      const locationName = location.name || `Location ${locationId}`

      try {
        log(`[V3 Aggregation] Processing location: ${locationName}`)

        // Step 1: Build sales snapshot
        log(`  → Building sales snapshot...`)
        const salesResult = await rebuildV3SaleSnapshot(db, locationId, locationName, targetBusinessDate)
        allSteps.push(...salesResult.stepsExecuted)

        if (!salesResult.success) {
          log(`  ✗ Sales snapshot failed: ${salesResult.error}`)
          results.push(salesResult)
          failureCount += 1
          continue
        }

        log(`  ✓ Sales snapshot completed (${salesResult.durationMs}ms, sync #${salesResult.syncCount})`)

        // Step 2: Build labor snapshot
        log(`  → Building labor snapshot...`)
        const laborResult = await rebuildV3LaborSnapshot(db, locationId, locationName, targetBusinessDate)
        allSteps.push(...laborResult.stepsExecuted)

        if (!laborResult.success) {
          log(`  ✗ Labor snapshot failed: ${laborResult.error}`)
          results.push(laborResult)
          failureCount += 1
          continue
        }

        log(`  ✓ Labor snapshot completed (${laborResult.durationMs}ms, sync #${laborResult.syncCount})`)

        // Step 3: Build dashboard snapshot
        log(`  → Building dashboard snapshot...`)
        const dashboardResult = await rebuildV3DashboardSnapshot(
          db,
          locationId,
          locationName,
          targetBusinessDate,
        )
        allSteps.push(...dashboardResult.stepsExecuted)

        if (!dashboardResult.success) {
          log(`  ✗ Dashboard snapshot failed: ${dashboardResult.error}`)
          results.push(dashboardResult)
          failureCount += 1
          continue
        }

        log(
          `  ✓ Dashboard snapshot completed (${dashboardResult.durationMs}ms, sync #${dashboardResult.syncCount})`,
        )

        // Record successful run
        await recordAggregationMetadata(db, dashboardResult)

        results.push(dashboardResult)
        successCount += 1

        log(`  ✅ Location complete: ${locationName}`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        log(`  ✗ Location failed: ${errorMsg}`)
        failureCount += 1
        results.push({
          success: false,
          message: 'Unexpected error in aggregation',
          locationId,
          locationName,
          businessDate: targetBusinessDate,
          timestamp: new Date(),
          syncCount: 0,
          durationMs: Date.now() - startTime,
          stepsExecuted: allSteps,
          error: errorMsg,
        })
      }
    }

    const completedAt = new Date()
    const totalDurationMs = completedAt.getTime() - startTime

    log(`[V3 Aggregation] Pipeline completed`)
    log(`  → Success: ${successCount}/${locations.length}`)
    log(`  → Failed: ${failureCount}/${locations.length}`)
    log(`  → Total time: ${totalDurationMs}ms`)

    return {
      success: successCount === locations.length,
      startedAt: new Date(startTime),
      completedAt,
      durationMs: totalDurationMs,
      locations: results,
      totalLocations: locations.length,
      successCount,
      failureCount,
      businessDate: targetBusinessDate,
      workingDayFinished: false,
      syncCount: Math.max(...results.map(r => r.syncCount), 0),
      message: `V3 aggregation completed: ${successCount} success, ${failureCount} failed`,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`[V3 Aggregation] Pipeline failed: ${errorMsg}`)

    return {
      success: false,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
      locations: [],
      totalLocations: 0,
      successCount: 0,
      failureCount: 1,
      businessDate: businessDate || getCurrentBusinessDate(),
      workingDayFinished: false,
      syncCount: 0,
      message: 'V3 aggregation pipeline failed',
      error: errorMsg,
    }
  }
}

/**
 * Manual trigger for V3 aggregation (useful for debugging)
 */
export async function triggerV3Aggregation(
  db: Db,
  businessDate?: string,
): Promise<V3AggregationPipelineResult> {
  return runV3AggregationPipeline(db, businessDate, console.log)
}

/**
 * Check if V3 aggregation should run at current time
 */
export function shouldRunV3Aggregation(): boolean {
  return isScheduledAggregationTime(new Date())
}

/**
 * Get next V3 aggregation schedule time
 */
export function getNextV3AggregationTime(): Date {
  const scheduleHours = [6, 13, 16, 18, 20, 22]
  const now = new Date()
  const currentHour = now.getUTCHours()

  const nextHourToday = scheduleHours.find(h => h > currentHour)
  if (nextHourToday !== undefined) {
    const next = new Date(now)
    next.setUTCHours(nextHourToday, 0, 0, 0)
    return next
  }

  const next = new Date(now)
  next.setUTCDate(next.getUTCDate() + 1)
  next.setUTCHours(scheduleHours[0] ?? 6, 0, 0, 0)
  return next
}
