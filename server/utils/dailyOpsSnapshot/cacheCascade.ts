/**
 * @registry-id: dailyOpsCacheCascade
 * @created: 2026-06-05T18:48:00.000Z
 * @last-modified: 2026-07-01T00:00:00.000Z
 * @description: Cascading cache: daily → weekly → monthly → yearly bundle aggregation
 * @last-fix: [2026-07-01] Serve daily JSON for open register day (written after each snapshot rebuild)
 *   Prior: [2026-06-07] Date iteration via addCalendarDaysYmd on business_date (ADR-010)
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ scripts/pregenerate-dashboard-bundles.ts
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
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

const CACHE_ROOT = resolve(process.cwd(), '.cache/daily-ops-bundles')

export type CacheLevel = 'daily' | 'weekly' | 'monthly' | 'yearly'

export function cachePath(level: CacheLevel, key: string, locationId: string): string {
  return resolve(CACHE_ROOT, level, `${key}-${locationId}.json`)
}

async function readCachedBundle(path: string): Promise<DailyOpsDashboardBundleDto | null> {
  try {
    const json = await readFile(path, 'utf-8')
    return JSON.parse(json)
  }
  catch {
    return null
  }
}

async function writeCachedBundle(path: string, bundle: DailyOpsDashboardBundleDto): Promise<void> {
  await mkdir(resolve(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify(bundle, null, 0), 'utf-8')
}

async function loadDailyBundlesInRange(
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<DailyOpsDashboardBundleDto[]> {
  const dailyDir = resolve(CACHE_ROOT, 'daily')
  let files: string[]
  try {
    files = await readdir(dailyDir)
  }
  catch {
    return []
  }
  const suffix = `-${locationId}.json`
  const bundles: DailyOpsDashboardBundleDto[] = []
  for (const file of files) {
    if (!file.endsWith(suffix)) continue
    const ymd = file.slice(0, 10)
    if (ymd < startDate || ymd > endDate) continue
    const hit = await readCachedBundle(resolve(dailyDir, file))
    if (hit) bundles.push(hit)
  }
  bundles.sort((a, b) =>
    (a.summary?.range?.startDate ?? '').localeCompare(b.summary?.range?.startDate ?? ''),
  )
  return bundles
}

/** Try pre-generated cache (daily → weekly → monthly → yearly → composed). */
export async function loadCachedDashboardBundle(
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto | null> {
  const locationId = ctx.locationId ?? 'all'
  const { startDate, endDate } = ctx
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const yesterday = addCalendarDaysYmd(openRegister, -1)

  if (startDate === endDate) {
    return readCachedBundle(cachePath('daily', startDate, locationId))
  }

  const weekStart = getWeekStart(startDate)
  const weekEnd = getWeekEnd(startDate)
  if (startDate === weekStart && endDate === weekEnd) {
    const hit = await readCachedBundle(cachePath('weekly', getIsoWeek(startDate), locationId))
    if (hit) return hit
  }

  const monthKey = getMonthKey(startDate)
  const monthEnd = monthEndYmd(monthKey)
  if (startDate === `${monthKey}-01` && endDate === monthEnd) {
    const hit = await readCachedBundle(cachePath('monthly', monthKey, locationId))
    if (hit) return hit
  }

  const yearKey = getYearKey(startDate)
  if (startDate === `${yearKey}-01-01` && endDate === `${yearKey}-12-31` && endDate <= yesterday) {
    const hit = await readCachedBundle(cachePath('yearly', yearKey, locationId))
    if (hit) return hit
  }

  const monthParts: DailyOpsDashboardBundleDto[] = []
  for (const mk of enumerateMonthKeys(startDate, endDate)) {
    const mStart = `${mk}-01`
    const mEnd = monthEndYmd(mk)
    const sliceStart = maxYmd(mStart, startDate)
    const sliceEnd = minYmd(mEnd, endDate)

    if (sliceStart === mStart && sliceEnd === mEnd) {
      const monthly = await readCachedBundle(cachePath('monthly', mk, locationId))
      if (monthly) {
        monthParts.push(monthly)
        continue
      }
    }

    const sliceDays = enumerateUtcDatesInclusive(sliceStart, sliceEnd).length
    if (sliceDays > 31) continue

    const dailies = await loadDailyBundlesInRange(sliceStart, sliceEnd, locationId)
    if (dailies.length > 0) {
      monthParts.push(
        aggregateDailyBundles(dailies, {
          startDate: sliceStart,
          endDate: sliceEnd,
          label: mk,
        }),
      )
    }
  }

  if (monthParts.length === 0) return null
  if (monthParts.length === 1) {
    const only = monthParts[0]!
    only.summary.range = { period: ctx.period, startDate, endDate }
    only.revenue.range = { period: ctx.period, startDate, endDate }
    only.labor.range = { period: ctx.period, startDate, endDate }
    if (only.venueStrip) {
      only.venueStrip.range = { period: ctx.period, startDate, endDate }
    }
    return only
  }

  return aggregateDailyBundles(monthParts, {
    startDate,
    endDate,
    label: ctx.period,
  })
}

/** Venue strip from the same smart JSON cascade as dashboard bundle. */
export async function loadCachedVenueStrip(
  ctx: DailyOpsMetricsContext,
): Promise<VenueStripResponseDto | null> {
  const bundle = await loadCachedDashboardBundle(ctx)
  return bundle?.venueStrip ?? null
}

/** Generate weekly bundle from 7 daily bundles. */
export async function generateWeeklyBundle(
  weekKey: string,
  locationId: string,
  weekStart: string,
): Promise<{ written: boolean; path: string | null; error?: string }> {
  try {
    const dailyBundles: DailyOpsDashboardBundleDto[] = []
    
    for (let i = 0; i < 7; i++) {
      const ymd = addCalendarDaysYmd(weekStart, i)
      const dailyPath = cachePath('daily', ymd, locationId)
      const bundle = await readCachedBundle(dailyPath)
      if (!bundle) {
        return { written: false, path: null, error: `Missing daily bundle for ${ymd}` }
      }
      dailyBundles.push(bundle)
    }

    const weekEnd = getWeekEnd(weekStart)
    const aggregated = aggregateDailyBundles(dailyBundles, {
      startDate: weekStart,
      endDate: weekEnd,
      label: weekKey,
    })

    const weeklyPath = cachePath('weekly', weekKey, locationId)
    await writeCachedBundle(weeklyPath, aggregated)

    return { written: true, path: weeklyPath }
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
  monthKey: string,
  locationId: string,
): Promise<{ written: boolean; path: string | null; error?: string }> {
  try {
    const dailyDir = resolve(CACHE_ROOT, 'daily')
    const files = await readdir(dailyDir)
    const monthlyBundles: DailyOpsDashboardBundleDto[] = []

    for (const file of files) {
      if (!file.startsWith(monthKey) || !file.includes(`-${locationId}.json`)) continue
      const dailyPath = resolve(dailyDir, file)
      const bundle = await readCachedBundle(dailyPath)
      if (bundle) monthlyBundles.push(bundle)
    }

    if (monthlyBundles.length === 0) {
      return { written: false, path: null, error: `No daily bundles for ${monthKey}` }
    }

    const [y, m] = monthKey.split('-').map(Number)
    const startDate = `${monthKey}-01`
    const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
    const endDate = `${monthKey}-${String(lastDay).padStart(2, '0')}`

    const aggregated = aggregateDailyBundles(monthlyBundles, {
      startDate,
      endDate,
      label: monthKey,
    })

    const monthlyPath = cachePath('monthly', monthKey, locationId)
    await writeCachedBundle(monthlyPath, aggregated)

    return { written: true, path: monthlyPath }
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
  yearKey: string,
  locationId: string,
): Promise<{ written: boolean; path: string | null; error?: string }> {
  try {
    const monthlyDir = resolve(CACHE_ROOT, 'monthly')
    const files = await readdir(monthlyDir)
    const yearlyBundles: DailyOpsDashboardBundleDto[] = []

    for (let m = 1; m <= 12; m++) {
      const monthKey = `${yearKey}-${String(m).padStart(2, '0')}`
      const file = `${monthKey}-${locationId}.json`
      const monthlyPath = resolve(monthlyDir, file)
      const bundle = await readCachedBundle(monthlyPath)
      if (bundle) yearlyBundles.push(bundle)
    }

    if (yearlyBundles.length === 0) {
      return { written: false, path: null, error: `No monthly bundles for ${yearKey}` }
    }

    const aggregated = aggregateDailyBundles(yearlyBundles, {
      startDate: `${yearKey}-01-01`,
      endDate: `${yearKey}-12-31`,
      label: yearKey,
    })

    const yearlyPath = cachePath('yearly', yearKey, locationId)
    await writeCachedBundle(yearlyPath, aggregated)

    return { written: true, path: yearlyPath }
  }
  catch (error) {
    return {
      written: false,
      path: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Cascade: generate weekly/monthly/yearly from daily bundles. */
export async function cascadeGenerate(
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
      
      const result = await generateWeeklyBundle(week, locationId, weekStart)
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
      const result = await generateMonthlyBundle(month, locationId)
      if (result.written) monthlyCount++
    }
  }

  // Generate yearly bundles
  for (const year of years) {
    for (const locationId of locationIds) {
      const result = await generateYearlyBundle(year, locationId)
      if (result.written) yearlyCount++
    }
  }

  console.info(
    `[cache:cascade] Generated weekly=${weeklyCount}, monthly=${monthlyCount}, yearly=${yearlyCount}`,
  )

  return { weekly: weeklyCount, monthly: monthlyCount, yearly: yearlyCount }
}
