/**
 * @registry-id: dailyOpsSnapshotDenormalizeNames
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-13T09:20:00.000Z
 * @description: Resolves locationName, teamName, userName once per snapshot build and caches them.
 *   Used by buildRevenueSection + buildLaborSection so the master/section docs never $lookup on read.
 * @last-fix: [2026-05-13] Coerce DEBUG to string before .includes (boolean env).
 *
 * @architecture:
 *   - Single batched lookup per id-set.
 *   - Sources (confirmed live 2026-05-13):
 *     - locations: bork_unified_location_mapping (unifiedLocationId → unifiedLocationName)
 *                  fallback: locations.name (legacy plain locations)
 *     - teams: teams.name keyed by ObjectId; fallback eitje agg already carries team_name
 *     - users: members.name keyed by _id; fallback eitje agg already carries user_name
 *   - Warns to console when a name is missing (logs gated by DEBUG=snapshot:denorm).
 *
 * @exports-to:
 *   ✓ server/services/dailyOpsSnapshotService.ts
 *   ✓ server/utils/dailyOpsSnapshot/buildRevenueSection.ts
 *   ✓ server/utils/dailyOpsSnapshot/buildLaborSection.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

const DEBUG = String(process.env.DEBUG ?? '').includes('snapshot:denorm')

export type NameLookups = {
  location: (id: string) => string
  team: (id: string) => string
  user: (id: string) => string
}

function toObjectIdSafe(id: string): ObjectId | null {
  try {
    return ObjectId.isValid(id) ? new ObjectId(id) : null
  } catch {
    return null
  }
}

export async function buildNameLookups(
  db: Db,
  ids: { locationIds: string[]; teamIds: string[]; userIds: string[] }
): Promise<NameLookups> {
  const locOids = ids.locationIds.map(toObjectIdSafe).filter(Boolean) as ObjectId[]
  const teamOids = ids.teamIds.map(toObjectIdSafe).filter(Boolean) as ObjectId[]
  const userOids = ids.userIds.map(toObjectIdSafe).filter(Boolean) as ObjectId[]

  const [locMap, teamMap, userMap] = await Promise.all([
    (async () => {
      const m = new Map<string, string>()
      if (locOids.length === 0) return m
      const rows = await db
        .collection('bork_unified_location_mapping')
        .find({ unifiedLocationId: { $in: locOids } })
        .project({ unifiedLocationId: 1, unifiedLocationName: 1 })
        .toArray()
      for (const r of rows) m.set(String(r.unifiedLocationId), r.unifiedLocationName)
      const missing = ids.locationIds.filter((id) => !m.has(id))
      if (missing.length > 0) {
        const fb = await db
          .collection('locations')
          .find({ _id: { $in: missing.map(toObjectIdSafe).filter(Boolean) as ObjectId[] } })
          .project({ _id: 1, name: 1 })
          .toArray()
        for (const r of fb) m.set(String(r._id), r.name)
      }
      return m
    })(),
    (async () => {
      const m = new Map<string, string>()
      if (teamOids.length === 0) return m
      const rows = await db
        .collection('teams')
        .find({ _id: { $in: teamOids } })
        .project({ _id: 1, name: 1 })
        .toArray()
      for (const r of rows) m.set(String(r._id), r.name)
      return m
    })(),
    (async () => {
      const m = new Map<string, string>()
      if (userOids.length === 0) return m
      const rows = await db
        .collection('members')
        .find({ _id: { $in: userOids } })
        .project({ _id: 1, name: 1 })
        .toArray()
      for (const r of rows) m.set(String(r._id), r.name)
      return m
    })(),
  ])

  if (DEBUG) {
    console.info(
      `[snapshot:denorm] locations: ${locMap.size}/${ids.locationIds.length} | teams: ${teamMap.size}/${ids.teamIds.length} | users: ${userMap.size}/${ids.userIds.length}`
    )
  }

  return {
    location: (id) => locMap.get(id) ?? '',
    team: (id) => teamMap.get(id) ?? '',
    user: (id) => userMap.get(id) ?? '',
  }
}
