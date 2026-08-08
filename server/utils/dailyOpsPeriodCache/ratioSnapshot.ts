/**
 * @registry-id: dailyOpsPeriodCacheRatioSnapshot
 * @created: 2026-08-08T21:20:00.000Z
 * @last-modified: 2026-08-08T21:20:00.000Z
 * @description: Ratio snapshots for period-cache — written on Finance seal / rolling refresh
 * @last-fix: [2026-08-08] Persist RatioSnapshot from break_even_assumptions
 * @adr-ref: ADR-019, ADR-022, ADR-023
 * @data-source: app_settings + daily_ops_ratio_snapshots
 * @write-cache-json: daily_ops_ratio_snapshots
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsPeriodCache/buildDayNode.ts
 * ✓ server/utils/accountingPnl/refreshFinanceAssumptions.ts
 * ✓ scripts/backfill-period-cache.ts
 */

import type { Db } from 'mongodb'
import type { RatioSnapshot } from '~/types/daily-ops-period-cache'
import type { BreakEvenVenueKey, BreakEvenVenueSlice } from '~/types/break-even'
import { ACCOUNTING_PNL_LOCATION_ID_TO_VENUE } from '~/utils/accountingPnlData'
import { DEFAULT_PNL_ASSUMPTIONS } from '~/utils/dailyOpsPnlAssumptionsDefaults'
import { loadBreakEvenAssumptions } from '../appSettings/breakEvenAssumptionsSetting'
import { loadPnlAssumptions } from '../appSettings/pnlAssumptionsSetting'

export const DAILY_OPS_RATIO_SNAPSHOTS_COLLECTION = 'daily_ops_ratio_snapshots'

let indexEnsured = false

async function ensureRatioIndex (db: Db): Promise<void> {
  if (indexEnsured) return
  await db.collection(DAILY_OPS_RATIO_SNAPSHOTS_COLLECTION).createIndex(
    { monthKey: 1, locationId: 1 },
    { unique: true, name: 'monthKey_locationId' },
  )
  indexEnsured = true
}

function venueKeyForLocation (locationId: string): BreakEvenVenueKey {
  if (locationId === 'all') return 'combined'
  return ACCOUNTING_PNL_LOCATION_ID_TO_VENUE[locationId] ?? 'combined'
}

function sliceToSnapshot (
  monthKey: string,
  locationId: string,
  slice: BreakEvenVenueSlice,
  foodCogsPct: number,
  bevCogsPct: number,
  overheadPct: number,
): RatioSnapshot {
  return {
    schemaVersion: 1,
    monthKey,
    locationId,
    source: slice.source === 'actual_month' ? 'finance_sealed' : 'rolling_12m',
    cogsPct: slice.cogsPct,
    foodCogsPct,
    bevCogsPct,
    fixedLaborPct: slice.fixedLaborPct,
    flexLaborPct: slice.flexLaborPct,
    overheadPct,
    breakEvenMonthly: slice.monthlyBreakEven,
    computedAt: new Date().toISOString(),
  }
}

export async function upsertRatioSnapshot (
  db: Db,
  snap: RatioSnapshot,
): Promise<void> {
  await ensureRatioIndex(db)
  await db.collection(DAILY_OPS_RATIO_SNAPSHOTS_COLLECTION).updateOne(
    { monthKey: snap.monthKey, locationId: snap.locationId },
    { $set: snap },
    { upsert: true },
  )
}

export async function findRatioSnapshot (
  db: Db,
  monthKey: string,
  locationId: string,
): Promise<RatioSnapshot | null> {
  return db
    .collection<RatioSnapshot>(DAILY_OPS_RATIO_SNAPSHOTS_COLLECTION)
    .findOne({ monthKey, locationId })
}

/**
 * Resolve ratios for a business day: prefer sealed month snapshot, else rolling.
 */
export async function loadRatioSnapshotForDay (
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<RatioSnapshot | null> {
  const monthKey = businessDate.slice(0, 7)
  const sealed = await findRatioSnapshot(db, monthKey, locationId)
  if (sealed) return sealed

  const rolling = await findRatioSnapshot(db, 'rolling', locationId)
  if (rolling) return rolling

  // Fall back to live app_settings (no write) so backfill works before first refresh.
  const [be, pnl] = await Promise.all([
    loadBreakEvenAssumptions(db),
    loadPnlAssumptions(db),
  ])
  const venue = venueKeyForLocation(locationId)
  const actual = be.actualByMonth[monthKey]?.[venue]
  if (actual && actual.monthlyBreakEven > 0) {
    return sliceToSnapshot(
      monthKey,
      locationId,
      actual,
      pnl.foodCogsPct,
      pnl.bevCogsPct,
      pnl.overheadPct,
    )
  }
  const roll = be.rolling[venue]
  if (roll && roll.monthlyBreakEven > 0) {
    return sliceToSnapshot(
      'rolling',
      locationId,
      roll,
      pnl.foodCogsPct,
      pnl.bevCogsPct,
      pnl.overheadPct,
    )
  }
  return {
    schemaVersion: 1,
    monthKey: 'default',
    locationId,
    source: 'rolling_12m',
    cogsPct: 0,
    foodCogsPct: DEFAULT_PNL_ASSUMPTIONS.foodCogsPct,
    bevCogsPct: DEFAULT_PNL_ASSUMPTIONS.bevCogsPct,
    fixedLaborPct: 0,
    flexLaborPct: 0,
    overheadPct: DEFAULT_PNL_ASSUMPTIONS.overheadPct,
    breakEvenMonthly: 0,
    computedAt: new Date().toISOString(),
  }
}

const LOCATION_IDS = [
  '69d6cfa63d2adf93b79d1ae7',
  '69d6cfa63d2adf93b79d1ae6',
  '69d6cfa73d2adf93b79d1ae8',
  'all',
] as const

/**
 * Persist rolling + actual-by-month ratio snapshots from current break-even assumptions.
 * Called from refreshFinanceAssumptions after Finance seal.
 */
export async function refreshRatioSnapshotsFromAssumptions (
  db: Db,
): Promise<{ written: number }> {
  const [be, pnl] = await Promise.all([
    loadBreakEvenAssumptions(db),
    loadPnlAssumptions(db),
  ])
  let written = 0

  for (const locationId of LOCATION_IDS) {
    const venue = venueKeyForLocation(locationId)
    const roll = be.rolling[venue]
    if (roll) {
      await upsertRatioSnapshot(
        db,
        sliceToSnapshot(
          'rolling',
          locationId,
          roll,
          pnl.foodCogsPct,
          pnl.bevCogsPct,
          pnl.overheadPct,
        ),
      )
      written++
    }

    for (const [monthKey, venueMap] of Object.entries(be.actualByMonth)) {
      const slice = venueMap[venue]
      if (!slice || !(slice.monthlyBreakEven > 0)) continue
      await upsertRatioSnapshot(
        db,
        sliceToSnapshot(
          monthKey,
          locationId,
          slice,
          pnl.foodCogsPct,
          pnl.bevCogsPct,
          pnl.overheadPct,
        ),
      )
      written++
    }
  }

  return { written }
}
