/**
 * @registry-id: dailyOpsVenueTablesUpsert
 * @created: 2026-07-17T18:05:00.000Z
 * @last-modified: 2026-07-17T18:05:00.000Z
 * @description: Upsert Bork table numbers into learned venue catalog
 * @last-fix: [2026-07-17] Bulk upsert on snapshot/rebuild discovery
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueTablesSection.ts
 * ✓ server/services/borkRebuildAggregationV2Service.ts
 * ✓ scripts/backfill-venue-tables-catalog.ts
 */

import type { AnyBulkWriteOperation, Db } from 'mongodb'
import {
  DAILY_OPS_VENUE_TABLES_COLLECTION,
  ensureVenueTablesIndex,
  normalizeLocationId,
} from './collection'

export type VenueTableSighting = {
  locationId: string
  locationName?: string
  tableNum: string
  locationSpace?: string
  businessDate?: string
  seenAt?: Date
}

export async function upsertKnownVenueTables(
  db: Db,
  sightings: VenueTableSighting[],
): Promise<number> {
  if (sightings.length === 0) return 0
  await ensureVenueTablesIndex(db)

  const byKey = new Map<string, VenueTableSighting>()
  for (const raw of sightings) {
    const locationId = normalizeLocationId(raw.locationId)
    const tableNum = String(raw.tableNum ?? '').trim()
    if (!locationId || !tableNum) continue
    const key = `${locationId}::${tableNum}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, {
        locationId,
        locationName: raw.locationName?.trim() || undefined,
        tableNum,
        locationSpace: raw.locationSpace,
        businessDate: raw.businessDate,
        seenAt: raw.seenAt ?? new Date(),
      })
      continue
    }
    const seenAt = raw.seenAt ?? new Date()
    if (!prev.seenAt || seenAt >= prev.seenAt) {
      byKey.set(key, {
        ...prev,
        locationName: raw.locationName?.trim() || prev.locationName,
        locationSpace: raw.locationSpace ?? prev.locationSpace,
        businessDate: raw.businessDate ?? prev.businessDate,
        seenAt,
      })
    }
  }

  if (byKey.size === 0) return 0

  const now = new Date()
  const ops: AnyBulkWriteOperation[] = Array.from(byKey.values()).map((s) => {
    const seenAt = s.seenAt ?? now
    return {
      updateOne: {
        filter: { locationId: s.locationId, tableNum: s.tableNum },
        update: {
          $set: {
            locationId: s.locationId,
            tableNum: s.tableNum,
            lastSeenAt: seenAt,
            ...(s.locationName ? { locationName: s.locationName } : {}),
            ...(s.locationSpace ? { locationSpace: s.locationSpace } : {}),
            ...(s.businessDate ? { lastBusinessDate: s.businessDate } : {}),
          },
          $setOnInsert: {
            firstSeenAt: seenAt,
            ...(s.locationName ? {} : { locationName: '' }),
          },
        },
        upsert: true,
      },
    }
  })

  const result = await db.collection(DAILY_OPS_VENUE_TABLES_COLLECTION).bulkWrite(ops, { ordered: false })
  return (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0)
}
