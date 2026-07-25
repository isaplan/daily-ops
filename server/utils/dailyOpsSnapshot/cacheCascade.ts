/**
 * @registry-id: dailyOpsCacheCascade
 * @created: 2026-06-05T18:48:00.000Z
 * @last-modified: 2026-07-22T15:30:00.000Z
 * @description: Cascading cache: daily → weekly → monthly → yearly bundle aggregation
 * @last-fix: [2026-07-22] Skip week/month hits with wiped byVenue staff; recompose from dailies
 *   Prior: [2026-07-16] Seal averageHistory + PBI into week/month/year JSON at write; persist composed misses
 *   Prior: [2026-07-16] Skip month/week/year hits missing profitByInterval; recompose from dailies
 *   Prior: [2026-07-14] Cascade rollups pass P&L assumptions for ADR-014 profit SSOT
 * @adr-ref: ADR-004, ADR-010, ADR-013, ADR-014
 * @data-source: read-cache
 * @write-cache-json: daily_ops_read_cache · dashboard-bundle · daily→weekly→monthly→yearly after buildDailyOpsSnapshot
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle · levels=daily|weekly|monthly|yearly
 *
 * @exports-to:
 * ✓ scripts/pregenerate-dashboard-bundles.ts
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 * ✓ server/api/daily-ops/metrics/venue-strip.get.ts
 */

import type { Db } from 'mongodb'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import {
  findReadCachePayload,
  upsertReadCachePayload,
} from '../dailyOpsReadCache/readCacheStore'
import {
  aggregateDailyBundles,
  enumerateMonthKeys,
  getIsoWeek,
  getMonthKey,
  getYearKey,
  getWeekStart,
  getWeekEnd,
  monthEndYmd,
  maxYmd,
  minYmd,
} from './aggregateDailyBundles'
import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'
import { bundleHasCoverageGaps } from './bundleCoverage'
import { bundlePeriodBreakdownStaffMissing, bundleProfitByIntervalIncomplete } from './bundleInvariant'
import { loadPnlAssumptions } from '../appSettings/pnlAssumptionsSetting'

const DASHBOARD_PROFILE = 'dashboard-bundle'
const CACHE_ROOT = resolve(process.cwd(), '.cache/daily-ops-bundles')

/** Skip sealed rollup when PBI missing or byVenue staff/hours wiped by drilldown overwrite. */
function bundleRollupCacheStale(hit: DailyOpsDashboardBundleDto): boolean {
  return bundleProfitByIntervalIncomplete(hit) || bundlePeriodBreakdownStaffMissing(hit)
}

export type CacheLevel = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Dynamic import avoids cycle with buildPeriodBreakdownAverageHistory → cacheCascade. */
async function sealRollupBundle (
  db: Db,
  bundle: DailyOpsDashboardBundleDto,
  locationId: string,
): Promise<DailyOpsDashboardBundleDto> {
  const { sealDashboardBundleAverageHistory } = await import('./buildPeriodBreakdownAverageHistory')
  return sealDashboardBundleAverageHistory(db, bundle, locationId)
}

export function cachePath(level: CacheLevel, key: string, locationId: string): string {
  return resolve(CACHE_ROOT, level, `${key}-${locationId}.json`)
}

/** Partial calendar year through open register, e.g. 2026-ytd-2026-07-01 */
export function partialYearCacheKey(yearKey: string, endDate: string): string {
  return `${yearKey}-ytd-${endDate}`
}

export function isPartialYearRange(startDate: string, endDate: string): boolean {
  const yearKey = getYearKey(startDate)
  return startDate === `${yearKey}-01-01` && endDate !== `${yearKey}-12-31`
}

async function readCachedBundleRaw(
  db: Db,
  level: CacheLevel,
  key: string,
  locationId: string,
): Promise<DailyOpsDashboardBundleDto | null> {
  const mongoHit = await findReadCachePayload<DailyOpsDashboardBundleDto>(db, {
    profile: DASHBOARD_PROFILE,
    level,
    key,
    locationId,
  })
  if (mongoHit) return mongoHit

  try {
    const json = await readFile(cachePath(level, key, locationId), 'utf-8')
    return JSON.parse(json) as DailyOpsDashboardBundleDto
  }
  catch {
    return null
  }
}

