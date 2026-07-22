/**
 * @registry-id: dailyOpsVenueTablesCollection
 * @created: 2026-07-17T18:05:00.000Z
 * @last-modified: 2026-07-17T18:05:00.000Z
 * @description: Mongo collection + index for learned venue tables
 * @last-fix: [2026-07-17] Initial daily_ops_venue_tables
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueTables/upsertKnownTables.ts
 * ✓ server/utils/dailyOpsVenueTables/fetchTableOccupancyKpis.ts
 * ✓ scripts/backfill-venue-tables-catalog.ts
 */

import type { Db } from 'mongodb'

export const DAILY_OPS_VENUE_TABLES_COLLECTION = 'daily_ops_venue_tables'

let indexEnsured = false

export async function ensureVenueTablesIndex(db: Db): Promise<void> {
  if (indexEnsured) return
  await db.collection(DAILY_OPS_VENUE_TABLES_COLLECTION).createIndex(
    { locationId: 1, tableNum: 1 },
    { unique: true, name: 'locationId_tableNum_unique' },
  )
  indexEnsured = true
}

export function normalizeLocationId(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object' && value !== null && 'toHexString' in value) {
    const fn = (value as { toHexString?: () => string }).toHexString
    if (typeof fn === 'function') return fn.call(value)
  }
  return String(value).trim()
}
