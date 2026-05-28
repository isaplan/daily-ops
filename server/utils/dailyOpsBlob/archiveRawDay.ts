/**
 * @registry-id: dailyOpsArchiveRawDay
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Gzip raw Bork/Eitje shift docs to DO Spaces + manifest (ADR-006 cold tier)
 * @adr-ref: ADR-006
 */

import { gzipSync, gunzipSync } from 'node:zlib'
import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { readDailyOpsBlobConfig, spacesConfigured } from './config'
import { upsertColdManifest, type ColdManifestSource } from './coldManifest'
import { uploadColdBlob, downloadColdBlob } from './spacesClient'

const EITJE_SHIFT_ENDPOINTS = ['time_registration_shifts', 'planning_shifts'] as const

export type ArchiveRawDayInput = {
  businessDate: string
  locationId?: string
  deleteFromMongo?: boolean
}

export type ArchiveRawDayResult = {
  archived: Array<{ source: ColdManifestSource; docCount: number; byteSize: number; blobKey: string }>
  skipped: string[]
}

function utcDayRange(businessDate: string): { start: Date; end: Date } {
  const next = addCalendarDaysYmd(businessDate, 1)
  return {
    start: new Date(`${businessDate}T00:00:00.000Z`),
    end: new Date(`${next}T00:00:00.000Z`),
  }
}

function blobKey(
  prefix: string,
  source: ColdManifestSource,
  businessDate: string,
  locationId: string | null,
): string {
  const loc = locationId ?? 'all'
  return `${prefix}/raw/${source}/${businessDate}/${loc}.json.gz`
}

async function archiveCollection(
  db: Db,
  cfg: ReturnType<typeof readDailyOpsBlobConfig>,
  input: ArchiveRawDayInput,
  source: ColdManifestSource,
  collection: string,
  filter: Record<string, unknown>,
): Promise<{ source: ColdManifestSource; docCount: number; byteSize: number; blobKey: string } | null> {
  const docs = await db.collection(collection).find(filter).toArray()
  if (docs.length === 0) return null

  const payload = JSON.stringify(docs)
  const gz = gzipSync(Buffer.from(payload, 'utf8'))
  const key = blobKey(cfg.coldPrefix, source, input.businessDate, input.locationId ?? null)
  await uploadColdBlob(cfg, key, gz)

  await upsertColdManifest(db, {
    businessDate: input.businessDate,
    locationId: input.locationId ?? null,
    source,
    blobKey: key,
    docCount: docs.length,
    byteSize: gz.byteLength,
    archivedAt: new Date(),
    snapshotSealed: true,
  })

  if (input.deleteFromMongo !== false && cfg.deleteRawAfterArchive) {
    const ids = docs.map((d) => d._id).filter(Boolean)
    if (ids.length > 0) {
      await db.collection(collection).deleteMany({ _id: { $in: ids } })
    }
  }

  return { source, docCount: docs.length, byteSize: gz.byteLength, blobKey: key }
}

/** Archive raw shift data for one business day (optional location scope). */
export async function archiveRawDay(
  db: Db,
  input: ArchiveRawDayInput,
): Promise<ArchiveRawDayResult> {
  const cfg = readDailyOpsBlobConfig()
  if (!spacesConfigured(cfg)) {
    return { archived: [], skipped: ['DO Spaces not configured'] }
  }

  const { start, end } = utcDayRange(input.businessDate)
  const archived: ArchiveRawDayResult['archived'] = []
  const skipped: string[] = []

  const borkFilter: Record<string, unknown> = {
    endpoint: 'bork_daily',
    date: { $gte: start, $lt: end },
  }
  if (input.locationId && ObjectId.isValid(input.locationId)) {
    borkFilter.locationId = new ObjectId(input.locationId)
  }

  const bork = await archiveCollection(db, cfg, input, 'bork_raw', 'bork_raw_data', borkFilter)
  if (bork) archived.push(bork)
  else skipped.push('bork_raw: no docs')

  const eitjeFilter: Record<string, unknown> = {
    endpoint: { $in: [...EITJE_SHIFT_ENDPOINTS] },
    date: { $gte: start, $lt: end },
  }
  if (input.locationId) {
    eitjeFilter.$or = [
      { locationId: input.locationId },
      ...(ObjectId.isValid(input.locationId) ? [{ locationId: new ObjectId(input.locationId) }] : []),
    ]
  }

  const eitje = await archiveCollection(db, cfg, input, 'eitje_raw', 'eitje_raw_data', eitjeFilter)
  if (eitje) archived.push(eitje)
  else skipped.push('eitje_raw: no docs')

  return { archived, skipped }
}

/** Restore archived raw docs into Mongo (rehydrate). */
export async function rehydrateRawDayFromBlob(
  db: Db,
  businessDate: string,
  source: ColdManifestSource,
  locationId: string | null,
): Promise<{ inserted: number }> {
  const cfg = readDailyOpsBlobConfig()
  if (!spacesConfigured(cfg)) {
    throw new Error('DO Spaces not configured')
  }

  const key = blobKey(cfg.coldPrefix, source, businessDate, locationId)
  const gz = await downloadColdBlob(cfg, key)
  const json = gunzipSync(gz).toString('utf8')
  const docs = JSON.parse(json) as Record<string, unknown>[]
  if (!Array.isArray(docs) || docs.length === 0) return { inserted: 0 }

  const collection = source === 'bork_raw' ? 'bork_raw_data' : 'eitje_raw_data'
  await db.collection(collection).deleteMany({
    _id: { $in: docs.map((d) => d._id).filter(Boolean) },
  })
  await db.collection(collection).insertMany(docs as never[])
  return { inserted: docs.length }
}
