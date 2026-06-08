/**
 * @registry-id: eitjeStaffHub
 * @created: 2026-06-09T12:00:00.000Z
 * @last-modified: 2026-06-09T12:00:00.000Z
 * @description: Build + cache Eitje staff hub rows (members SSOT + 30d activity)
 * @last-fix: [2026-06-09] Parallel DB reads, period_type day filter, in-memory cache for pagination
 *
 * @exports-to:
 * ✓ server/api/daily-ops/eitje-staff.get.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { compensationStatusFromFields } from './memberCompensationRevisions'

type DataSource = 'members' | 'api' | 'inbox' | 'mixed' | 'missing' | 'none'

export type EitjeStaffRow = {
  member_id: string
  employee_name: string
  support_id: string | null
  eitje_ids: string[]
  contract_type: string | null
  hourly_rate: number | null
  cost_per_hour: number | null
  compensation_status: 'ok' | 'missing'
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
  last_worked: string
  total_hours: number
  teams: string[]
}

async function fetchActivityByName(db: Db, cutoffYmd: string): Promise<Map<string, ActivityEntry>> {
  const apiActivity = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate<{
      _id: string
      last_worked: string
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
          last_worked: { $max: '$period' },
          total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          teams: { $addToSet: '$team_name' },
        },
      },
    ])
    .toArray()

  return new Map(
    apiActivity.map((a) => [
      a._id,
      {
        last_worked: a.last_worked,
        total_hours: Math.round(a.total_hours * 100) / 100,
        teams: a.teams.filter(Boolean),
      },
    ])
  )
}

async function buildHubRows(db: Db): Promise<EitjeStaffRow[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoffYmd = thirtyDaysAgo.toISOString().slice(0, 10)

  const [members, activityByName] = await Promise.all([
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
        compensation_status: 1,
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
        compensation_status?: 'ok' | 'missing'
      }>
    >,
    fetchActivityByName(db, cutoffYmd),
  ])

  const rows: EitjeStaffRow[] = []

  for (const m of members) {
    const employee_name = String(m.name ?? '').trim() || 'Unknown'
    const support_id = String(m.support_id ?? '').trim() || null
    const eitje_ids = [
      ...(m.eitje_ids || []).map(String),
      ...(m.eitje_id ? [String(m.eitje_id)] : []),
    ].filter(Boolean)

    const contract_type = m.contract_type?.trim() || null
    const hourly_rate = toNum(m.hourly_rate)
    const cost_per_hour = toNum(m.cost_per_hour)

    const compensation_status =
      m.compensation_status === 'ok' || m.compensation_status === 'missing'
        ? m.compensation_status
        : compensationStatusFromFields(contract_type || '', hourly_rate, cost_per_hour)

    const nameKey = normStr(employee_name)
    const activity = activityByName.get(nameKey) || {
      last_worked: null,
      total_hours: 0,
      teams: [] as string[],
    }

    const hasContract = contract_type && hourly_rate !== null
    const hasActivity = activity.total_hours > 0

    const data_sources = {
      contract: (hasContract ? 'members' : 'missing') as EitjeStaffRow['data_sources']['contract'],
      activity: (hasActivity ? 'api' : 'none') as EitjeStaffRow['data_sources']['activity'],
    }

    const missing_data: string[] = []
    if (!hourly_rate) missing_data.push('hourly_rate')
    if (!contract_type) missing_data.push('contract_type')
    if (!support_id) missing_data.push('support_id')

    if (!hasActivity && missing_data.length === 0) {
      continue
    }

    rows.push({
      member_id: String(m._id),
      employee_name,
      support_id,
      eitje_ids,
      contract_type,
      hourly_rate,
      cost_per_hour,
      compensation_status,
      recent_activity: activity,
      data_sources,
      missing_data,
    })
  }

  rows.sort((a, b) => {
    if (a.missing_data.length !== b.missing_data.length) {
      return b.missing_data.length - a.missing_data.length
    }
    if (a.recent_activity.last_worked !== b.recent_activity.last_worked) {
      return (b.recent_activity.last_worked || '').localeCompare(a.recent_activity.last_worked || '')
    }
    return a.employee_name.localeCompare(b.employee_name, 'nl')
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

export function filterEitjeStaffHubRows(
  rows: EitjeStaffRow[],
  opts: { search?: string; onlyMissingData?: boolean }
): EitjeStaffRow[] {
  const search = normStr(opts.search ?? '')
  const onlyMissingData = opts.onlyMissingData === true

  return rows.filter((r) => {
    if (onlyMissingData && r.missing_data.length === 0) return false
    if (!search) return true
    const hay = `${normStr(r.employee_name)} ${r.support_id || ''} ${r.eitje_ids.join(' ')}`
    return hay.includes(search)
  })
}

export function invalidateEitjeStaffHubCache(): void {
  hubCache = null
}
