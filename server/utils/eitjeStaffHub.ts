/**
 * @registry-id: eitjeStaffHub
 * @created: 2026-06-09T12:00:00.000Z
 * @last-modified: 2026-06-30T19:30:00.000Z
 * @description: Build + cache Eitje staff hub rows (members SSOT + Eitje activity)
 * @last-fix: [2026-06-30] Dedupe member rows by name; missing KPI accepts eitje_ids as identity
 * @adr-ref: ADR-001, ADR-012
 *
 * @exports-to:
 * ✓ server/api/daily-ops/eitje-staff.get.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type { StaffEmploymentOverride } from '~/types/staff-employment'
import { compensationStatusFromFields } from './memberCompensationRevisions'
import { resolveMemberEmploymentActive } from './memberEitjeMasterSync'

type DataSource = 'members' | 'api' | 'inbox' | 'mixed' | 'missing' | 'none'

export type StaffHubActivityFilter = 'active' | 'inactive' | 'all' | 'active_missing_90d'

export type EitjeStaffRow = {
  member_id: string | null
  employee_name: string
  support_id: string | null
  eitje_ids: string[]
  contract_type: string | null
  hourly_rate: number | null
  cost_per_hour: number | null
  compensation_status: 'ok' | 'missing'
  /** Employed per Eitje master active + contract end + override (ADR-010). */
  is_employed: boolean
  /** Hours clocked in trailing 30 days (activity signal, not employment). */
  is_active_30d: boolean
  /** Worked or had hours in trailing 90 days. */
  is_active_90d: boolean
  is_unmatched: boolean
  staff_employment_override: StaffEmploymentOverride | null
  recent_activity: {
    last_worked: string | null
    total_hours: number
    teams: string[]
  }
  data_sources: {
    contract: DataSource
    activity: DataSource
  }
  missing_data: string[]
}

export const STAFF_HISTORICAL_START = '2024-01-01'

const HUB_CACHE_TTL_MS = 90_000

type HubCache = {
  expiresAt: number
  rows: EitjeStaffRow[]
}

let hubCache: HubCache | null = null

