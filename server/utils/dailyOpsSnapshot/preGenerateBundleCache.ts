/**
 * @registry-id: dailyOpsPreGenerateBundleCache
 * @created: 2026-06-05T17:50:00.000Z
 * @last-modified: 2026-06-07T00:00:00.000Z
 * @description: Pre-generate static JSON cache for sealed dashboard bundles (instant page loads)
 * @last-fix: [2026-06-07] Open register day check via amsterdamOpenRegisterBusinessDateYmd (ADR-010)
 *   Prior: [2026-06-05] Initial pre-generation after snapshot builds complete
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { fetchDailyOpsDashboardBundle } from './fetchDashboardBundle'

const CACHE_DIR = resolve(process.cwd(), '.cache/daily-ops-bundles/daily')

function cacheFileName(businessDate: string, locationId: string): string {
  return `${businessDate}-${locationId}.json`
}

/** Generate static bundle JSON for a sealed day after snapshot build completes. */
export async function preGenerateBundleForDate(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<{ written: boolean; path: string | null; error?: string }> {
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  if (businessDate >= openRegister) {
    return { written: false, path: null, error: 'Skip today (not sealed)' }
  }

  try {
    const ctx: DailyOpsMetricsContext = {
      period: 'd1',
      startDate: businessDate,
      endDate: businessDate,
      locationId: locationId === 'all' ? undefined : locationId,
    }

    const bundle = await fetchDailyOpsDashboardBundle(db, ctx)
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
      else if (!result.error?.includes('not sealed')) {
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
