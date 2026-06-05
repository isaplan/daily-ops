/**
 * @registry-id: dailyOpsCacheCascade
 * @created: 2026-06-05T18:48:00.000Z
 * @last-modified: 2026-06-05T18:48:00.000Z
 * @description: Cascading cache: daily → weekly → monthly → yearly bundle aggregation
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ scripts/pregenerate-dashboard-bundles.ts
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  aggregateDailyBundles,
  getIsoWeek,
  getMonthKey,
  getYearKey,
  getWeekStart,
  getWeekEnd,
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

/** Generate weekly bundle from 7 daily bundles. */
export async function generateWeeklyBundle(
  weekKey: string,
  locationId: string,
  weekStart: string,
): Promise<{ written: boolean; path: string | null; error?: string }> {
  try {
    const dailyBundles: DailyOpsDashboardBundleDto[] = []
    
    for (let i = 0; i < 7; i++) {
      const [y, m, d] = weekStart.split('-').map(Number)
      const date = new Date(Date.UTC(y!, m! - 1, d! + i))
      const ymd = date.toISOString().slice(0, 10)
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

    const [y, m, d] = cursor.split('-').map(Number)
    const next = new Date(Date.UTC(y!, m! - 1, d! + 1))
    cursor = next.toISOString().slice(0, 10)
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
        const [y, m, d] = cursor.split('-').map(Number)
        const next = new Date(Date.UTC(y!, m! - 1, d! + 1))
        cursor = next.toISOString().slice(0, 10)
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
