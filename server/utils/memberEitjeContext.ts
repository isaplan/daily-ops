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

export type HoursActivityEntry = {
  location_name: string
  team_name: string
  total_hours: number
  record_count: number
}

function dateRange (monthsBack: number): { range_start: string; range_end: string } {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - monthsBack)
  return {
    range_end: end.toISOString().split('T')[0] ?? '',
    range_start: start.toISOString().split('T')[0] ?? '',
  }
}

/**
 * Sum hours per location + team from daily Eitje aggregation (worked or planned shifts).
 */
export async function fetchAggregationActivityByLocationTeam (
  db: Db,
  collectionName: 'eitje_time_registration_aggregation' | 'eitje_planning_registration_aggregation',
  options: { supportId?: string; userName: string; range: { range_start: string; range_end: string } }
): Promise<HoursActivityEntry[]> {
  const { range_start, range_end } = options.range
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
    return []
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

  const rows = await db.collection(collectionName).aggregate(pipeline).toArray() as HoursActivityEntry[]
  return rows.map((r) => ({
    location_name: r.location_name ?? 'Unknown',
    team_name: r.team_name ?? 'Unknown',
    total_hours: Number(r.total_hours ?? 0),
    record_count: Number(r.record_count ?? 0),
  }))
}

export type MergedPlaceRow = {
  location_name: string
  team_name: string
  worked_hours: number
  planned_hours: number
  worked_records: number
  planned_records: number
}

function placeKey (loc: string, team: string) {
  return `${loc.trim().toLowerCase()}|||${team.trim().toLowerCase()}`
}

export function mergeWorkedAndPlanned (
  worked: HoursActivityEntry[],
  planned: HoursActivityEntry[]
): MergedPlaceRow[] {
  const map = new Map<string, MergedPlaceRow>()
  for (const w of worked) {
    const k = placeKey(w.location_name, w.team_name)
    map.set(k, {
      location_name: w.location_name,
      team_name: w.team_name,
      worked_hours: w.total_hours,
      planned_hours: 0,
      worked_records: w.record_count,
      planned_records: 0,
    })
  }
  for (const p of planned) {
    const k = placeKey(p.location_name, p.team_name)
    const existing = map.get(k)
    if (existing) {
      existing.planned_hours = p.total_hours
      existing.planned_records = p.record_count
    } else {
      map.set(k, {
        location_name: p.location_name,
        team_name: p.team_name,
        worked_hours: 0,
        planned_hours: p.total_hours,
        worked_records: 0,
        planned_records: p.record_count,
      })
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      b.worked_hours + b.planned_hours - (a.worked_hours + a.planned_hours)
  )
}

/**
 * Worked + planned hours by location & team (Eitje aggregation), merged for one member.
 */
export async function fetchMemberEitjePlaces (
  db: Db,
  options: { supportId?: string; userName: string; monthsBack?: number }
): Promise<{
  months_back: number
  range_start: string
  range_end: string
  worked: HoursActivityEntry[]
  planned: HoursActivityEntry[]
  merged: MergedPlaceRow[]
}> {
  const monthsBack = options.monthsBack ?? 12
  const range = dateRange(monthsBack)
  const baseOpts = {
    supportId: options.supportId,
    userName: options.userName,
    range,
  }

  const [worked, planned] = await Promise.all([
    fetchAggregationActivityByLocationTeam(db, 'eitje_time_registration_aggregation', baseOpts),
    fetchAggregationActivityByLocationTeam(db, 'eitje_planning_registration_aggregation', baseOpts),
  ])

  return {
    months_back: monthsBack,
    range_start: range.range_start,
    range_end: range.range_end,
    worked,
    planned,
    merged: mergeWorkedAndPlanned(worked, planned),
  }
}
