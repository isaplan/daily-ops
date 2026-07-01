/**
 * @registry-id: dailyOpsPreGenerateBundleCache
 * @created: 2026-06-05T17:50:00.000Z
 * @last-modified: 2026-07-01T00:00:00.000Z
 * @description: Pre-generate static JSON cache for dashboard bundles (all days — instant page loads)
 * @last-fix: [2026-07-01] refreshDashboardBundleCache — daily + weekly/monthly/yearly cascade after snapshot
 *   Prior: [2026-07-01] Write daily JSON for open register day after each snapshot rebuild
 *   Prior: [2026-06-07] Open register day check via amsterdamOpenRegisterBusinessDateYmd (ADR-010)
 *   Prior: [2026-06-05] Initial pre-generation after snapshot builds complete
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 * ✓ server/plugins/bundle-cache-catchup.ts
 */

import type { Db } from 'mongodb'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { cascadeGenerate } from './cacheCascade'
import { fetchDailyOpsDashboardBundle } from './fetchDashboardBundle'
import { buildVenueStripResponse } from '../dailyOpsVenueStrip'

const CACHE_DIR = resolve(process.cwd(), '.cache/daily-ops-bundles/daily')

function cacheFileName(businessDate: string, locationId: string): string {
  return `${businessDate}-${locationId}.json`
}

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
    const json = JSON.stringify(bundle, null, 0)

    await mkdir(CACHE_DIR, { recursive: true })
    const fileName = cacheFileName(businessDate, locationId)
    const filePath = resolve(CACHE_DIR, fileName)

    await writeFile(filePath, json, 'utf-8')
    return { written: true, path: filePath }
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
  const cascade = await cascadeGenerate(startDate, endDate, locationIds)
  console.info(
    `[bundle:cache] refresh ${startDate}..${endDate} daily=${daily.generated} weekly=${cascade.weekly} monthly=${cascade.monthly} yearly=${cascade.yearly}`,
  )
  return { daily, cascade }
}
