/**
 * @registry-id: dailyOpsStaffFetchPlusminSummary
 * @created: 2026-06-25T14:00:00.000Z
 * @last-modified: 2026-06-25T14:00:00.000Z
 * @description: Staff plus/min summary — totals, per venue, month/week outlier KPIs
 * @last-fix: [2026-06-25] Plus/min tab API builder
 *
 * @exports-to:
 * ✓ server/api/daily-ops/staff/plusmin-summary.get.ts
 */

import { ObjectId, type Db } from 'mongodb'
import type {
  DailyOpsStaffPlusminMemberRow,
  DailyOpsStaffPlusminSummaryDto,
  DailyOpsStaffPlusminVenueRow,
} from '~/types/daily-ops-staff'
import { weeklyHoursFromContractType } from '~/utils/dailyOpsLeerlingWageFallback'
import { resolveEitjeAggregationUserCandidates } from '../memberEitjeContext'
import {
  allocateVenuePlusmin,
  fetchWorkedDetail,
  isUrenContract,
  periodPlusminDelta,
  sumPlusMinus,
  workedSplitForSubrange,
} from './computeStaffPlusminPeriod'

const MONTH_OVER_THRESHOLD = 20
const MONTH_UNDER_THRESHOLD = -20
const WEEK_OVER_THRESHOLD = 8
const WEEK_UNDER_THRESHOLD = -8

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

async function resolveLocationNames(db: Db, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const valid = ids.filter((id) => ObjectId.isValid(id))
  if (!valid.length) return map
  const rows = await db
    .collection('locations')
    .find({ _id: { $in: valid.map((id) => new ObjectId(id)) } })
    .project({ name: 1 })
    .toArray()
  for (const row of rows) {
    map.set(String(row._id), String((row as Record<string, unknown>).name ?? row._id))
  }
  return map
}

export type StaffPlusminSummaryInput = {
  displayStart: string
  displayEnd: string
  displayLabel: string
  monthStart: string
  monthEnd: string
  monthLabel: string
  weekStart: string
  weekEnd: string
  weekLabel: string
}

export async function fetchStaffPlusminSummary(
  db: Db,
  input: StaffPlusminSummaryInput,
): Promise<DailyOpsStaffPlusminSummaryDto> {
  const members = await db
    .collection('members')
    .find({ is_active: { $ne: false }, contract_type: /uren contract/i })
    .project({ _id: 1, name: 1, support_id: 1, contract_type: 1, team_name: 1 })
    .toArray()

  const memberRows: DailyOpsStaffPlusminMemberRow[] = []
  const venueAcc = new Map<string, { worked: number; contract: number; delta: number }>()

  const fetchStart = [
    input.displayStart,
    input.monthStart,
    input.weekStart,
  ].sort()[0]!
  const fetchEnd = [
    input.displayEnd,
    input.monthEnd,
    input.weekEnd,
  ].sort().reverse()[0]!

  for (const raw of members) {
    const m = raw as Record<string, unknown>
    const name = typeof m.name === 'string' ? m.name.trim() : ''
    const contractType = typeof m.contract_type === 'string' ? m.contract_type : null
    if (!name || !isUrenContract(contractType)) continue

    const weekly = weeklyHoursFromContractType(contractType!)
    if (weekly == null) continue

    const supportId = typeof m.support_id === 'string' ? m.support_id.trim() : undefined
    const userIdCandidates = await resolveEitjeAggregationUserCandidates(db, supportId, name, {
      allowFuzzyNameMatch: true,
    })
    const userClause = userMatchClause(userIdCandidates, name)
    if (!userClause) continue

    const { byDay, detailRows } = await fetchWorkedDetail(db, userClause, {
      start: fetchStart,
      end: fetchEnd,
    })

    const display = periodPlusminDelta(input.displayStart, input.displayEnd, weekly, byDay)
    const month = periodPlusminDelta(input.monthStart, input.monthEnd, weekly, byDay)
    const week = periodPlusminDelta(input.weekStart, input.weekEnd, weekly, byDay)

    if (display.worked <= 0 && display.contract <= 0) continue

    const displayLoc = workedSplitForSubrange(
      byDay,
      detailRows,
      input.displayStart,
      input.displayEnd,
    )
    const venues = allocateVenuePlusmin(
      displayLoc.byLocation,
      display.worked,
      display.contract,
    )
    for (const v of venues) {
      if (v.locationId === 'unknown') continue
      const cur = venueAcc.get(v.locationId) ?? { worked: 0, contract: 0, delta: 0 }
      cur.worked = round2(cur.worked + v.worked)
      cur.contract = round2(cur.contract + v.contract)
      cur.delta = round2(cur.delta + v.delta)
      venueAcc.set(v.locationId, cur)
    }

    memberRows.push({
      memberId: String(m._id),
      userName: name,
      teamName: typeof m.team_name === 'string' ? m.team_name.trim() || '—' : '—',
      contractType,
      displayDelta: display.delta,
      monthDelta: month.delta,
      weekDelta: week.delta,
      workedHours: display.worked,
      contractHours: display.contract,
    })
  }

  memberRows.sort((a, b) => Math.abs(b.displayDelta) - Math.abs(a.displayDelta))

  const locationIds = [...venueAcc.keys()]
  const locationNames = await resolveLocationNames(db, locationIds)

  const byVenue: DailyOpsStaffPlusminVenueRow[] = locationIds
    .map((locationId) => {
      const v = venueAcc.get(locationId)!
      const pm = sumPlusMinus([v.delta])
      return {
        locationId,
        locationName: locationNames.get(locationId) ?? locationId,
        worked: v.worked,
        contract: v.contract,
        delta: v.delta,
        plusHours: pm.plusHours,
        minusHours: pm.minusHours,
      }
    })
    .sort((a, b) => b.delta - a.delta)

  const displayTotals = sumPlusMinus(memberRows.map((r) => r.displayDelta))

  return {
    display: {
      startDate: input.displayStart,
      endDate: input.displayEnd,
      label: input.displayLabel,
    },
    month: {
      startDate: input.monthStart,
      endDate: input.monthEnd,
      label: input.monthLabel,
      overThreshold: MONTH_OVER_THRESHOLD,
      underThreshold: MONTH_UNDER_THRESHOLD,
    },
    week: {
      startDate: input.weekStart,
      endDate: input.weekEnd,
      label: input.weekLabel,
      overThreshold: WEEK_OVER_THRESHOLD,
      underThreshold: WEEK_UNDER_THRESHOLD,
    },
    totals: {
      worked: round2(memberRows.reduce((s, r) => s + r.workedHours, 0)),
      contract: round2(memberRows.reduce((s, r) => s + r.contractHours, 0)),
      delta: displayTotals.net,
      plusHours: displayTotals.plusHours,
      minusHours: displayTotals.minusHours,
    },
    byVenue,
    monthKpis: {
      over: memberRows
        .filter((r) => r.monthDelta > MONTH_OVER_THRESHOLD)
        .sort((a, b) => b.monthDelta - a.monthDelta),
      under: memberRows
        .filter((r) => r.monthDelta < MONTH_UNDER_THRESHOLD)
        .sort((a, b) => a.monthDelta - b.monthDelta),
    },
    weekKpis: {
      over: memberRows
        .filter((r) => r.weekDelta > WEEK_OVER_THRESHOLD)
        .sort((a, b) => b.weekDelta - a.weekDelta),
      under: memberRows
        .filter((r) => r.weekDelta < WEEK_UNDER_THRESHOLD)
        .sort((a, b) => a.weekDelta - b.weekDelta),
    },
    members: memberRows,
  }
}