/** Skip stitched rollups with missing daily docs — bundle.get falls back to snapshot read. */
export async function readCachedBundle(
  db: Db,
  level: CacheLevel,
  key: string,
  locationId: string,
): Promise<DailyOpsDashboardBundleDto | null> {
  const hit = await readCachedBundleRaw(db, level, key, locationId)
  if (hit && bundleHasCoverageGaps(hit)) {
    console.warn(
      `[bundle:cache] PARTIAL ${level}/${key} ${locationId} — ${hit.summary?.snapshotCoverage?.missingDates?.length ?? 0} missing day(s), skip`,
    )
    return null
  }
  return hit
}

async function writeCachedBundle(
  db: Db,
  level: CacheLevel,
  key: string,
  locationId: string,
  bundle: DailyOpsDashboardBundleDto,
  range?: { startDate: string; endDate: string },
): Promise<void> {
  await upsertReadCachePayload(db, {
    profile: DASHBOARD_PROFILE,
    level,
    key,
    locationId,
    businessDateStart: range?.startDate,
    businessDateEnd: range?.endDate,
    payload: bundle,
  })

  const path = cachePath(level, key, locationId)
  await mkdir(resolve(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify(bundle, null, 0), 'utf-8')
}

export async function loadDailyBundlesInRange(
  db: Db,
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<DailyOpsDashboardBundleDto[]> {
  const bundles: DailyOpsDashboardBundleDto[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    const hit = await readCachedBundle(db, 'daily', cursor, locationId)
    if (hit) bundles.push(hit)
    cursor = addCalendarDaysYmd(cursor, 1)
  }
  return bundles
}

export async function persistDashboardBundleCache(
  db: Db,
  level: CacheLevel,
  key: string,
  locationId: string,
  bundle: DailyOpsDashboardBundleDto,
  range?: { startDate: string; endDate: string },
): Promise<void> {
  await writeCachedBundle(db, level, key, locationId, bundle, range)
}

/** Try pre-generated cache (daily → weekly → monthly → yearly → composed). */
export async function loadCachedDashboardBundle(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto | null> {
  const locationId = ctx.locationId ?? 'all'
  const { startDate, endDate } = ctx
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const yesterday = addCalendarDaysYmd(openRegister, -1)

  if (startDate === endDate) {
    return readCachedBundle(db, 'daily', startDate, locationId)
  }

  const weekStart = getWeekStart(startDate)
  const weekEnd = getWeekEnd(startDate)
  if (startDate === weekStart && endDate === weekEnd) {
    const hit = await readCachedBundle(db, 'weekly', getIsoWeek(startDate), locationId)
    if (hit && !bundleRollupCacheStale(hit)) return hit
  }

  const monthKey = getMonthKey(startDate)
  const monthEnd = monthEndYmd(monthKey)
  if (startDate === `${monthKey}-01` && endDate === monthEnd) {
    const hit = await readCachedBundle(db, 'monthly', monthKey, locationId)
    if (hit && !bundleRollupCacheStale(hit)) return hit
  }
  if (startDate === `${monthKey}-01` && endDate < monthEnd) {
    const hit = await readCachedBundle(db, 'monthly', `${monthKey}-thru-${endDate}`, locationId)
    if (hit && !bundleRollupCacheStale(hit)) return hit
  }

  const yearKey = getYearKey(startDate)
  if (startDate === `${yearKey}-01-01` && endDate === `${yearKey}-12-31` && endDate <= yesterday) {
    const hit = await readCachedBundle(db, 'yearly', yearKey, locationId)
    if (hit && !bundleRollupCacheStale(hit)) return hit
  }

  if (isPartialYearRange(startDate, endDate)) {
    const ytdKey = partialYearCacheKey(yearKey, endDate)
    const hit = await readCachedBundle(db, 'yearly', ytdKey, locationId)
    if (hit && !bundleRollupCacheStale(hit)) return hit
  }

  const pnlAssumptions = await loadPnlAssumptions(db)
  const monthParts: DailyOpsDashboardBundleDto[] = []
  for (const mk of enumerateMonthKeys(startDate, endDate)) {
    const mStart = `${mk}-01`
    const mEnd = monthEndYmd(mk)
    const sliceStart = maxYmd(mStart, startDate)
    const sliceEnd = minYmd(mEnd, endDate)

    if (sliceStart === mStart && sliceEnd === mEnd) {
      const monthly = await readCachedBundle(db, 'monthly', mk, locationId)
      if (monthly && !bundleRollupCacheStale(monthly)) {
        monthParts.push(monthly)
        continue
      }
    }

    const sliceDays = enumerateUtcDatesInclusive(sliceStart, sliceEnd).length
    if (sliceDays > 31) continue

    const dailies = await loadDailyBundlesInRange(db, sliceStart, sliceEnd, locationId)
    if (dailies.length > 0) {
      monthParts.push(
        aggregateDailyBundles(dailies, {
          startDate: sliceStart,
          endDate: sliceEnd,
          label: mk,
          pnlAssumptions,
        }),
      )
    }
  }

  if (monthParts.length === 0) return null

  let composed: DailyOpsDashboardBundleDto
  if (monthParts.length === 1) {
    composed = monthParts[0]!
  }
  else {
    composed = aggregateDailyBundles(monthParts, {
      startDate,
      endDate,
      label: ctx.period,
      totalsOnly: true,
      pnlAssumptions,
    })
  }

  composed.summary.range = { period: ctx.period, startDate, endDate }
  composed.revenue.range = { period: ctx.period, startDate, endDate }
  composed.labor.range = { period: ctx.period, startDate, endDate }
  if (composed.venueStrip) {
    composed.venueStrip.range = { period: ctx.period, startDate, endDate }
  }

  // Persist compose (PBI included) so next GET is O(1). AverageHistory is sealed on
  // generateWeekly/Monthly/Yearly write path — never rebuild overlays on GET.
  if (startDate === weekStart && endDate === weekEnd) {
    await writeCachedBundle(db, 'weekly', getIsoWeek(startDate), locationId, composed, { startDate, endDate })
  }
  else if (startDate === `${monthKey}-01` && endDate === monthEnd) {
    await writeCachedBundle(db, 'monthly', monthKey, locationId, composed, { startDate, endDate })
  }
  else if (startDate === `${monthKey}-01` && endDate < monthEnd) {
    await writeCachedBundle(db, 'monthly', `${monthKey}-thru-${endDate}`, locationId, composed, { startDate, endDate })
  }
  else if (isPartialYearRange(startDate, endDate)) {
    await writeCachedBundle(
      db,
      'yearly',
      partialYearCacheKey(yearKey, endDate),
      locationId,
      composed,
      { startDate, endDate },
    )
  }
  else if (startDate === `${yearKey}-01-01` && endDate === `${yearKey}-12-31`) {
    await writeCachedBundle(db, 'yearly', yearKey, locationId, composed, { startDate, endDate })
  }

  return composed
}

/** Venue strip from the same smart JSON cascade as dashboard bundle. */
export async function loadCachedVenueStrip(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<VenueStripResponseDto | null> {
  const bundle = await loadCachedDashboardBundle(db, ctx)
  return bundle?.venueStrip ?? null
}

/** Generate weekly bundle from 7 daily bundles. */
export async function generateWeeklyBundle(
  db: Db,
  weekKey: string,
  locationId: string,
  weekStart: string,
): Promise<{ written: boolean; path: string | null; error?: string }> {
  try {
    const dailyBundles: DailyOpsDashboardBundleDto[] = []

    for (let i = 0; i < 7; i++) {
      const ymd = addCalendarDaysYmd(weekStart, i)
      const bundle = await readCachedBundle(db, 'daily', ymd, locationId)
      if (!bundle) {
        return { written: false, path: null, error: `Missing daily bundle for ${ymd}` }
      }
      dailyBundles.push(bundle)
    }

    const pnlAssumptions = await loadPnlAssumptions(db)
    const weekEnd = getWeekEnd(weekStart)
    const aggregated = await sealRollupBundle(
      db,
      aggregateDailyBundles(dailyBundles, {
        startDate: weekStart,
        endDate: weekEnd,
        label: weekKey,
        totalsOnly: true,
        pnlAssumptions,
      }),
      locationId,
    )

    await writeCachedBundle(db, 'weekly', weekKey, locationId, aggregated, {
      startDate: weekStart,
      endDate: weekEnd,
    })

    return { written: true, path: cachePath('weekly', weekKey, locationId) }
  }
  catch (error) {
    return {
      written: false,
      path: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Generate monthly bundle from all daily bundles in month. */
export async function generateMonthlyBundle(
  db: Db,
  monthKey: string,
  locationId: string,
): Promise<{ written: boolean; path: string | null; error?: string }> {
  try {
    const startDate = `${monthKey}-01`
    const endDate = monthEndYmd(monthKey)
    const monthlyBundles = await loadDailyBundlesInRange(db, startDate, endDate, locationId)

    if (monthlyBundles.length === 0) {
      return { written: false, path: null, error: `No daily bundles for ${monthKey}` }
    }

    const pnlAssumptions = await loadPnlAssumptions(db)
    const aggregated = await sealRollupBundle(
      db,
      aggregateDailyBundles(monthlyBundles, {
        startDate,
        endDate,
        label: monthKey,
        totalsOnly: true,
        pnlAssumptions,
      }),
      locationId,
    )

    await writeCachedBundle(db, 'monthly', monthKey, locationId, aggregated, { startDate, endDate })

    return { written: true, path: cachePath('monthly', monthKey, locationId) }
  }
  catch (error) {
    return {
      written: false,
      path: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Generate yearly bundle from 12 monthly bundles. */
export async function generateYearlyBundle(
  db: Db,
  yearKey: string,
  locationId: string,
): Promise<{ written: boolean; path: string | null; error?: string }> {
  try {
    const yearlyBundles: DailyOpsDashboardBundleDto[] = []

    for (let m = 1; m <= 12; m++) {
      const monthKey = `${yearKey}-${String(m).padStart(2, '0')}`
      const bundle = await readCachedBundle(db, 'monthly', monthKey, locationId)
      if (bundle) yearlyBundles.push(bundle)
    }

    if (yearlyBundles.length === 0) {
      return { written: false, path: null, error: `No monthly bundles for ${yearKey}` }
    }

    const startDate = `${yearKey}-01-01`
    const endDate = `${yearKey}-12-31`
    const pnlAssumptions = await loadPnlAssumptions(db)
    const aggregated = await sealRollupBundle(
      db,
      aggregateDailyBundles(yearlyBundles, {
        startDate,
        endDate,
        label: yearKey,
        totalsOnly: true,
        pnlAssumptions,
      }),
      locationId,
    )

    await writeCachedBundle(db, 'yearly', yearKey, locationId, aggregated, { startDate, endDate })

    return { written: true, path: cachePath('yearly', yearKey, locationId) }
  }
  catch (error) {
    return {
      written: false,
      path: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Prebuild partial-year (this-year) totals doc — one read on GET, no month stitch. */
export async function generatePartialYearlyBundle(
  db: Db,
  yearKey: string,
  endDate: string,
  locationId: string,
): Promise<{ written: boolean; error?: string }> {
  try {
    const startDate = `${yearKey}-01-01`
    const pnlAssumptions = await loadPnlAssumptions(db)
    const monthParts: DailyOpsDashboardBundleDto[] = []

    for (const mk of enumerateMonthKeys(startDate, endDate)) {
      const mStart = `${mk}-01`
      const mEnd = monthEndYmd(mk)
      const sliceEnd = minYmd(mEnd, endDate)

      if (sliceEnd === mEnd) {
        const monthly = await readCachedBundle(db, 'monthly', mk, locationId)
        if (monthly) {
          monthParts.push(monthly)
          continue
        }
      }

      const dailies = await loadDailyBundlesInRange(db, mStart, sliceEnd, locationId)
      if (dailies.length > 0) {
        monthParts.push(
          aggregateDailyBundles(dailies, {
            startDate: mStart,
            endDate: sliceEnd,
            label: mk,
            totalsOnly: true,
            pnlAssumptions,
          }),
        )
      }
    }

    if (monthParts.length === 0) {
      return { written: false, error: `No month/daily bundles for ${yearKey} YTD through ${endDate}` }
    }

    const raw = monthParts.length === 1
      ? monthParts[0]!
      : aggregateDailyBundles(monthParts, {
          startDate,
          endDate,
          label: partialYearCacheKey(yearKey, endDate),
          totalsOnly: true,
          pnlAssumptions,
        })

    raw.summary.range = { period: 'custom' as any, startDate, endDate }
    raw.revenue.range = { period: 'custom' as any, startDate, endDate }
    raw.labor.range = { period: 'custom' as any, startDate, endDate }

    const aggregated = await sealRollupBundle(db, raw, locationId)
    const ytdKey = partialYearCacheKey(yearKey, endDate)
    await writeCachedBundle(db, 'yearly', ytdKey, locationId, aggregated, { startDate, endDate })
    return { written: true }
  }
  catch (error) {
    return { written: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Cascade: generate weekly/monthly/yearly from daily bundles. */
export async function cascadeGenerate(
  db: Db,
  startDate: string,
  endDate: string,
  locationIds: string[],
): Promise<{ weekly: number; monthly: number; yearly: number }> {
  const weeks = new Set<string>()
  const months = new Set<string>()
  const years = new Set<string>()

  // Collect unique weeks/months/years in range
  let cursor = startDate
  while (cursor <= endDate) {
    weeks.add(getIsoWeek(cursor))
    months.add(getMonthKey(cursor))
    years.add(getYearKey(cursor))

    cursor = addCalendarDaysYmd(cursor, 1)
  }

  let weeklyCount = 0
  let monthlyCount = 0
  let yearlyCount = 0

  // Generate weekly bundles
  for (const week of weeks) {
    for (const locationId of locationIds) {
      // Find any date in this week from the range
      let weekStart = startDate
      let cursor = startDate
      while (cursor <= endDate) {
        if (getIsoWeek(cursor) === week) {
          weekStart = getWeekStart(cursor)
          break
        }
        cursor = addCalendarDaysYmd(cursor, 1)
      }
      
      const result = await generateWeeklyBundle(db, week, locationId, weekStart)
      if (result.written) {
        weeklyCount++
      }
      else if (result.error && !result.error.includes('Missing daily')) {
        console.warn(`[cache:cascade] Weekly ${week} ${locationId}: ${result.error}`)
      }
    }
  }

  // Generate monthly bundles
  for (const month of months) {
    for (const locationId of locationIds) {
      const result = await generateMonthlyBundle(db, month, locationId)
      if (result.written) monthlyCount++
    }
  }

  // Generate yearly bundles (full sealed years)
  for (const year of years) {
    for (const locationId of locationIds) {
      const result = await generateYearlyBundle(db, year, locationId)
      if (result.written) yearlyCount++
    }
  }

  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const openYear = getYearKey(openRegister)
  for (const locationId of locationIds) {
    const ytd = await generatePartialYearlyBundle(db, openYear, openRegister, locationId)
    if (ytd.written) yearlyCount++
  }

  console.info(
    `[cache:cascade] Generated weekly=${weeklyCount}, monthly=${monthlyCount}, yearly=${yearlyCount}`,
  )

  return { weekly: weeklyCount, monthly: monthlyCount, yearly: yearlyCount }
}
