/**
 * @registry-id: dailyOpsColdManifest
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Mongo manifest rows for cold-tier blob archives (ADR-006)
 * @adr-ref: ADR-006
 */

import type { Db } from 'mongodb'

export const COLD_MANIFEST_COLLECTION = 'daily_ops_cold_manifest'

export type ColdManifestSource = 'bork_raw' | 'eitje_raw'

export type ColdManifestDoc = {
  businessDate: string
  locationId: string | null
  source: ColdManifestSource
  blobKey: string
  docCount: number
  byteSize: number
  archivedAt: Date
  snapshotSealed: boolean
}

export async function upsertColdManifest(
  db: Db,
  doc: ColdManifestDoc,
): Promise<void> {
  await db.collection(COLD_MANIFEST_COLLECTION).updateOne(
    {
      businessDate: doc.businessDate,
      locationId: doc.locationId,
      source: doc.source,
    },
    { $set: doc },
    { upsert: true },
  )
}

export async function findColdManifest(
  db: Db,
  businessDate: string,
  source: ColdManifestSource,
  locationId: string | null,
): Promise<ColdManifestDoc | null> {
  return (await db.collection(COLD_MANIFEST_COLLECTION).findOne({
    businessDate,
    locationId,
    source,
  })) as ColdManifestDoc | null
}

export async function coldManifestExistsForDay(
  db: Db,
  businessDate: string,
): Promise<boolean> {
  const count = await db.collection(COLD_MANIFEST_COLLECTION).countDocuments({ businessDate })
  return count > 0
}
