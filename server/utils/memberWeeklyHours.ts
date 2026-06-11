/**
 * @registry-id: memberWeeklyHours
 * @created: 2026-06-10T12:00:00.000Z
 * @last-modified: 2026-06-10T12:00:00.000Z
 * @description: Weekly worked vs contract/planned hours rollup for one member
 * @last-fix: [2026-06-10] ISO-week rollup from Eitje warm aggregation
 *
 * @exports-to:
 * ✓ server/api/daily-ops/staff/member/[id]/weekly-hours.get.ts
 */

import { ObjectId, type Db } from 'mongodb'
import { weeklyHoursFromContractType } from '../../utils/dailyOpsLeerlingWageFallback'
import type {
  StaffWeeklyHoursPayload,
  StaffWeeklyHoursWeek,
} from '../../types/daily-ops-staff'
import { resolveEitjeAggregationUserCandidates } from './memberEitjeContext'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function userMatchClause(userIdCandidates: unknown[], userName: string): Record<string, unknown> | null {
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

/** ISO week key e.g. 2026-W05 */
export function isoWeekKey(ymd: string): string {
  const dt = new Date(`${ymd}T12:00:00Z`)
  const day = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - day + 3)
  const w1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4))
  const w =
    1 +
    Math.round(
      ((dt.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7
    )
  return `${dt.getUTCFullYear()}-W${String(w).padStart(2, '0')}`
}

function weekLabel(weekKey: string): string {
  return weekKey.replace('-W', ' wk ')
}

function eachYmdInRange(start: string, end: string): string[] {
  const out: string[] = []
  const cur = new Date(`${start}T12:00:00Z`)
  const endDt = new Date(`${end}T12:00:00Z`)
  while (cur <= endDt) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

async function fetchDailyHours(
  db: Db,
  collection: 'eitje_time_registration_aggregation' | 'eitje_planning_registration_aggregation',
  userClause: Record<string, unknown>,
  range: { start: string; end: string }
): Promise<Map<string, number>> {
  const rows = await db
    .collection(collection)
    .find({
      period_type: 'day',
      period: { $gte: range.start, $lte: range.end },
      ...userClause,
    })
    .project({ period: 1, total_hours: 1 })
    .toArray()

  const byDay = new Map<string, number>()
  for (const row of rows) {
    const period = String((row as Record<string, unknown>).period ?? '')
    if (!period) continue
    byDay.set(period, (byDay.get(period) ?? 0) + Number((row as Record<string, unknown>).total_hours ?? 0))
  }
  return byDay
}

export function resolveStaffHoursRange(
  preset: 'ytd' | '3m' | '6mo' | 'custom',
  custom?: { start?: string; end?: string }
): { start: string; end: string } {
  const end = new Date()
  const endYmd = end.toISOString().slice(0, 10)
  if (preset === 'custom' && custom?.start && custom?.end) {
    return { start: custom.start.slice(0, 10), end: custom.end.slice(0, 10) }
  }
  if (preset === 'ytd') {
    const y = end.getFullYear()
    return { start: `${y}-01-01`, end: endYmd }
  }
  const start = new Date(end)
  start.setMonth(start.getMonth() - (preset === '3m' ? 3 : 6))
  return { start: start.toISOString().slice(0, 10), end: endYmd }
}

export async function fetchMemberWeeklyHours(
  db: Db,
  memberId: ObjectId,
  range: { start: string; end: string }
): Promise<StaffWeeklyHoursPayload> {
  const member = await db.collection('members').findOne(
    { _id: memberId },
    { projection: { name: 1, support_id: 1, contract_type: 1 } }
  )
  if (!member) {
    throw new Error('Member not found')
  }

  const m = member as Record<string, unknown>
  const name = typeof m.name === 'string' ? m.name.trim() : ''
  const supportId = typeof m.support_id === 'string' ? m.support_id.trim() : undefined
  const contractType = typeof m.contract_type === 'string' ? m.contract_type : null
  const contractWeekly = contractType ? weeklyHoursFromContractType(contractType) : null

  const userIdCandidates = await resolveEitjeAggregationUserCandidates(db, supportId, name, {
    allowFuzzyNameMatch: true,
  })
  const userClause = userMatchClause(userIdCandidates, name)

  const emptyPayload = (): StaffWeeklyHoursPayload => ({
    member_id: String(memberId),
    member_name: name || `Member ${String(memberId).slice(-6)}`,
    range_start: range.start,
    range_end: range.end,
    contract_weekly: contractWeekly,
    contract_type: contractType,
    weeks: [],
    totals: {
      worked_hours: 0,
      planned_hours: 0,
      contract_hours: contractWeekly != null ? 0 : null,
      delta_vs_contract: contractWeekly != null ? 0 : null,
      avg_weekly_delta: null,
    },
    planned_coverage_pct: null,
    data_gap: true,
    has_eitje_match: false,
  })

  if (!userClause) {
    return emptyPayload()
  }

  const [workedByDay, plannedByDay] = await Promise.all([
    fetchDailyHours(db, 'eitje_time_registration_aggregation', userClause, range),
    fetchDailyHours(db, 'eitje_planning_registration_aggregation', userClause, range),
  ])

  const hasEitjeMatch = workedByDay.size > 0 || plannedByDay.size > 0

  const daysInRange = eachYmdInRange(range.start, range.end)
  const weekDays = new Map<string, string[]>()
  for (const ymd of daysInRange) {
    const wk = isoWeekKey(ymd)
    const list = weekDays.get(wk) ?? []
    list.push(ymd)
    weekDays.set(wk, list)
  }

  const weeks: StaffWeeklyHoursWeek[] = []
  for (const [week_key, days] of [...weekDays.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    let worked = 0
    let planned = 0
    for (const d of days) {
      worked += workedByDay.get(d) ?? 0
      planned += plannedByDay.get(d) ?? 0
    }
    const contract_hours =
      contractWeekly != null ? round2(contractWeekly * (days.length / 7)) : null
    weeks.push({
      week_key,
      week_label: weekLabel(week_key),
      worked_hours: round2(worked),
      planned_hours: round2(planned),
      contract_hours,
      delta_vs_contract:
        contract_hours != null ? round2(worked - contract_hours) : null,
      delta_vs_planned: round2(worked - planned),
      days_in_range: days.length,
    })
  }

  const totalWorked = round2(weeks.reduce((s, w) => s + w.worked_hours, 0))
  const totalPlanned = round2(weeks.reduce((s, w) => s + w.planned_hours, 0))
  const totalContract =
    contractWeekly != null
      ? round2(weeks.reduce((s, w) => s + (w.contract_hours ?? 0), 0))
      : null
  const deltaVsContract =
    totalContract != null ? round2(totalWorked - totalContract) : null

  const weeksWithWorked = weeks.filter((w) => w.worked_hours > 0)
  const weeksWithPlanned = weeks.filter((w) => w.planned_hours > 0)
  const plannedCoverage =
    weeksWithWorked.length > 0
      ? round2((weeksWithPlanned.length / weeksWithWorked.length) * 100)
      : null

  const deltas = weeks
    .map((w) => w.delta_vs_contract)
    .filter((d): d is number => d != null)
  const avgWeeklyDelta =
    deltas.length > 0 ? round2(deltas.reduce((s, d) => s + d, 0) / deltas.length) : null

  return {
    member_id: String(memberId),
    member_name: name || `Member ${String(memberId).slice(-6)}`,
    range_start: range.start,
    range_end: range.end,
    contract_weekly: contractWeekly,
    contract_type: contractType,
    weeks,
    totals: {
      worked_hours: totalWorked,
      planned_hours: totalPlanned,
      contract_hours: totalContract,
      delta_vs_contract: deltaVsContract,
      avg_weekly_delta: avgWeeklyDelta,
    },
    planned_coverage_pct: plannedCoverage,
    data_gap: !hasEitjeMatch,
    has_eitje_match: hasEitjeMatch,
  }
}
