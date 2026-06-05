/**
 * @registry-id: dailyOpsMetricsBundle
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-06-05T17:50:00.000Z
 * @description: Single dashboard metrics bundle — snapshot read only (ADR-004). Serves pre-generated JSON for sealed days.
 * @last-fix: [2026-06-05] Check pre-generated bundle cache first (instant page loads)
 *   Prior: [2026-05-25] Replaced live Bork/Eitje aggregation with fetchDailyOpsDashboardBundle.
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ composables/useDailyOpsDashboardMetrics.ts
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import {
  fetchDailyOpsDashboardBundle,
  snapshotCacheControl,
} from '../../../utils/dailyOpsSnapshot/fetchDashboardBundle'
import {
  getIsoWeek,
  getMonthKey,
  getYearKey,
  getWeekStart,
  getWeekEnd,
} from '../../../utils/dailyOpsSnapshot/aggregateDailyBundles'
import { cachePath } from '../../../utils/dailyOpsSnapshot/cacheCascade'

const CACHE_DIR = resolve(process.cwd(), '.cache/daily-ops-bundles')

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  // Smart cascading cache lookup (daily/weekly/monthly/yearly)
  const today = new Date().toISOString().slice(0, 10)
  const locationId = ctx.locationId ?? 'all'
  const { startDate, endDate } = ctx
  
  let cacheFile: string | null = null
  let cacheLevel: string | null = null

  // Single sealed day → daily cache
  if (startDate === endDate && endDate < today) {
    cacheFile = cachePath('daily', startDate, locationId)
    cacheLevel = 'daily'
  }
  // Multi-day historical range → try weekly/monthly/yearly
  else if (startDate !== endDate && startDate < today && endDate < today) {
    const weekStart = getWeekStart(startDate)
    const weekEnd = getWeekEnd(startDate)
    const monthKey = getMonthKey(startDate)
    const yearKey = getYearKey(startDate)

    // Exact ISO week
    if (startDate === weekStart && endDate === weekEnd) {
      const weekKey = getIsoWeek(startDate)
      cacheFile = cachePath('weekly', weekKey, locationId)
      cacheLevel = 'weekly'
    }
    // Exact month
    else if (startDate === `${monthKey}-01`) {
      const [y, m] = monthKey.split('-').map(Number)
      const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
      const monthEnd = `${monthKey}-${String(lastDay).padStart(2, '0')}`
      if (endDate === monthEnd) {
        cacheFile = cachePath('monthly', monthKey, locationId)
        cacheLevel = 'monthly'
      }
    }
    // Exact year
    else if (startDate === `${yearKey}-01-01` && endDate === `${yearKey}-12-31`) {
      cacheFile = cachePath('yearly', yearKey, locationId)
      cacheLevel = 'yearly'
    }
  }

  // Serve from cache if available
  if (cacheFile) {
    try {
      const json = await readFile(cacheFile, 'utf-8')
      const bundle = JSON.parse(json)
      console.info(`[bundle:cache] HIT [${cacheLevel}] ${startDate}..${endDate} ${locationId}`)
      return bundle
    }
    catch (error) {
      console.warn(
        `[bundle:cache] MISS [${cacheLevel}] ${startDate}..${endDate} ${locationId}:`,
        error instanceof Error ? error.message : String(error),
      )
      // Fall through to dynamic build
    }
  }

  // Dynamic build (today, multi-day, or cache miss)
  const db = await getDb()
  const bundle = await fetchDailyOpsDashboardBundle(db, ctx)
  return {
    summary: bundle.summary,
    revenue: bundle.revenue,
    labor: bundle.labor,
  }
})
