/**
 * Validate daily_ops_period_cache vs legacy snapshots (ADR-023 Phase 1 gate).
 *
 * Checks:
 * 1. Day-node revenue/food/bev vs snapshot revenue + products sections
 * 2. Composition: sum(days) ≈ week / month / year nodes
 * 3. Regex-fallback product counts (should be ~0)
 *
 * Usage:
 *   npx --yes tsx scripts/validate-period-cache.ts --from 2026-07-01 --to 2026-08-07
 *   pnpm period-cache:validate -- --from 2026-07-01 --to 2026-08-07
 */

import { MongoClient } from 'mongodb'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '../utils/dailyOpsBusinessDate'
import {
  getIsoWeek,
  getMonthKey,
  getYearKey,
  monthEndYmd,
} from '../server/utils/dailyOpsSnapshot/aggregateDailyBundles'
import {
  scaleFoodBeverageToHeadline,
  splitFromInboxCategories,
} from '../server/utils/dailyOpsPeriodCache/classifyFoodBeverage'
import { findPeriodNode } from '../server/utils/dailyOpsPeriodCache/store'
import { VENUE_STRIP_LOCATIONS } from '../server/utils/venueStrip/constants'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotRevenueProductsSection,
  type DailyOpsSnapshotRevenueSection,
} from '../types/daily-ops-snapshot'

const TOLERANCE = 1.0 // €1

async function loadEnv () {
  try {
    const { config } = await import('dotenv')
    config()
  } catch {
    // optional
  }
}