function normStr(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

type ActivityEntry = {
  last_worked: string | null
  total_hours: number
  teams: string[]
}

type AggProfileEntry = {
  user_name: string
  last_worked: string | null
  support_id: string | null
  contract_type: string | null
  hourly_rate: number | null
}

function mergeActivityFromKeys(
  byName: Map<string, ActivityEntry>,
  keys: Iterable<string>,
  fallback: ActivityEntry,
): ActivityEntry {
  let total_hours = 0
  let last_worked: string | null = null
  const teams = new Set<string>()
  for (const k of keys) {
    const e = byName.get(k)
    if (!e) continue
    total_hours += e.total_hours
    if (e.last_worked && (!last_worked || e.last_worked > last_worked)) last_worked = e.last_worked
    for (const t of e.teams) teams.add(t)
  }
  if (total_hours === 0 && last_worked === null && teams.size === 0) return fallback
  return {
    total_hours: Math.round(total_hours * 100) / 100,
    last_worked,
    teams: [...teams],
  }
}

function bestAggProfile(
  aggProfiles: Map<string, AggProfileEntry>,
  keys: Iterable<string>,
): AggProfileEntry | undefined {
  let best: AggProfileEntry | undefined
  for (const k of keys) {
    const p = aggProfiles.get(k)
    if (!p) continue
    if (!best || String(p.last_worked ?? '') > String(best.last_worked ?? '')) best = p
  }
  return best
}

async function fetchActivity90dByName(db: Db, cutoffYmd: string): Promise<Map<string, ActivityEntry>> {
  const apiActivity = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate<{
      _id: string
      total_hours: number
      teams: string[]
      last_worked: string
    }>([
      {
        $match: {
          period_type: 'day',
          period: { $gte: cutoffYmd },
          user_name: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: { $toLower: '$user_name' },
          total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          teams: { $addToSet: '$team_name' },
          last_worked: { $max: '$period' },
        },
      },
    ])
    .toArray()

  return new Map(
    apiActivity.map((a) => [
      normStr(a._id),
      {
        last_worked: a.last_worked ?? null,
        total_hours: Math.round(a.total_hours * 100) / 100,
        teams: a.teams.filter(Boolean),
      },
    ]),
  )
}

function isActiveInLast90d(
  lastWorkedHistorical: string | null,
  activity90: ActivityEntry,
  cutoff90Ymd: string,
): boolean {
  if (activity90.total_hours > 0) return true
  const lw = activity90.last_worked ?? lastWorkedHistorical
  return Boolean(lw && lw >= cutoff90Ymd)
}

export function isStaffHubRowActiveMissing90d(row: EitjeStaffRow): boolean {
  return row.is_active_90d && row.missing_data.length > 0
}

async function fetchActivity30dByName(db: Db, cutoffYmd: string): Promise<Map<string, ActivityEntry>> {
  const apiActivity = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate<{
      _id: string
      total_hours: number
      teams: string[]
    }>([
      {
        $match: {
          period_type: 'day',
          period: { $gte: cutoffYmd },
          user_name: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: { $toLower: '$user_name' },
          total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          teams: { $addToSet: '$team_name' },
        },
      },
    ])
    .toArray()

  return new Map(
    apiActivity.map((a) => [
      normStr(a._id),
      {
        last_worked: null,
        total_hours: Math.round(a.total_hours * 100) / 100,
        teams: a.teams.filter(Boolean),
      },
    ]),
  )
}

async function fetchAggProfileByName(db: Db, sinceYmd: string): Promise<Map<string, AggProfileEntry>> {
  const docs = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate<AggProfileEntry & { _id: string }>(
      [
        {
          $match: {
            period_type: 'day',
            period: { $gte: sinceYmd },
            user_name: { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: { $toLower: '$user_name' },
            user_name: { $last: '$user_name' },
            last_worked: { $max: '$period' },
          },
        },
      ],
      { allowDiskUse: true },
    )
    .toArray()

  const map = new Map<string, AggProfileEntry>()
  for (const d of docs) {
    const key = normStr(d._id)
    const entry: AggProfileEntry = {
      user_name: String(d.user_name ?? '').trim() || String(d._id).trim(),
      last_worked: d.last_worked,
      support_id: null,
      contract_type: null,
      hourly_rate: null,
    }
    const existing = map.get(key)
    if (!existing || String(entry.last_worked ?? '') > String(existing.last_worked ?? '')) {
      map.set(key, entry)
    }
  }
  return map
}

/** Employment status filter — Eitje master + contract end, NOT trailing hours. */
export function isStaffHubRowActive(row: EitjeStaffRow): boolean {
  return row.is_employed
}

function buildMissingData(
  support_id: string | null,
  contract_type: string | null,
  hourly_rate: number | null,
  eitje_ids: string[] = [],
): string[] {
  const missing: string[] = []
  if (!hourly_rate) missing.push('hourly_rate')
  if (!contract_type) missing.push('contract_type')
  const hasIdentity = Boolean(String(support_id ?? '').trim()) || eitje_ids.some((id) => String(id).trim())
  if (!hasIdentity) missing.push('support_id')
  return missing
}

function staffRowCompleteness(row: Pick<EitjeStaffRow, 'support_id' | 'eitje_ids' | 'contract_type' | 'hourly_rate'>): number {
  let score = 0
  if (row.support_id) score += 4
  if (row.eitje_ids.length) score += 2
  if (row.contract_type) score += 1
  if (row.hourly_rate != null) score += 1
  return score
}

function buildRow(
  partial: Omit<EitjeStaffRow, 'compensation_status' | 'missing_data' | 'is_active_30d' | 'is_active_90d'>,
  activity30Hours: number,
  activity90: ActivityEntry,
  lastWorkedHistorical: string | null,
  cutoff90Ymd: string,
): EitjeStaffRow {
  const compensation_status = compensationStatusFromFields(
    partial.contract_type || '',
    partial.hourly_rate,
    partial.cost_per_hour,
  )
  const missing_data = buildMissingData(
    partial.support_id,
    partial.contract_type,
    partial.hourly_rate,
    partial.eitje_ids,
  )
  return {
    ...partial,
    compensation_status,
    missing_data,
    is_active_30d: activity30Hours > 0,
    is_active_90d: isActiveInLast90d(lastWorkedHistorical, activity90, cutoff90Ymd),
  }
}

async function buildHubRows(db: Db): Promise<EitjeStaffRow[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoffYmd = thirtyDaysAgo.toISOString().slice(0, 10)

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const cutoff90Ymd = ninetyDaysAgo.toISOString().slice(0, 10)

  const emptyActivity: ActivityEntry = { last_worked: null, total_hours: 0, teams: [] }

  const [members, activity30d, activity90d, aggProfiles] = await Promise.all([
    db
      .collection('members')
      .find({})
      .project({
        _id: 1,
        name: 1,
        support_id: 1,
        eitje_id: 1,
        eitje_ids: 1,
        contract_type: 1,
        hourly_rate: 1,
        cost_per_hour: 1,
        is_active: 1,
        eitje_active: 1,
        contract_end_date: 1,
        staff_employment_override: 1,
        unified_user_id: 1,
      })
      .toArray() as Promise<
      Array<{
        _id: ObjectId
        name?: string
        support_id?: string | number
        eitje_id?: string | number
        eitje_ids?: Array<string | number>
        contract_type?: string
        hourly_rate?: number
        cost_per_hour?: number
        is_active?: boolean
        eitje_active?: boolean
        contract_end_date?: Date
        staff_employment_override?: StaffEmploymentOverride
        unified_user_id?: ObjectId
      }>
    >,
    fetchActivity30dByName(db, cutoffYmd),
    fetchActivity90dByName(db, cutoff90Ymd),
    fetchAggProfileByName(db, STAFF_HISTORICAL_START),
  ])

  const unifiedIds = [
    ...new Set(
      members
        .map((m) => m.unified_user_id)
        .filter((id): id is ObjectId => id instanceof ObjectId)
        .map((id) => String(id)),
    ),
  ]
  const unifiedUsers = unifiedIds.length
    ? await db
        .collection('unified_user')
        .find({ _id: { $in: unifiedIds.map((id) => new ObjectId(id)) } })
        .project({ eitjeNames: 1 })
        .toArray()
    : []
  const unifiedNamesById = new Map(
    unifiedUsers.map((u) => [String(u._id), (u.eitjeNames as string[] | undefined) ?? []]),
  )

  const memberNameKeys = new Set<string>()
  const memberRowsByName = new Map<string, EitjeStaffRow>()
  const rows: EitjeStaffRow[] = []

  for (const m of members) {
    const employee_name = String(m.name ?? '').trim() || 'Unknown'
    const nameKey = normStr(employee_name)
    const aliasKeys = new Set<string>([nameKey])
    const unifiedNames = m.unified_user_id
      ? unifiedNamesById.get(String(m.unified_user_id)) ?? []
      : []
    for (const alias of unifiedNames) {
      const k = normStr(alias)
      if (k) aliasKeys.add(k)
    }
    for (const k of aliasKeys) memberNameKeys.add(k)

    const support_id = String(m.support_id ?? '').trim() || null
    const eitje_ids = [
      ...(m.eitje_ids || []).map(String),
      ...(m.eitje_id ? [String(m.eitje_id)] : []),
    ].filter(Boolean)

    const contract_type = m.contract_type?.trim() || null
    const hourly_rate = toNum(m.hourly_rate)
    const cost_per_hour = toNum(m.cost_per_hour)
    const override =
      m.staff_employment_override && m.staff_employment_override !== 'auto'
        ? m.staff_employment_override
        : null

    const activity30 = mergeActivityFromKeys(activity30d, aliasKeys, emptyActivity)
    const activity90 = mergeActivityFromKeys(activity90d, aliasKeys, emptyActivity)
    const historical = bestAggProfile(aggProfiles, aliasKeys)
    const hasActivity30d = activity30.total_hours > 0
    const hasHistorical = historical?.last_worked != null
    const hasContract = Boolean(contract_type && hourly_rate !== null)

    const is_employed = resolveMemberEmploymentActive({
      eitje_active: m.eitje_active,
      contract_end_date: m.contract_end_date instanceof Date ? m.contract_end_date : null,
      staff_employment_override: m.staff_employment_override ?? null,
      is_active: m.is_active,
    })

    const built = buildRow(
      {
        member_id: String(m._id),
        employee_name,
        support_id,
        eitje_ids,
        contract_type,
        hourly_rate,
        cost_per_hour,
        is_employed,
        is_unmatched: false,
        staff_employment_override: override,
        recent_activity: {
          last_worked: historical?.last_worked ?? activity30.last_worked,
          total_hours: activity30.total_hours,
          teams: activity30.teams,
        },
        data_sources: {
          contract: hasContract ? 'members' : 'missing',
          activity: hasActivity30d ? 'api' : hasHistorical ? 'api' : 'none',
        },
      },
      activity30.total_hours,
      activity90,
      historical?.last_worked ?? null,
      cutoff90Ymd,
    )
    const existing = memberRowsByName.get(nameKey)
    if (!existing || staffRowCompleteness(built) > staffRowCompleteness(existing)) {
      memberRowsByName.set(nameKey, built)
    }
  }

  rows.push(...memberRowsByName.values())

  for (const [nameKey, profile] of aggProfiles) {
    if (memberNameKeys.has(nameKey)) continue

    const activity30 = activity30d.get(nameKey) || emptyActivity
    const activity90 = activity90d.get(nameKey) || emptyActivity
    const contract_type = profile.contract_type
    const hourly_rate = profile.hourly_rate
    const hasContract = Boolean(contract_type && hourly_rate !== null)

    rows.push(
      buildRow(
        {
          member_id: null,
          employee_name: profile.user_name,
          support_id: profile.support_id,
          eitje_ids: [],
          contract_type,
          hourly_rate,
          cost_per_hour: null,
          is_employed: false,
          is_unmatched: true,
          staff_employment_override: null,
          recent_activity: {
            last_worked: profile.last_worked,
            total_hours: activity30.total_hours,
            teams: activity30.teams,
          },
          data_sources: {
            contract: hasContract ? 'api' : 'missing',
            activity: 'api',
          },
        },
        activity30.total_hours,
        activity90,
        profile.last_worked,
        cutoff90Ymd,
      ),
    )
  }

  rows.sort((a, b) => {
    if (a.is_employed !== b.is_employed) return a.is_employed ? -1 : 1
    if (a.is_active_30d !== b.is_active_30d) return a.is_active_30d ? -1 : 1
    if (a.missing_data.length !== b.missing_data.length) {
      return b.missing_data.length - a.missing_data.length
    }
    return (b.recent_activity.last_worked || '').localeCompare(a.recent_activity.last_worked || '')
  })

  return rows
}

export async function getEitjeStaffHubRows(db: Db, opts?: { bustCache?: boolean }): Promise<EitjeStaffRow[]> {
  const now = Date.now()
  if (!opts?.bustCache && hubCache && hubCache.expiresAt > now) {
    return hubCache.rows
  }
  const rows = await buildHubRows(db)
  hubCache = { rows, expiresAt: now + HUB_CACHE_TTL_MS }
  return rows
}

export function summarizeStaffHubRows(rows: EitjeStaffRow[]) {
  const active_count = rows.filter((r) => r.is_employed).length
  return {
    total_staff: rows.length,
    active_count,
    inactive_count: rows.length - active_count,
    with_recent_activity: rows.filter((r) => r.is_active_30d).length,
    matched: rows.filter((r) => r.member_id && r.missing_data.length === 0).length,
    missing_critical_data: rows.filter((r) => r.member_id && r.missing_data.length > 0).length,
    active_missing_90d: rows.filter((r) => isStaffHubRowActiveMissing90d(r)).length,
    unmatched_historical: rows.filter((r) => r.is_unmatched).length,
  }
}

export function filterEitjeStaffHubRows(
  rows: EitjeStaffRow[],
  opts: {
    search?: string
    onlyMissingData?: boolean
    activity?: StaffHubActivityFilter
  },
): EitjeStaffRow[] {
  const search = normStr(opts.search ?? '')
  const onlyMissingData = opts.onlyMissingData === true
  const activity = opts.activity ?? 'all'

  return rows.filter((r) => {
    if (activity === 'active' && !r.is_employed) return false
    if (activity === 'inactive' && r.is_employed) return false
    if (activity === 'active_missing_90d' && !isStaffHubRowActiveMissing90d(r)) return false
    if (onlyMissingData && r.missing_data.length === 0) return false
    if (!search) return true
    const hay = `${normStr(r.employee_name)} ${r.support_id || ''} ${r.eitje_ids.join(' ')}`
    return hay.includes(search)
  })
}

export function invalidateEitjeStaffHubCache(): void {
  hubCache = null
}
