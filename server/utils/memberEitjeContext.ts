import type { Db } from 'mongodb'

/** Eitje aggregation may store userId as number or string (support ID). */
export function eitjeUserIdCandidates (supportId: string | undefined): unknown[] {
  if (!supportId?.trim()) return []
  const s = supportId.trim()
  const out = new Set<unknown>()
  out.add(s)
  const n = Number(s)
  if (!Number.isNaN(n)) out.add(n)
  return [...out]
}

function addNonEmpty (set: Set<string>, v: unknown) {
  if (v == null) return
  const t = String(v).trim()
  if (t) set.add(t)
}

/**
 * Contract vestiging from contract exports / unified user (not on personeels CSV).
 */
export async function fetchContractLocations (
  db: Db,
  supportId: string | undefined,
  employeeName: string
): Promise<string[]> {
  const set = new Set<string>()
  const contracts = db.collection('test-eitje-contracts')
  const sid = supportId?.trim()

  if (sid) {
    const orClause: Record<string, unknown>[] = [{ support_id: sid }]
    const n = Number(sid)
    if (!Number.isNaN(n)) orClause.push({ support_id: n })
    const fromContracts = await contracts
      .find({ $or: orClause })
      .project({ contract_location: 1 })
      .limit(200)
      .toArray()
    for (const d of fromContracts) addNonEmpty(set, (d as { contract_location?: string }).contract_location)

    const uuOr: Record<string, unknown>[] = [{ support_id: sid }]
    if (!Number.isNaN(n)) uuOr.push({ allIdValues: n })
    const uu = await db.collection('unified_user').findOne({ $or: uuOr })
    if (uu) addNonEmpty(set, (uu as { contract_location?: string }).contract_location)
  }

  const name = employeeName.trim()
  if (set.size === 0 && name) {
    const byName = await contracts
      .find({ employee_name: name })
      .project({ contract_location: 1 })
      .limit(50)
      .toArray()
    for (const d of byName) addNonEmpty(set, (d as { contract_location?: string }).contract_location)
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'nl'))
}

export type HoursActivityEntry = {
  location_name: string
  team_name: string
  total_hours: number
  record_count: number
}

/**
 * Sum hours per location + team from daily aggregation rows (time registration).
 */
export async function fetchHoursActivityByLocationTeam (
  db: Db,
  options: { supportId?: string; userName: string; monthsBack?: number }
): Promise<{
  range_start: string
  range_end: string
  entries: HoursActivityEntry[]
}> {
  const monthsBack = options.monthsBack ?? 3
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - monthsBack)
  const range_end = end.toISOString().split('T')[0] ?? ''
  const range_start = start.toISOString().split('T')[0] ?? ''

  const coll = db.collection('eitje_time_registration_aggregation')
  const candidates = eitjeUserIdCandidates(options.supportId)
  const baseMatch: Record<string, unknown> = {
    period_type: 'day',
    period: { $gte: range_start, $lte: range_end },
    team_name: { $exists: true, $nin: [null, 'Unknown'] },
    location_name: { $exists: true, $nin: [null, 'Unknown'] },
  }

  if (candidates.length > 0) {
    baseMatch.userId = { $in: candidates }
  } else if (options.userName.trim()) {
    baseMatch.user_name = options.userName.trim()
  } else {
    return { range_start, range_end, entries: [] }
  }

  const pipeline: unknown[] = [
    { $match: baseMatch },
    {
      $group: {
        _id: { location_name: '$location_name', team_name: '$team_name' },
        total_hours: { $sum: '$total_hours' },
        record_count: { $sum: '$record_count' },
      },
    },
    { $sort: { total_hours: -1 } },
    {
      $project: {
        _id: 0,
        location_name: '$_id.location_name',
        team_name: '$_id.team_name',
        total_hours: 1,
        record_count: 1,
      },
    },
  ]

  const rows = await coll.aggregate(pipeline).toArray() as HoursActivityEntry[]
  return {
    range_start,
    range_end,
    entries: rows.map((r) => ({
      location_name: r.location_name ?? 'Unknown',
      team_name: r.team_name ?? 'Unknown',
      total_hours: Number(r.total_hours ?? 0),
      record_count: Number(r.record_count ?? 0),
    })),
  }
}
