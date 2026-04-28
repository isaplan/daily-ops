/**
 * @registry-id: v3AggregationTriggerAPI
 * @created: 2026-04-28T20:35:00.000Z
 * @last-modified: 2026-04-28T20:35:00.000Z
 * @description: Manual trigger API for V3 aggregation - useful for testing and debugging
 * @last-fix: [2026-04-28] Initial manual trigger API
 * 
 * @exports-to:
 * ✓ Manual testing and debugging
 * 
 * POST /api/v3/aggregation/trigger
 * Body: { businessDate?: "2026-04-28" }
 */

import { runV3AggregationPipeline } from '~/server/services/v3Aggregation/v3AggregationOrchestrator'
import { getCurrentBusinessDate } from '~/server/utils/v3BusinessDay'

export default defineEventHandler(async (event) => {
  const db = await useDatabase()
  const body = await readBody(event)

  try {
    const businessDate = body?.businessDate || getCurrentBusinessDate()

    console.log(`[v3-aggregation-trigger] Manual trigger for business date: ${businessDate}`)

    const result = await runV3AggregationPipeline(db, businessDate, (msg) => {
      console.log(`[V3-Manual] ${msg}`)
    })

    return {
      success: result.success,
      message: result.message,
      businessDate: result.businessDate,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      totalLocations: result.totalLocations,
      successCount: result.successCount,
      failureCount: result.failureCount,
      locations: result.locations.map(r => ({
        locationId: r.locationId.toString(),
        locationName: r.locationName,
        success: r.success,
        syncCount: r.syncCount,
        durationMs: r.durationMs,
        message: r.message,
        error: r.error,
      })),
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[v3-aggregation-trigger] Error:', errorMsg)

    return createError({
      statusCode: 500,
      statusMessage: `V3 aggregation trigger failed: ${errorMsg}`,
    })
  }
})
