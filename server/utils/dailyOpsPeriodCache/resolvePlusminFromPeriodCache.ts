/**
 * @registry-id: dailyOpsPeriodCacheResolvePlusmin
 * @created: 2026-08-09T01:00:00.000Z
 * @last-modified: 2026-08-09T01:00:00.000Z
 * @description: Staff plus/min summary from period-cache day nodes + members contracts
 * @last-fix: [2026-08-09] PERIOD_CACHE_ADR L2 — no live Eitje aggregation on GET
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 *
 * @exports-to:
 * ✓ server/api/daily-ops/staff/plusmin-summary.get.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsStaffPlusminMemberRow,
  DailyOpsStaffPlusminSummaryDto,
  DailyOpsStaffPlusminVenueRow,
} from '~/types/daily-ops-staff'
import { weeklyHoursFromContractType } from '~/utils/dailyOpsLeerlingWageFallback'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { isUrenContract, periodPlusminDelta, sumPlusMinus } from '../dailyOpsStaff/computeStaffPlusminPeriod'
import type { StaffPlusminSummaryInput } from '../dailyOpsStaff/fetchStaffPlusminSummary'
import { loadPeriodDayNodesForRange } from './loadPeriodDayNodesForRange'

const MONTH_OVER_THRESHOLD = 20
const MONTH_UNDER_THRESHOLD = -20
const WEEK_OVER_THRESHOLD = 8
const WEEK_UNDER_THRESHOLD = -8

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

type WorkAcc = {
  byDay: Map<string, number>
  /** Hours in display range by locationId */
  displayByLoc: Map<string, number>
  team: string
}

/** Plus/min from period-cache workers + members uren-contract. */
export async function resolvePlusminFromPeriodCache (
  db: Db,
  input: StaffPlusminSummaryInput,
): Promise<DailyOpsStaffPlusminSummaryDto> {
  const fetchStart = [input.displayStart, input.monthStart, input.weekStart].sort()[0]!
  const fetchEnd = [input.displayEnd, input.monthEnd, input.weekEnd].sort().reverse()[0]!

  const workByUser = new Map<string, WorkAcc>()
  for (const venue of VENUE_STRIP_LOCATIONS) {
    const nodes = await loadPeriodDayNodesForRange(db, {
      startDate: fetchStart,
      endDate: fetchEnd,
      locationId: venue.locationId,
    })
    for (const n of nodes) {
      for (const w of n.staff.workers ?? []) {
        if (!w.memberId || w.hours <= 0 || w.sick || w.leave) continue
        let acc = workByUser.get(w.memberId)
        if (!acc) {
          acc = { byDay: new Map(), displayByLoc: new Map(), team: w.team || '—' }
          workByUser.set(w.memberId, acc)
        }
        acc.byDay.set(n.periodKey, round2((acc.byDay.get(n.periodKey) ?? 0) + w.hours))
        if (n.periodKey >= input.displayStart && n.periodKey <= input.displayEnd) {
          acc.displayByLoc.set(
            venue.locationId,
            round2((acc.displayByLoc.get(venue.locationId) ?? 0) + w.hours),
          )
        }
        if (w.team) acc.team = w.team
      }
    }
  }

  const members = await db
    .collection('members')
    .find({ is_active: { $ne: false }, contract_type: /uren contract/i })
    .project({ _id: 1, name: 1, support_id: 1, contract_type: 1, team_name: 1, eitje_id: 1, eitje_ids: 1 })
    .toArray()

  const memberRows: DailyOpsStaffPlusminMemberRow[] = []
  const venueAcc = new Map<string, { worked: number; contract: number; delta: number }>()

  for (const raw of members) {
    const m = raw as Record<string, unknown>
    const name = typeof m.name === 'string' ? m.name.trim() : ''
    const contractType = typeof m.contract_type === 'string' ? m.contract_type : null
    if (!name || !isUrenContract(contractType)) continue
    const weekly = weeklyHoursFromContractType(contractType!)
    if (weekly == null) continue

    const eitjeIds = [
      ...(m.eitje_id != null && m.eitje_id !== '' ? [String(m.eitje_id)] : []),
      ...(Array.isArray(m.eitje_ids) ? m.eitje_ids.map(String) : []),
      ...(typeof m.support_id === 'string' && m.support_id ? [m.support_id] : []),
    ]

    let work: WorkAcc | undefined
    for (const id of eitjeIds) {
      work = workByUser.get(id)
      if (work) break
    }
    if (!work) continue

    const display = periodPlusminDelta(input.displayStart, input.displayEnd, weekly, work.byDay)
    const month = periodPlusminDelta(input.monthStart, input.monthEnd, weekly, work.byDay)
    const week = periodPlusminDelta(input.weekStart, input.weekEnd, weekly, work.byDay)
    if (display.worked <= 0 && display.contract <= 0) continue

    const totalDisplayLoc = [...work.displayByLoc.values()].reduce((a, b) => a + b, 0)
    for (const [locationId, locHours] of work.displayByLoc) {
      const locShare = totalDisplayLoc > 0 ? locHours / totalDisplayLoc : 0
      const worked = round2(display.worked * locShare)
      const contract = round2(display.contract * locShare)
      const delta = round2(worked - contract)
      const cur = venueAcc.get(locationId) ?? { worked: 0, contract: 0, delta: 0 }
      cur.worked = round2(cur.worked + worked)
      cur.contract = round2(cur.contract + contract)
      cur.delta = round2(cur.delta + delta)
      venueAcc.set(locationId, cur)
    }

    memberRows.push({
      memberId: String(m._id),
      userName: name,
      teamName: typeof m.team_name === 'string' ? m.team_name.trim() || work.team : work.team,
      contractType,
      displayDelta: display.delta,
      monthDelta: month.delta,
      weekDelta: week.delta,
      workedHours: display.worked,
      contractHours: display.contract,
    })
  }

  memberRows.sort((a, b) => Math.abs(b.displayDelta) - Math.abs(a.displayDelta))
  const displayTotals = sumPlusMinus(memberRows.map((r) => r.displayDelta))

  const byVenue: DailyOpsStaffPlusminVenueRow[] = [...venueAcc.entries()]
    .map(([locationId, v]) => {
      const pm = sumPlusMinus([v.delta])
      const name = VENUE_STRIP_LOCATIONS.find((x) => x.locationId === locationId)?.locationName ?? locationId
      return {
        locationId,
        locationName: name,
        worked: v.worked,
        contract: v.contract,
        delta: v.delta,
        plusHours: pm.plusHours,
        minusHours: pm.minusHours,
      }
    })
    .sort((a, b) => b.delta - a.delta)

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
