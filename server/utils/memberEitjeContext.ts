import type { Db } from 'mongodb'
import { EITJE_HOURS_ADD_FIELDS } from './eitjeHours'

/** Eitje aggregation may store userId as number or string (support ID is often different). */
export function eitjeUserIdCandidates (supportId: string | undefined): unknown[] {
  if (!supportId?.trim()) return []
  const s = supportId.trim()
  const out = new Set<unknown>()
  out.add(s)
  const n = Number(s)
  if (!Number.isNaN(n)) out.add(n)
  return [...out]
}

function escapeRegex (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function addId (out: Set<unknown>, v: unknown) {
  if (v == null) return
  if (typeof v === 'number' && !Number.isNaN(v)) {
    out.add(v)
    out.add(String(v))
    return
  }
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return
    out.add(t)
    const n = Number(t)
    if (!Number.isNaN(n) && String(n) === t) out.add(n)
    return
  }
  if (typeof v === 'object' && v && 'toString' in v) {
    const t = String(v)
    if (t && /^[0-9a-f]{24}$/i.test(t)) out.add(v)
    else if (t) out.add(t)
  }
}

/**
 * Resolve every id Eitje might store as aggregation `userId` for this person.
 * Support ID from CSV is often NOT the same as Eitje internal user id — use unified_user.
 */
