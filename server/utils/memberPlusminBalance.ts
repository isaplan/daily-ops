/**
 * @registry-id: memberPlusminBalance
 * @created: 2026-06-11T22:45:00.000Z
 * @last-modified: 2026-06-12T10:10:00.000Z
 * @description: YTD plus/min from 1 Jan 2026 CSV baseline + cumulative worked − contract
 * @last-fix: [2026-06-12] Fixed Jan 1 2026 opening; single forward sum (no monthly baseline pick)
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsContractHoursVariance.ts
 */

import { ObjectId, type Db } from 'mongodb'
import { weeklyHoursFromContractType } from '~/utils/dailyOpsLeerlingWageFallback'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { isoWeekKey } from './memberWeeklyHours'
import { resolveEitjeAggregationUserCandidates } from './memberEitjeContext'
import { MEMBER_EITJE_SALDO_COLLECTION } from './memberEitjeSaldoSnapshots'
import type { MemberEitjeSaldoSnapshot } from '~/types/member-eitje-saldo'

/** Opening carry-over from 2025 — Eitje CSV `eind plus/min saldo` on 1 Jan 2026. */
export const PLUSMIN_YTD_BASELINE_DATE = '2026-01-01'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function escapeRegex (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function eachYmdInclusive (start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  while (cur <= end) {
    out.push(cur)
    cur = addCalendarDaysYmd(cur, 1)
  }
  return out
}

function isUrenContract (contractType: string | null): boolean {
  return /uren contract/i.test(String(contractType ?? ''))
}

/** Cumulative worked − contract (ISO-week pro-rata) from `forwardFrom` through `forwardThrough`. */
function forwardCumulativeDelta (
  openingEind: number,
  forwardFrom: string,
  forwardThrough: string,
  weeklyContract: number,
  workedByDay: Map<string, number>,
): { balance: number; worked: number; contract: number } {
  if (forwardFrom > forwardThrough) {
    return { balance: openingEind, worked: 0, contract: 0 }
  }

  let balance = openingEind
  let worked = 0
  let contract = 0
  const daysInRange = eachYmdInclusive(forwardFrom, forwardThrough)
  const weekKeys = [...new Set(daysInRange.map(isoWeekKey))].sort()

  for (const weekKey of weekKeys) {
    const days = daysInRange.filter((d) => isoWeekKey(d) === weekKey)
    let weekWorked = 0
    for (const day of days) weekWorked += workedByDay.get(day) ?? 0
    const weekContract = weeklyContract * (days.length / 7)
    worked += weekWorked
    contract += weekContract
    balance += weekWorked - weekContract
  }

  return { balance, worked, contract }
}

async function fetchYtdBaselineSnapshot (
  db: Db,
  memberId: string,
): Promise<MemberEitjeSaldoSnapshot | null> {
  return db.collection<MemberEitjeSaldoSnapshot>(MEMBER_EITJE_SALDO_COLLECTION)
    .findOne({ member_id: memberId, snapshot_date: PLUSMIN_YTD_BASELINE_DATE })
}

/** Eitje does not accrue contract on today when no hours are logged yet. */
function resolveForwardEndDate (
  asOfDate: string,
  forwardFrom: string,
  workedByDay: Map<string, number>,
): string {
  if ((workedByDay.get(asOfDate) ?? 0) > 0) return asOfDate
  const prev = addCalendarDaysYmd(asOfDate, -1)
  return prev >= forwardFrom ? prev : asOfDate
}

async function fetchWorkedByDay (
  db: Db,
  userClause: Record<string, unknown>,
  range: { start: string; end: string },
): Promise<Map<string, number>> {
  const rows = await db
    .collection('eitje_time_registration_aggregation')
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

export type MemberPlusminBalanceResult = {
  memberId: string
  userName: string
  contractType: string
  weeklyContractHours: number
  asOfDate: string
  baselineSnapshotDate: string
  baselinePlusminHours: number
  forwardFromDate: string
  forwardThroughDate: string
  forwardWorkedHours: number
  forwardContractHours: number
  plusminHours: number
  verlofHours: number | null
  teamName: string | null
}

export async function computeMemberPlusminBalance (
  db: Db,
  memberId: ObjectId,
  asOfDate: string,
): Promise<MemberPlusminBalanceResult | null> {
  const member = await db.collection('members').findOne(
    { _id: memberId },
    { projection: { name: 1, support_id: 1, contract_type: 1, team_name: 1 } },
  )
  if (!member) return null

  const m = member as Record<string, unknown>
  const name = typeof m.name === 'string' ? m.name.trim() : ''
  const contractType = typeof m.contract_type === 'string' ? m.contract_type : null
  if (!name || !isUrenContract(contractType)) return null

  const weekly = weeklyHoursFromContractType(contractType!)
  if (weekly == null) return null

  const baseline = await fetchYtdBaselineSnapshot(db, String(memberId))
  if (!baseline) return null

  const supportId = typeof m.support_id === 'string' ? m.support_id.trim() : undefined
  const userIdCandidates = await resolveEitjeAggregationUserCandidates(db, supportId, name, {
    allowFuzzyNameMatch: true,
  })
  const userClause = userMatchClause(userIdCandidates, name)
  const workedByDay = userClause
    ? await fetchWorkedByDay(db, userClause, { start: PLUSMIN_YTD_BASELINE_DATE, end: asOfDate })
    : new Map<string, number>()

  const forwardFrom = PLUSMIN_YTD_BASELINE_DATE
  const forwardThrough = resolveForwardEndDate(asOfDate, forwardFrom, workedByDay)
  const forward = forwardCumulativeDelta(
    baseline.plusmin.eind,
    forwardFrom,
    forwardThrough,
    weekly,
    workedByDay,
  )

  return {
    memberId: String(memberId),
    userName: name,
    contractType: contractType!,
    weeklyContractHours: weekly,
    asOfDate,
    baselineSnapshotDate: baseline.snapshot_date,
    baselinePlusminHours: round2(baseline.plusmin.eind),
    forwardFromDate: forwardFrom,
    forwardThroughDate: forwardThrough,
    forwardWorkedHours: round2(forward.worked),
    forwardContractHours: round2(forward.contract),
    plusminHours: round2(forward.balance),
    verlofHours: round2(baseline.verlof.eind),
    teamName: typeof m.team_name === 'string' ? m.team_name.trim() || null : null,
  }
}