function arg (name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`)
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : defaultValue
}

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function near (a: number, b: number, tol = TOLERANCE): boolean {
  return Math.abs(a - b) <= tol
}

async function main () {
  await loadEnv()
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }

  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const defaultEnd = addCalendarDaysYmd(openRegister, -1)
  const endDate = arg('to', defaultEnd)!
  const startDate = arg('from', '2026-07-01')!

  console.log(`[period-cache:validate] ${startDate}..${endDate}`)

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db()

  let dayMismatches = 0
  let daysChecked = 0
  let daysMissing = 0
  let regexFallbackTotal = 0
  const mismatchSamples: string[] = []

  const locationIds = [
    ...VENUE_STRIP_LOCATIONS.map((v) => v.locationId),
    'all',
  ]

  let cursor = startDate
  while (cursor <= endDate) {
    for (const locationId of locationIds) {
      if (locationId === 'all') continue

      const node = await findPeriodNode(db, {
        locationId,
        level: 'day',
        periodKey: cursor,
      })
      if (!node) {
        daysMissing++
        continue
      }
      daysChecked++
      regexFallbackTotal += node.provenance.regexFallbackProductIds?.length ?? 0

      const [rev, products] = await Promise.all([
        db
          .collection<DailyOpsSnapshotRevenueSection>(
            DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection,
          )
          .findOne({ businessDate: cursor, locationId }),
        db
          .collection<DailyOpsSnapshotRevenueProductsSection>(
            DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection,
          )
          .findOne({ businessDate: cursor, locationId }),
      ])

      if (!rev) {
        mismatchSamples.push(`${cursor} ${locationId}: node exists but no snapshot revenue`)
        dayMismatches++
        continue
      }

      const expectedEx = round2(Number(rev.totals?.ex_vat ?? 0))
      if (!near(node.revenue.exVat, expectedEx)) {
        dayMismatches++
        mismatchSamples.push(
          `${cursor} ${locationId}: exVat node=${node.revenue.exVat} snap=${expectedEx}`,
        )
      }

      if ((products?.categories ?? []).length > 0) {
        const split = splitFromInboxCategories(products!.categories)
        const scaled = scaleFoodBeverageToHeadline(expectedEx, split.food, split.beverage)
        if (!near(node.revenue.food, scaled.food) || !near(node.revenue.beverage, scaled.beverage)) {
          dayMismatches++
          mismatchSamples.push(
            `${cursor} ${locationId}: food/bev node=${node.revenue.food}/${node.revenue.beverage} expected=${scaled.food}/${scaled.beverage}`,
          )
        }
      }
    }

    // Combined day
    const allNode = await findPeriodNode(db, {
      locationId: 'all',
      level: 'day',
      periodKey: cursor,
    })
    if (!allNode) {
      daysMissing++
    } else {
      daysChecked++
      let sumEx = 0
      let sumFood = 0
      let sumBev = 0
      for (const v of VENUE_STRIP_LOCATIONS) {
        const n = await findPeriodNode(db, {
          locationId: v.locationId,
          level: 'day',
          periodKey: cursor,
        })
        if (n) {
          sumEx += n.revenue.exVat
          sumFood += n.revenue.food
          sumBev += n.revenue.beverage
        }
      }
      if (
        !near(allNode.revenue.exVat, sumEx)
        || !near(allNode.revenue.food, sumFood)
        || !near(allNode.revenue.beverage, sumBev)
      ) {
        dayMismatches++
        mismatchSamples.push(
          `${cursor} all: combined≠sum venues ex=${allNode.revenue.exVat} vs ${round2(sumEx)}`,
        )
      }
    }

    cursor = addCalendarDaysYmd(cursor, 1)
  }

  // Composition: months
  let compositionMismatches = 0
  const months = new Set<string>()
  cursor = startDate
  while (cursor <= endDate) {
    months.add(getMonthKey(cursor))
    cursor = addCalendarDaysYmd(cursor, 1)
  }

  for (const monthKey of months) {
    for (const locationId of locationIds) {
      const monthNode = await findPeriodNode(db, {
        locationId,
        level: 'month',
        periodKey: monthKey,
      })
      if (!monthNode) continue

      const mStart = `${monthKey}-01`
      const mEnd = monthEndYmd(monthKey)
      const sliceStart = mStart < startDate ? startDate : mStart
      const sliceEnd = mEnd > endDate ? endDate : mEnd

      // Only validate full months fully inside range
      if (mStart < startDate || mEnd > endDate) continue

      let sumEx = 0
      let c = mStart
      while (c <= mEnd) {
        const d = await findPeriodNode(db, {
          locationId,
          level: 'day',
          periodKey: c,
        })
        if (d) sumEx += d.revenue.exVat
        c = addCalendarDaysYmd(c, 1)
      }
      if (!near(monthNode.revenue.exVat, sumEx)) {
        compositionMismatches++
        mismatchSamples.push(
          `month ${monthKey} ${locationId}: month=${monthNode.revenue.exVat} daySum=${round2(sumEx)}`,
        )
      }
      void sliceStart
      void sliceEnd
    }
  }

  // Composition: complete weeks inside range
  const weeks = new Set<string>()
  cursor = startDate
  while (cursor <= endDate) {
    weeks.add(getIsoWeek(cursor))
    cursor = addCalendarDaysYmd(cursor, 1)
  }

  for (const weekKey of weeks) {
    for (const locationId of locationIds) {
      const weekNode = await findPeriodNode(db, {
        locationId,
        level: 'week',
        periodKey: weekKey,
      })
      if (!weekNode) continue

      const weekStart = weekNode.businessDateStart
      const weekEnd = weekNode.businessDateEnd
      if (weekStart < startDate || weekEnd > endDate) continue

      let sumEx = 0
      let c = weekStart
      while (c <= weekEnd) {
        const d = await findPeriodNode(db, {
          locationId,
          level: 'day',
          periodKey: c,
        })
        if (d) sumEx += d.revenue.exVat
        c = addCalendarDaysYmd(c, 1)
      }
      if (!near(weekNode.revenue.exVat, sumEx)) {
        compositionMismatches++
        mismatchSamples.push(
          `week ${weekKey} ${locationId}: week=${weekNode.revenue.exVat} daySum=${round2(sumEx)}`,
        )
      }
    }
  }

  // Year composition when full year in range
  const years = new Set<string>()
  cursor = startDate
  while (cursor <= endDate) {
    years.add(getYearKey(cursor))
    cursor = addCalendarDaysYmd(cursor, 1)
  }
  for (const yearKey of years) {
    const yStart = `${yearKey}-01-01`
    const yEnd = `${yearKey}-12-31`
    if (yStart < startDate || yEnd > endDate) continue
    for (const locationId of locationIds) {
      const yearNode = await findPeriodNode(db, {
        locationId,
        level: 'year',
        periodKey: yearKey,
      })
      if (!yearNode) continue
      let sumEx = 0
      for (let m = 1; m <= 12; m++) {
        const mk = `${yearKey}-${String(m).padStart(2, '0')}`
        const mn = await findPeriodNode(db, {
          locationId,
          level: 'month',
          periodKey: mk,
        })
        if (mn) sumEx += mn.revenue.exVat
      }
      if (!near(yearNode.revenue.exVat, sumEx)) {
        compositionMismatches++
        mismatchSamples.push(
          `year ${yearKey} ${locationId}: year=${yearNode.revenue.exVat} monthSum=${round2(sumEx)}`,
        )
      }
    }
  }

  console.log('--- Validation report ---')
  console.log(`daysChecked=${daysChecked} daysMissing=${daysMissing}`)
  console.log(`dayMismatches=${dayMismatches}`)
  console.log(`compositionMismatches=${compositionMismatches}`)
  console.log(`regexFallbackProductHits=${regexFallbackTotal}`)
  if (mismatchSamples.length) {
    console.log('Samples:')
    for (const s of mismatchSamples.slice(0, 40)) console.log(`  ${s}`)
  }

  const failed = dayMismatches > 0 || compositionMismatches > 0
  console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS')
  if (regexFallbackTotal > 0) {
    console.log(
      `NOTE: ${regexFallbackTotal} regex-fallback product hit(s) — fix product_catalog mappings`,
    )
  }

  await client.close()
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