export async function resolveEitjeAggregationUserCandidates (
  db: Db,
  supportId: string | undefined,
  userName: string
): Promise<unknown[]> {
  const out = new Set<unknown>()
  for (const x of eitjeUserIdCandidates(supportId)) addId(out, x)

  const orClause: Record<string, unknown>[] = []
  const sid = supportId?.trim()
  if (sid) {
    const n = Number(sid)
    orClause.push({ support_id: sid })
    orClause.push({ support_id: n })
    if (!Number.isNaN(n)) {
      orClause.push({ eitjeIds: n })
      orClause.push({ allIdValues: n })
    }
  }
  const name = userName.trim()
  if (name) {
    orClause.push({ canonicalName: name })
    orClause.push({ primaryName: name })
    orClause.push({ name: name })
    orClause.push({
      canonicalName: { $regex: `^\\s*${escapeRegex(name)}\\s*$`, $options: 'i' },
    })
  }

  if (orClause.length > 0) {
    const users = await db
      .collection('unified_user')
      .find({ $or: orClause })
      .project({ eitjeIds: 1, allIdValues: 1, primaryId: 1, support_id: 1 })
      .limit(40)
      .toArray()

    for (const u of users) {
      const doc = u as Record<string, unknown>
      const ej = doc.eitjeIds
      if (Array.isArray(ej)) for (const x of ej) addId(out, x)
      const av = doc.allIdValues
      if (Array.isArray(av)) for (const x of av) addId(out, x)
      addId(out, doc.primaryId)
      addId(out, doc.support_id)
    }
  }

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

function userMatchClause (userIdCandidates: unknown[], userName: string): Record<string, unknown> | null {
  const orBranches: Record<string, unknown>[] = []
  if (userIdCandidates.length > 0) {
    orBranches.push({ userId: { $in: userIdCandidates } })
  }
  const name = userName.trim()
  if (name) {
    orBranches.push({ user_name: name })
    orBranches.push({
      user_name: { $regex: `^\\s*${escapeRegex(name)}\\s*$`, $options: 'i' },
    })
  }
  if (orBranches.length === 0) return null
  return { $or: orBranches }
}

/**
 * Sum hours per location + team from daily Eitje aggregation (worked or planned shifts).
 */
export async function fetchAggregationActivityByLocationTeam (
  db: Db,
  collectionName: 'eitje_time_registration_aggregation' | 'eitje_planning_registration_aggregation',
  options: {
    userIdCandidates: unknown[]
    userName: string
    range: { range_start: string; range_end: string }
  }
): Promise<HoursActivityEntry[]> {
  const { range_start, range_end } = options.range
  const userClause = userMatchClause(options.userIdCandidates, options.userName)
  if (!userClause) return []

  const baseMatch: Record<string, unknown> = {
    period_type: 'day',
    period: { $gte: range_start, $lte: range_end },
    team_name: { $exists: true, $nin: [null, 'Unknown'] },
    location_name: { $exists: true, $nin: [null, 'Unknown'] },
    ...userClause,
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

const unifiedTeamLookup = {
  $lookup: {
    from: 'unified_team',
    let: { tid: '$teamId' },
    pipeline: [
      {
        $match: {
          $expr: {
            $or: [
              { $in: ['$$tid', { $ifNull: ['$eitjeIds', []] }] },
              { $in: ['$$tid', { $ifNull: ['$allIdValues', []] }] },
              { $eq: ['$primaryId', '$$tid'] },
            ],
          },
        },
      },
      { $limit: 1 },
      { $project: { primaryName: 1, canonicalName: 1 } },
    ],
    as: 'team',
  },
} as const

/**
 * When aggregation has no rows (stale pipeline, id mismatch), derive place + hours from eitje_raw_data.
 */
async function fetchRawPlacesByEndpoint (
  db: Db,
  endpoint: 'time_registration_shifts' | 'planning_shifts',
  range: { range_start: string; range_end: string },
  supportId: string | undefined,
  userIdCandidates: unknown[]
): Promise<HoursActivityEntry[]> {
  const sid = supportId?.trim()
  if (userIdCandidates.length === 0 && !sid) return []

  const start = new Date(`${range.range_start}T00:00:00.000Z`)
  const end = new Date(`${range.range_end}T23:59:59.999Z`)

  const orCond: Record<string, unknown>[] = []
  if (userIdCandidates.length > 0) {
    orCond.push({ aggUid: { $in: userIdCandidates } })
  }
  if (sid) {
    orCond.push({ aggSupportStr: sid })
    const n = Number(sid)
    if (!Number.isNaN(n)) orCond.push({ aggSupportStr: String(n) })
  }

  const pipeline: unknown[] = [
    {
      $match: {
        endpoint,
        date: { $gte: start, $lte: end },
      },
    },
    {
      $addFields: {
        ...EITJE_HOURS_ADD_FIELDS,
        aggUid: {
          $ifNull: [
            '$extracted.userId',
            { $ifNull: ['$rawApiResponse.user_id', '$rawApiResponse.user.id'] },
          ],
        },
        aggSupportStr: {
          $toString: {
            $ifNull: [
              '$extracted.supportId',
              {
                $ifNull: [
                  '$rawApiResponse.support_id',
                  { $ifNull: ['$rawApiResponse.id', ''] },
                ],
              },
            ],
          },
        },
        teamId: {
          $ifNull: [
            '$extracted.teamId',
            { $ifNull: ['$rawApiResponse.team_id', '$rawApiResponse.team.id'] },
          ],
        },
        locName: {
          $ifNull: [
            '$extracted.locationName',
            {
              $ifNull: [
                '$extracted.environmentName',
                {
                  $ifNull: [
                    '$rawApiResponse.location_name',
                    { $ifNull: ['$rawApiResponse.environment_name', ''] },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    { $match: { $or: orCond } },
    unifiedTeamLookup,
    {
      $addFields: {
        team_name: {
          $ifNull: [
            { $arrayElemAt: ['$team.canonicalName', 0] },
            { $ifNull: [{ $arrayElemAt: ['$team.primaryName', 0] }, 'Unknown'] },
          ],
        },
        location_name: {
          $cond: [
            { $and: [{ $ne: ['$locName', null] }, { $ne: [{ $toString: '$locName' }, ''] }] },
            { $toString: '$locName' },
            'Unknown',
          ],
        },
      },
    },
    {
      $match: {
        team_name: { $nin: [null, '', 'Unknown'] },
        location_name: { $nin: [null, '', 'Unknown'] },
      },
    },
    {
      $group: {
        _id: { location_name: '$location_name', team_name: '$team_name' },
        total_hours: { $sum: '$hours' },
        record_count: { $sum: 1 },
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

  const rows = await db.collection('eitje_raw_data').aggregate(pipeline).toArray() as HoursActivityEntry[]
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
 * Falls back to eitje_raw_data when aggregation returns nothing (common when userId ≠ support_id).
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
  source: 'aggregation' | 'raw_fallback' | 'none'
}> {
  const monthsBack = options.monthsBack ?? 36
  const range = dateRange(monthsBack)
  const userIdCandidates = await resolveEitjeAggregationUserCandidates(
    db,
    options.supportId,
    options.userName
  )

  const baseOpts = {
    userIdCandidates,
    userName: options.userName,
    range,
  }

  let worked = await fetchAggregationActivityByLocationTeam(
    db,
    'eitje_time_registration_aggregation',
    baseOpts
  )
  let planned = await fetchAggregationActivityByLocationTeam(
    db,
    'eitje_planning_registration_aggregation',
    baseOpts
  )

  let merged = mergeWorkedAndPlanned(worked, planned)
  let source: 'aggregation' | 'raw_fallback' | 'none' =
    merged.length > 0 ? 'aggregation' : 'none'

  if (merged.length === 0) {
    const [rw, rp] = await Promise.all([
      fetchRawPlacesByEndpoint(db, 'time_registration_shifts', range, options.supportId, userIdCandidates),
      fetchRawPlacesByEndpoint(db, 'planning_shifts', range, options.supportId, userIdCandidates),
    ])
    worked = rw
    planned = rp
    merged = mergeWorkedAndPlanned(worked, planned)
    if (merged.length > 0) source = 'raw_fallback'
  }

  return {
    months_back: monthsBack,
    range_start: range.range_start,
    range_end: range.range_end,
    worked,
    planned,
    merged,
    source,
  }
}
