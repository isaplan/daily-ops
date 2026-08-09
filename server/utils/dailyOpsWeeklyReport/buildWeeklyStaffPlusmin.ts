/**
 * @registry-id: dailyOpsWeeklyReportBuildStaffPlusmin
 * @created: 2026-07-09T12:00:00.000Z
 * @last-modified: 2026-08-09T17:55:00.000Z
 * @description: Weekly staff plus/min — RETIRED from GET (Eitje); period-cache gap zeros
 * @last-fix: [2026-08-09] Not called from weekly/monthly digest GET (ZERO-GET)
 * @adr-ref: PERIOD_CACHE_ADR L2, ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ (unused on GET — keep until sealed onto period nodes)
 */

import type { Db } from 'mongodb'
import type { WeeklyStaffPlusminRow, WeeklyStaffPlusminSummary } from '~/types/daily-ops-weekly-report'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'
import { weeklyHoursFromContractType } from '~/utils/dailyOpsLeerlingWageFallback'
import { resolveEitjeAggregationUserCandidates } from '../memberEitjeContext'
import {
  dominantTeamInRange,
  fetchWorkedDetail,
  isUrenContract,
  memberPlusminForLocation,
  sumPlusMinus,
  workedLocationIdsInRange,
} from '../dailyOpsStaff/computeStaffPlusminPeriod'

const WEEK_OVER_THRESHOLD = 8
const WEEK_UNDER_THRESHOLD = -8

const VENUE_SHORT = new Map(
  DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => [v.locationId, v.short]),
)
const VENUE_LABEL = new Map(
  DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => [v.locationId, v.label]),
)

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

function formatLocationLabel(locationIds: string[]): string {
  return locationIds
    .map((id) => VENUE_SHORT.get(id) ?? VENUE_LABEL.get(id) ?? id)
    .join(', ')
}

function resolveTeamName(
  memberTeam: string | undefined,
  detailRows: Parameters<typeof dominantTeamInRange>[0],
  startDate: string,
  endDate: string,
  locationId: string,
): string {
  const fromMember = memberTeam?.trim()
  if (fromMember) return fromMember
  return dominantTeamInRange(detailRows, startDate, endDate, locationId) ?? '—'
}

export async function buildWeeklyStaffPlusmin(
  db: Db,
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<WeeklyStaffPlusminSummary> {
  const members = await db
    .collection('members')
    .find({ is_active: { $ne: false }, contract_type: /uren contract/i })
    .project({ _id: 1, name: 1, support_id: 1, contract_type: 1, team_name: 1 })
    .toArray()

  const memberRows: WeeklyStaffPlusminRow[] = []

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
      start: startDate,
      end: endDate,
    })

    const week = memberPlusminForLocation(
      startDate,
      endDate,
      weekly,
      byDay,
      detailRows,
      locationId,
    )
    if (!week) continue

    const memberTeam = typeof m.team_name === 'string' ? m.team_name : undefined
    const locationIds = workedLocationIdsInRange(detailRows, startDate, endDate)

    memberRows.push({
      memberId: String(m._id),
      userName: name,
      teamName: resolveTeamName(memberTeam, detailRows, startDate, endDate, locationId),
      locationLabel: locationId === 'all' ? formatLocationLabel(locationIds) : '',
      workedHours: week.worked,
      contractHours: week.contract,
      weekDelta: week.delta,
    })
  }

  memberRows.sort((a, b) => Math.abs(b.weekDelta) - Math.abs(a.weekDelta))
  const totals = sumPlusMinus(memberRows.map((r) => r.weekDelta))

  return {
    plusHours: totals.plusHours,
    minusHours: totals.minusHours,
    netDelta: totals.net,
    overThreshold: WEEK_OVER_THRESHOLD,
    underThreshold: WEEK_UNDER_THRESHOLD,
    over: memberRows
      .filter((r) => r.weekDelta > WEEK_OVER_THRESHOLD)
      .sort((a, b) => b.weekDelta - a.weekDelta),
    under: memberRows
      .filter((r) => r.weekDelta < WEEK_UNDER_THRESHOLD)
      .sort((a, b) => a.weekDelta - b.weekDelta),
    members: memberRows,
  }
}
