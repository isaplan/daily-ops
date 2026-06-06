/**
 * @registry-id: dailyOpsEitjeStaffHubGet
 * @created: 2026-05-11T17:50:00.000Z
 * @last-modified: 2026-06-06T12:50:00.000Z
 * @description: Lists staff from members collection (SSOT) enriched with Eitje API activity data
 * @last-fix: [2026-06-06] Option B: Read from members + enrich with API activity (ADR-009)
 *
 * @adr-ref: ADR-001, ADR-009 (Option B architecture)
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/eitje-staff.vue (GET hub data)
 */

import { getDb } from '../../utils/db'
import { ObjectId } from 'mongodb'
import {
  compensationStatusFromFields,
} from '../../utils/memberCompensationRevisions'

type MatchConfidence = 'high' | 'medium' | 'none'
type DataSource = 'members' | 'api' | 'inbox' | 'mixed'

export type EitjeStaffRow = {
  member_id: string
  employee_name: string
  support_id: string | null
  eitje_ids: string[]
  contract_type: string | null
  hourly_rate: number | null
  cost_per_hour: number | null
  compensation_status: 'ok' | 'missing'
  /** Recent activity from Eitje API (last 30 days) */
  recent_activity: {
    last_worked: string | null
    total_hours: number
    teams: string[]
  }
  /** Data source indicators */
  data_sources: {
    contract: DataSource
    activity: DataSource
  }
  /** Missing data flags (for ops alerts) */
  missing_data: string[]
}

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

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const skip = Math.max(0, parseInt(String(query.skip ?? '0'), 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50))
    const search = normStr(query.search ?? '')
    const onlyMissingData = String(query.onlyMissingData ?? 'false') === 'true'

    const db = await getDb()

    // 1. Load all members (SSOT for staff profiles)
    const members = (await db
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
      .toArray()) as Array<{
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

    // 2. Get recent activity from Eitje API (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoffYmd = thirtyDaysAgo.toISOString().slice(0, 10)

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

    const activityByName = new Map(
      apiActivity.map((a) => [
        a._id,
        {
          last_worked: a.last_worked,
          total_hours: Math.round(a.total_hours * 100) / 100,
          teams: a.teams.filter(Boolean),
        },
      ])
    )

    // 3. Build staff rows
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
          : compensationStatusFromFields(
              contract_type || '',
              hourly_rate,
              cost_per_hour
            )

      // Check recent activity
      const nameKey = normStr(employee_name)
      const activity = activityByName.get(nameKey) || {
        last_worked: null,
        total_hours: 0,
        teams: [],
      }

      // Determine data sources
      const hasContract = contract_type && hourly_rate !== null
      const hasActivity = activity.total_hours > 0

      const data_sources = {
        contract: (hasContract ? 'members' : 'missing') as DataSource,
        activity: (hasActivity ? 'api' : 'none') as DataSource,
      }

      // Missing data flags
      const missing_data: string[] = []
      if (!hourly_rate) missing_data.push('hourly_rate')
      if (!contract_type) missing_data.push('contract_type')
      if (!support_id) missing_data.push('support_id')

      // Filter: only show staff with activity OR missing data flag
      if (!hasActivity && !onlyMissingData && missing_data.length === 0) {
        continue
      }

      // Search filter
      if (search) {
        const hay = `${normStr(employee_name)} ${support_id || ''} ${eitje_ids.join(' ')}`
        if (!hay.includes(search)) continue
      }

      // Only missing data filter
      if (onlyMissingData && missing_data.length === 0) {
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

    // Sort: missing data first, then by recent activity
    rows.sort((a, b) => {
      if (a.missing_data.length !== b.missing_data.length) {
        return b.missing_data.length - a.missing_data.length
      }
      if (a.recent_activity.last_worked !== b.recent_activity.last_worked) {
        return (b.recent_activity.last_worked || '').localeCompare(
          a.recent_activity.last_worked || ''
        )
      }
      return a.employee_name.localeCompare(b.employee_name, 'nl')
    })

    const total = rows.length
    const with_activity = rows.filter((r) => r.recent_activity.total_hours > 0).length
    const missing_critical_data = rows.filter((r) => r.missing_data.length > 0).length
    const page = rows.slice(skip, skip + limit)

    return {
      success: true as const,
      data: page,
      pagination: { skip, limit, total },
      summary: {
        total_staff: total,
        with_recent_activity: with_activity,
        missing_critical_data,
        data_sources_note:
          'contract=members (SSOT), activity=api (last 30d from eitje_time_registration_aggregation)',
      },
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load Eitje staff',
    })
  }
})
