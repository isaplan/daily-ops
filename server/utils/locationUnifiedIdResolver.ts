/**
 * @registry-id: locationUnifiedIdResolver
 * @created: 2026-05-30T00:00:00.000Z
 * @last-modified: 2026-05-30T00:00:00.000Z
 * @description: Resolve organisation locations._id ↔ unified Bork locationId for snapshot rebuild + space config
 * @last-fix: [2026-05-30] Org/unified ID bridge for revenue_spaces + rebuild-spaces
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/locationSpaceResolver.ts
 * ✓ server/api/daily-ops/snapshot/rebuild-spaces.post.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

function normalizeId(raw: unknown): string {
  if (raw == null) return ''
  if (raw instanceof ObjectId) return raw.toString()
  return String(raw).trim()
}

function normalizeVenueName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function venueNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b || a.includes(b) || b.includes(a)) return true
  if (a.includes('kinsbergen') && b.includes('kinsbergen')) return true
  if (a.includes('barbea') && b.includes('barbea')) return true
  if ((a.includes('lamour') || a.includes('amour')) && (b.includes('lamour') || b.includes('amour'))) return true
  return false
}

type MappingRow = {
  unifiedLocationId?: unknown
  unifiedLocationName?: unknown
  locationId?: unknown
}

async function findMappingRow(db: Db, locationId: string): Promise<MappingRow | null> {
  if (!ObjectId.isValid(locationId)) return null
  const oid = new ObjectId(locationId)
  return db.collection<MappingRow>('bork_unified_location_mapping').findOne({
    $or: [{ unifiedLocationId: oid }, { locationId: oid }],
  })
}

/** Snapshot/Bork reads always use unifiedLocationId from bork_unified_location_mapping. */
export async function resolveUnifiedLocationId(db: Db, locationId: string): Promise<string> {
  const id = locationId.trim()
  if (!ObjectId.isValid(id)) return id

  const asUnified = await db.collection('bork_unified_location_mapping').findOne(
    { unifiedLocationId: new ObjectId(id) },
    { projection: { unifiedLocationId: 1 } },
  )
  if (asUnified?.unifiedLocationId) return normalizeId(asUnified.unifiedLocationId)

  const mapped = await findMappingRow(db, id)
  if (mapped?.unifiedLocationId) return normalizeId(mapped.unifiedLocationId)

  const orgDoc = await db.collection('locations').findOne(
    { _id: new ObjectId(id) },
    { projection: { name: 1 } },
  )
  const orgName = normalizeVenueName(String(orgDoc?.name ?? ''))
  if (orgName) {
    const mappings = await db.collection<MappingRow>('bork_unified_location_mapping').find({}).toArray()
    for (const row of mappings) {
      const unifiedName = normalizeVenueName(String(row.unifiedLocationName ?? ''))
      if (venueNamesMatch(orgName, unifiedName) && row.unifiedLocationId) {
        return normalizeId(row.unifiedLocationId)
      }
    }
  }

  return id
}

/** Ordered location _id candidates when loading locations.revenue_spaces (org doc may differ from Bork id). */
export async function resolveRevenueSpacesLocationIds(
  db: Db,
  locationId: string,
  locationName?: string,
): Promise<string[]> {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: unknown) => {
    const id = normalizeId(raw)
    if (!id || !ObjectId.isValid(id) || seen.has(id)) return
    seen.add(id)
    out.push(id)
  }

  push(locationId)

  const unifiedId = await resolveUnifiedLocationId(db, locationId)
  push(unifiedId)

  const mapping = await findMappingRow(db, locationId)
  if (mapping?.locationId) push(mapping.locationId)

  const unifiedMapping = ObjectId.isValid(unifiedId)
    ? await db.collection<MappingRow>('bork_unified_location_mapping').findOne(
        { unifiedLocationId: new ObjectId(unifiedId) },
        { projection: { unifiedLocationName: 1, locationId: 1 } },
      )
    : null
  if (unifiedMapping?.locationId) push(unifiedMapping.locationId)

  const names = new Set<string>()
  if (locationName) names.add(normalizeVenueName(locationName))
  if (unifiedMapping?.unifiedLocationName) {
    names.add(normalizeVenueName(String(unifiedMapping.unifiedLocationName)))
  }

  const directDoc = await db.collection('locations').findOne(
    { _id: new ObjectId(locationId) },
    { projection: { name: 1 } },
  )
  if (directDoc?.name) names.add(normalizeVenueName(String(directDoc.name)))

  if (names.size > 0) {
    const orgLocs = await db.collection('locations').find({}, { projection: { name: 1 } }).toArray()
    for (const loc of orgLocs) {
      const norm = normalizeVenueName(String(loc.name ?? ''))
      if (!norm) continue
      for (const needle of names) {
        if (venueNamesMatch(norm, needle)) {
          push(loc._id)
          break
        }
      }
    }
  }

  return out
}
