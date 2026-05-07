/**
 * Resolve free-text location labels (Basis inbox, Bork aggregates, abbreviations)
 * to a single **group key** per unified venue using `unified_location` + `bork_unified_location_mapping`.
 * Falls back to `canonicalVenueKeyForBorkMatching` only when nothing in Mongo matches.
 */

import type { Db } from 'mongodb'
import { canonicalVenueKeyForBorkMatching } from './inbox/basis-report-location'

function normalizeLoose(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function compactAlpha(s: string): string {
  return normalizeLoose(s).replace(/[^a-z0-9]/g, '')
}

function keyVariants(raw: string): string[] {
  const n = normalizeLoose(raw)
  const c = compactAlpha(raw)
  const out: string[] = []
  if (n.length > 0) out.push(`n:${n}`)
  if (c.length > 0) out.push(`c:${c}`)
  return out
}

export type UnifiedLocationGroupResolver = {
  /** Stable group id: `u:<ObjectId>` from unified_location, or `f:<fallback>` from heuristics */
  resolveGroupKey: (raw: string) => string | null
  /** Prefer Basis `location_id` when mapper stored it — must match `u:<id>` keys */
  groupKeyFromBasisLocationId: (id: string | undefined) => string | null
}

function registerAlias(
  aliasToGroup: Map<string, string>,
  raw: string | undefined | null,
  groupKey: string,
): void {
  if (raw == null || typeof raw !== 'string') return
  const t = raw.trim()
  if (!t) return
  for (const vk of keyVariants(t)) {
    const existing = aliasToGroup.get(vk)
    if (existing === groupKey) continue
    if (existing && existing !== groupKey) continue
    aliasToGroup.set(vk, groupKey)
  }
}

export async function loadUnifiedLocationGroupResolver(db: Db): Promise<UnifiedLocationGroupResolver> {
  const aliasToGroup = new Map<string, string>()

  const locDocs = await db
    .collection('unified_location')
    .find(
      {},
      {
        projection: {
          name: 1,
          primaryName: 1,
          canonicalName: 1,
          abbreviation: 1,
          borkMapping: 1,
        },
      },
    )
    .toArray()

  for (const doc of locDocs) {
    const id = String(doc._id)
    const groupKey = `u:${id}`
    registerAlias(aliasToGroup, doc.name as string | undefined, groupKey)
    registerAlias(aliasToGroup, doc.primaryName as string | undefined, groupKey)
    registerAlias(aliasToGroup, doc.canonicalName as string | undefined, groupKey)
    registerAlias(aliasToGroup, doc.abbreviation as string | undefined, groupKey)

    const bm = doc.borkMapping as { borkLocationName?: string } | undefined
    if (bm?.borkLocationName) registerAlias(aliasToGroup, bm.borkLocationName, groupKey)
  }

  const mappingRows = await db.collection('bork_unified_location_mapping').find({}).toArray()
  for (const row of mappingRows) {
    const uid = row.unifiedLocationId ?? row.unified_location_id
    if (uid == null) continue
    const groupKey = `u:${String(uid)}`
    registerAlias(aliasToGroup, row.unifiedLocationName as string | undefined, groupKey)
    registerAlias(aliasToGroup, (row as { borkLocationName?: string }).borkLocationName, groupKey)
  }

  const resolveGroupKey = (raw: string): string | null => {
    if (raw == null || typeof raw !== 'string') return null
    const t = raw.trim()
    if (!t) return null
    for (const vk of keyVariants(t)) {
      const g = aliasToGroup.get(vk)
      if (g) return g
    }
    const fb = canonicalVenueKeyForBorkMatching(t)
    return fb ? `f:${fb}` : null
  }

  const groupKeyFromBasisLocationId = (id: string | undefined): string | null => {
    if (id == null || String(id).trim() === '') return null
    return `u:${String(id).trim()}`
  }

  return { resolveGroupKey, groupKeyFromBasisLocationId }
}
