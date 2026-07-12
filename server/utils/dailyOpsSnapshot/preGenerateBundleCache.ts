/**
 * @registry-id: dailyOpsPreGenerateBundleCache
 * @created: 2026-06-05T17:50:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Pre-generate dashboard bundle JSON after snapshot writes (Mongo SSOT + local mirror)
 * @last-fix: [2026-07-02] Write daily_ops_read_cache on pregen (ADR-013)
 *   Prior: [2026-07-01] refreshDashboardBundleCache — daily + weekly/monthly/yearly cascade after snapshot
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: snapshot-write-only
 * @write-cache-json: daily_ops_read_cache · dashboard-bundle · daily+weekly+monthly+yearly · after buildDailyOpsSnapshot
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 * ✓ server/plugins/bundle-cache-catchup.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { cascadeGenerate, persistDashboardBundleCache } from './cacheCascade'
import { fetchDailyOpsDashboardBundle } from './fetchDashboardBundle'
import { buildVenueStripResponse } from '../dailyOpsVenueStrip'

/** Generate static bundle JSON after snapshot build completes (all days including today). */
export async function preGenerateBundleForDate(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<{ written: boolean; path: string | null; error?: string }> {
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const isToday = businessDate === openRegister

  try {
    const ctx: DailyOpsMetricsContext = {
      period: isToday ? 'today' : 'd1',
      startDate: businessDate,
      endDate: businessDate,
      locationId: locationId === 'all' ? undefined : locationId,
    }

    const bundle = await fetchDailyOpsDashboardBundle(db, ctx)
    if (locationId === 'all') {
      bundle.venueStrip = await buildVenueStripResponse(db, ctx)
    }

    await persistDashboardBundleCache(db, 'daily', businessDate, locationId, bundle, {
      startDate: businessDate,
      endDate: businessDate,
    })

    return { written: true, path: `${businessDate}-${locationId}` }
  }
  catch (error) {
    return {
      written: false,
      path: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Batch pre-generate bundles for a date range (called after backfills). */
export async function preGenerateBundlesForRange(
  db: Db,
  startDate: string,
  endDate: string,
  locationIds: string[],
): Promise<{ generated: number; errors: number }> {
  let generated = 0
  let errors = 0

  const dates: string[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    dates.push(cursor)
    cursor = addCalendarDaysYmd(cursor, 1)
  }

  for (const date of dates) {
    for (const locationId of locationIds) {
      const result = await preGenerateBundleForDate(db, date, locationId)
      if (result.written) {
        generated++
      }
      else if (result.error) {
        errors++
        console.warn(`[bundle:cache] Failed ${date} ${locationId}: ${result.error}`)
      }
    }
  }

  if (generated > 0) {
    console.info(`[bundle:cache] Pre-generated ${generated} bundle(s), errors=${errors}`)
  }

  return { generated, errors }
}

/** Daily JSON + weekly/monthly/yearly cascade — run after every snapshot materialization on production. */
export async function refreshDashboardBundleCache(
  db: Db,
  startDate: string,
  endDate: string,
  locationIds: string[],
): Promise<{
  daily: { generated: number; errors: number }
  cascade: { weekly: number; monthly: number; yearly: number }
}> {
  const daily = await preGenerateBundlesForRange(db, startDate, endDate, locationIds)
  const cascade = await cascadeGenerate(db, startDate, endDate, locationIds)
  console.info(
    `[bundle:cache] refresh ${startDate}..${endDate} daily=${daily.generated} weekly=${cascade.weekly} monthly=${cascade.monthly} yearly=${cascade.yearly}`,
  )
  return { daily, cascade }
}
