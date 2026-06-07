/**
 * @registry-id: dailyOpsSnapshotVersionGet
 * @created: 2026-06-08T00:00:00.000Z
 * @last-modified: 2026-06-08T00:00:00.000Z
 * @description: Lightweight snapshot version check — returns max(lastBuiltAt) for today's register day.
 *   Used by client to detect when a snapshot rebuild has landed after a Bork/Eitje cron run.
 *   Single indexed Mongo findOne per location; no aggregation math.
 * @last-fix: [2026-06-08] Initial — replaces illegal GET patch (patchTodayRevenueFromBork)
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ composables/useDailyOpsDashboardMetrics.ts
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const db = await getDb()

  const filter = ctx.locationId
    ? { businessDate: ctx.startDate, locationId: ctx.locationId }
    : { businessDate: ctx.startDate }

  const docs = await db
    .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master)
    .find(filter, { projection: { lastBuiltAt: 1 } })
    .toArray()

  let latestMs = 0
  for (const doc of docs) {
    const t = doc.lastBuiltAt instanceof Date ? doc.lastBuiltAt.getTime() : 0
    if (t > latestMs) latestMs = t
  }

  return {
    businessDate: ctx.startDate,
    lastBuiltAt: latestMs > 0 ? new Date(latestMs).toISOString() : null,
  }
})
