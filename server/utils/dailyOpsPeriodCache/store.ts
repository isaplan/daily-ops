/**
 * @registry-id: dailyOpsPeriodCacheStore
 * @created: 2026-08-08T21:20:00.000Z
 * @last-modified: 2026-08-08T21:20:00.000Z
 * @description: Mongo SSOT helpers for daily_ops_period_cache
 * @last-fix: [2026-08-09] @adr-ref → PERIOD_CACHE_ADR L2
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @write-cache-json: daily_ops_period_cache
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsPeriodCache/buildDayNode.ts
 * ✓ server/utils/dailyOpsPeriodCache/cascadePeriod.ts
 * ✓ server/utils/dailyOpsPeriodCache/resolvePeriodRange.ts
 * ✓ scripts/backfill-period-cache.ts
 * ✓ scripts/validate-period-cache.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsPeriodLevel,
  DailyOpsPeriodNode,
} from '~/types/daily-ops-period-cache'

export const DAILY_OPS_PERIOD_CACHE_COLLECTION = 'daily_ops_period_cache'

export type PeriodNodeKey = {
  locationId: string
  level: DailyOpsPeriodLevel
  periodKey: string
}

let indexEnsured = false

export async function ensurePeriodCacheIndex (db: Db): Promise<void> {
  if (indexEnsured) return
  await db.collection(DAILY_OPS_PERIOD_CACHE_COLLECTION).createIndex(
    { locationId: 1, level: 1, periodKey: 1 },
    { unique: true, name: 'location_level_periodKey' },
  )
  indexEnsured = true
}

export async function upsertPeriodNode (
  db: Db,
  node: DailyOpsPeriodNode,
): Promise<void> {
  await ensurePeriodCacheIndex(db)
  const {
    locationId,
    level,
    periodKey,
    provenance,
    ...rest
  } = node
  await db.collection(DAILY_OPS_PERIOD_CACHE_COLLECTION).updateOne(
    { locationId, level, periodKey },
    {
      $set: {
        ...rest,
        locationId,
        level,
        periodKey,
        provenance: {
          ...provenance,
          lastBuiltAt: new Date().toISOString(),
        },
      },
    },
    { upsert: true },
  )
}

export async function findPeriodNode (
  db: Db,
  key: PeriodNodeKey,
): Promise<DailyOpsPeriodNode | null> {
  const row = await db
    .collection<DailyOpsPeriodNode>(DAILY_OPS_PERIOD_CACHE_COLLECTION)
    .findOne({
      locationId: key.locationId,
      level: key.level,
      periodKey: key.periodKey,
    })
  return row ?? null
}

export async function findPeriodNodesInRange (
  db: Db,
  opts: {
    locationId: string
    level: DailyOpsPeriodLevel
    startDate: string
    endDate: string
  },
): Promise<DailyOpsPeriodNode[]> {
  return db
    .collection<DailyOpsPeriodNode>(DAILY_OPS_PERIOD_CACHE_COLLECTION)
    .find({
      locationId: opts.locationId,
      level: opts.level,
      businessDateStart: { $lte: opts.endDate },
      businessDateEnd: { $gte: opts.startDate },
    })
    .sort({ businessDateStart: 1 })
    .toArray()
}

export async function countPeriodNodes (
  db: Db,
  opts: { locationId?: string; level?: DailyOpsPeriodLevel } = {},
): Promise<number> {
  const filter: Record<string, string> = {}
  if (opts.locationId) filter.locationId = opts.locationId
  if (opts.level) filter.level = opts.level
  return db.collection(DAILY_OPS_PERIOD_CACHE_COLLECTION).countDocuments(filter)
}
