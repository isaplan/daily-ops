/**
 * @registry-id: dailyOpsReadCacheStore
 * @created: 2026-07-02T00:00:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Mongo SSOT for Daily Ops prebuilt JSON (ADR-013)
 * @last-fix: [2026-07-02] upsert/find helpers for daily_ops_read_cache
 * @adr-ref: ADR-004, ADR-010, ADR-013, ADR-006
 * @data-source: read-cache
 * @write-cache-json: daily_ops_read_cache · upsert after buildDailyOpsSnapshot
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/cacheCascade.ts
 * ✓ server/utils/dailyOpsSnapshot/preGenerateBundleCache.ts
 */

import type { Db } from 'mongodb'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import type { DailyOpsReadCacheDoc, DailyOpsReadCacheKey } from './types'

export const DAILY_OPS_READ_CACHE_COLLECTION = 'daily_ops_read_cache'
export const DASHBOARD_BUNDLE_PROFILE = 'dashboard-bundle'

let indexEnsured = false

async function ensureReadCacheIndex(db: Db): Promise<void> {
  if (indexEnsured) return
  await db.collection(DAILY_OPS_READ_CACHE_COLLECTION).createIndex(
    { profile: 1, level: 1, key: 1, locationId: 1 },
    { unique: true, name: 'profile_level_key_location' },
  )
  indexEnsured = true
}

export async function upsertReadCachePayload<T>(
  db: Db,
  input: DailyOpsReadCacheKey & {
    payload: T
    businessDateStart?: string
    businessDateEnd?: string
  },
): Promise<void> {
  await ensureReadCacheIndex(db)
  const now = new Date()
  await db.collection(DAILY_OPS_READ_CACHE_COLLECTION).updateOne(
    {
      profile: input.profile,
      level: input.level,
      key: input.key,
      locationId: input.locationId,
    },
    {
      $set: {
        businessDateStart: input.businessDateStart,
        businessDateEnd: input.businessDateEnd,
        payload: input.payload,
        lastBuiltAt: now,
      },
      $setOnInsert: {
        profile: input.profile,
        level: input.level,
        key: input.key,
        locationId: input.locationId,
      },
    },
    { upsert: true },
  )
}

export async function findReadCachePayload<T>(
  db: Db,
  key: DailyOpsReadCacheKey,
): Promise<T | null> {
  const row = await db.collection<DailyOpsReadCacheDoc<T>>(DAILY_OPS_READ_CACHE_COLLECTION).findOne({
    profile: key.profile,
    level: key.level,
    key: key.key,
    locationId: key.locationId,
  })
  return row?.payload ?? null
}

export async function countReadCacheDocs(
  db: Db,
  profile: string,
  level: DailyOpsReadCacheKey['level'],
  locationId = 'all',
): Promise<number> {
  return db.collection(DAILY_OPS_READ_CACHE_COLLECTION).countDocuments({
    profile,
    level,
    locationId,
  })
}

export type ReadCacheGapTarget = {
  businessDate: string
  locationId: string
}

/** Snapshot exists but daily dashboard-bundle read-cache doc is missing. */
export async function findReadCacheGapTargets(
  db: Db,
  opts: { startDate: string; endDate: string; locationIds?: string[] },
): Promise<ReadCacheGapTarget[]> {
  const venueIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const locationIds = opts.locationIds ?? [...venueIds, 'all']
  const dateFilter = { $gte: opts.startDate, $lte: opts.endDate }
  const venueOnly = locationIds.filter((id) => id !== 'all')

  const [masters, cacheRows] = await Promise.all([
    db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master)
      .find({
        businessDate: dateFilter,
        locationId: { $in: venueOnly.length > 0 ? venueOnly : venueIds },
      })
      .project({ businessDate: 1, locationId: 1 })
      .toArray(),
    db
      .collection(DAILY_OPS_READ_CACHE_COLLECTION)
      .find({
        profile: DASHBOARD_BUNDLE_PROFILE,
        level: 'daily',
        locationId: { $in: locationIds },
        key: dateFilter,
      })
      .project({ key: 1, locationId: 1 })
      .toArray(),
  ])

  const cacheKeys = new Set(
    cacheRows.map((row) => `${String(row.key)}:::${String(row.locationId)}`),
  )
  const gaps = new Map<string, ReadCacheGapTarget>()

  for (const row of masters) {
    const businessDate = String(row.businessDate)
    const locationId = String(row.locationId)
    if (!locationIds.includes(locationId)) continue
    const key = `${businessDate}:::${locationId}`
    if (!cacheKeys.has(key)) gaps.set(key, { businessDate, locationId })
  }

  const datesWithMaster = new Set(masters.map((row) => String(row.businessDate)))
  if (locationIds.includes('all')) {
    for (const businessDate of datesWithMaster) {
      const key = `${businessDate}:::all`
      if (!cacheKeys.has(key)) gaps.set(key, { businessDate, locationId: 'all' })
    }
  }

  return Array.from(gaps.values()).sort((a, b) =>
    a.businessDate === b.businessDate
      ? a.locationId.localeCompare(b.locationId)
      : a.businessDate.localeCompare(b.businessDate),
  )
}
