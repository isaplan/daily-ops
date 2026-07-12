/**
 * @registry-id: dailyOpsStaffPlusminPeriod
 * @created: 2026-06-25T14:00:00.000Z
 * @last-modified: 2026-07-09T20:30:00.000Z
 * @description: Period plus/min (worked − contract) per member and venue
 * @last-fix: [2026-07-09] memberPlusminForLocation for weekly report venue filter
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsStaff/fetchStaffPlusminSummary.ts
 */

import type { Db } from 'mongodb'
import { weeklyHoursFromContractType } from '~/utils/dailyOpsLeerlingWageFallback'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { isoWeekKey } from '../memberWeeklyHours'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function eachYmdInclusive(start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  while (cur <= end) {
    out.push(cur)
    cur = addCalendarDaysYmd(cur, 1)
  }
  return out
}

/** Worked − contract (ISO-week pro-rata) for a closed period — opening balance 0. */
export function periodPlusminDelta(
  startDate: string,
  endDate: string,
  weeklyContract: number,
  workedByDay: Map<string, number>,
): { worked: number; contract: number; delta: number } {
  if (startDate > endDate) {
    return { worked: 0, contract: 0, delta: 0 }
  }

  let balance = 0
  let worked = 0
  let contract = 0
  const daysInRange = eachYmdInclusive(startDate, endDate)
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

  return { worked: round2(worked), contract: round2(contract), delta: round2(balance) }
}

export type WorkedLocationSplit = {
  byDay: Map<string, number>
  byLocation: Map<string, number>
}

export async function fetchWorkedByDayAndLocation(
  db: Db,
  userClause: Record<string, unknown>,
  range: { start: string; end: string },
): Promise<WorkedLocationSplit> {
  const rows = await db
    .collection('eitje_time_registration_aggregation')
    .find({
      period_type: 'day',
      period: { $gte: range.start, $lte: range.end },
      ...userClause,
    })
    .project({ period: 1, total_hours: 1, locationId: 1 })
    .toArray()

  const byDay = new Map<string, number>()
  const byLocation = new Map<string, number>()

  for (const row of rows) {
    const r = row as Record<string, unknown>
    const period = String(r.period ?? '')
    if (!period) continue
    const hours = Number(r.total_hours ?? 0)
    const loc = String(r.locationId ?? '').trim() || 'unknown'
    byDay.set(period, (byDay.get(period) ?? 0) + hours)
    byLocation.set(loc, (byLocation.get(loc) ?? 0) + hours)
  }

  return { byDay, byLocation }
}

export function workedSplitForSubrange(
  byDay: Map<string, number>,
  detailRows: WorkedDetailRow[],
  start: string,
  end: string,
): WorkedLocationSplit {
  const byLocation = new Map<string, number>()
  const subDay = new Map<string, number>()
  for (const [day, hours] of byDay) {
    if (day < start || day > end) continue
    subDay.set(day, hours)
  }
  for (const row of detailRows) {
    if (row.period < start || row.period > end) continue
    byLocation.set(
      row.locationId,
      (byLocation.get(row.locationId) ?? 0) + row.hours,
    )
  }
  return { byDay: subDay, byLocation }
}

export type WorkedDetailRow = {
  period: string
  locationId: string
  hours: number
  teamName: string
}

export function dominantTeamInRange(
  detailRows: WorkedDetailRow[],
  start: string,
  end: string,
  locationId = 'all',
): string | null {
  const byTeam = new Map<string, number>()
  for (const row of detailRows) {
    if (row.period < start || row.period > end) continue
    if (locationId !== 'all' && row.locationId !== locationId) continue
    const team = row.teamName.trim()
    if (!team) continue
    byTeam.set(team, (byTeam.get(team) ?? 0) + row.hours)
  }
  let bestTeam = ''
  let bestHours = 0
  for (const [team, hours] of byTeam) {
    if (hours > bestHours) {
      bestTeam = team
      bestHours = hours
    }
  }
  return bestTeam || null
}

export function workedLocationIdsInRange(
  detailRows: WorkedDetailRow[],
  start: string,
  end: string,
): string[] {
  const byLocation = new Map<string, number>()
  for (const row of detailRows) {
    if (row.period < start || row.period > end) continue
    if (row.locationId === 'unknown') continue
    byLocation.set(row.locationId, (byLocation.get(row.locationId) ?? 0) + row.hours)
  }
  return [...byLocation.entries()]
    .filter(([, hours]) => hours > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
}

export async function fetchWorkedDetail(
  db: Db,
  userClause: Record<string, unknown>,
  range: { start: string; end: string },
): Promise<{
  byDay: Map<string, number>
  detailRows: WorkedDetailRow[]
}> {
  const rows = await db
    .collection('eitje_time_registration_aggregation')
    .find({
      period_type: 'day',
      period: { $gte: range.start, $lte: range.end },
      ...userClause,
    })
    .project({ period: 1, total_hours: 1, locationId: 1, team_name: 1 })
    .toArray()

  const byDay = new Map<string, number>()
  const detailRows: WorkedDetailRow[] = []

  for (const row of rows) {
    const r = row as Record<string, unknown>
    const period = String(r.period ?? '')
    if (!period) continue
    const hours = Number(r.total_hours ?? 0)
    const locationId = String(r.locationId ?? '').trim() || 'unknown'
    const teamName = String(r.team_name ?? '').trim()
    byDay.set(period, (byDay.get(period) ?? 0) + hours)
    detailRows.push({ period, locationId, hours, teamName })
  }

  return { byDay, detailRows }
}

export function allocateVenuePlusmin(
  byLocation: Map<string, number>,
  totalWorked: number,
  totalContract: number,
): Array<{ locationId: string; worked: number; contract: number; delta: number }> {
  const out: Array<{ locationId: string; worked: number; contract: number; delta: number }> = []
  for (const [locationId, worked] of byLocation) {
    const w = round2(worked)
    const share = totalWorked > 0 ? w / totalWorked : 0
    const contract = round2(totalContract * share)
    out.push({
      locationId,
      worked: w,
      contract,
      delta: round2(w - contract),
    })
  }
  return out.sort((a, b) => b.delta - a.delta)
}

/** Week (or any subrange) plus/min — all venues, or one venue via proportional contract split. */
export function memberPlusminForLocation(
  startDate: string,
  endDate: string,
  weeklyContract: number,
  byDay: Map<string, number>,
  detailRows: WorkedDetailRow[],
  locationId: string,
): { worked: number; contract: number; delta: number } | null {
  const period = periodPlusminDelta(startDate, endDate, weeklyContract, byDay)
  if (period.worked <= 0 && period.contract <= 0) return null

  if (locationId === 'all') return period

  const split = workedSplitForSubrange(byDay, detailRows, startDate, endDate)
  const venues = allocateVenuePlusmin(split.byLocation, period.worked, period.contract)
  const hit = venues.find((v) => v.locationId === locationId)
  if (!hit || hit.worked <= 0) return null
  return hit
}

export function sumPlusMinus(deltas: number[]): { plusHours: number; minusHours: number; net: number } {
  let plusHours = 0
  let minusHours = 0
  for (const d of deltas) {
    if (d > 0) plusHours += d
    else if (d < 0) minusHours += d
  }
  return {
    plusHours: round2(plusHours),
    minusHours: round2(minusHours),
    net: round2(plusHours + minusHours),
  }
}

export function isUrenContract(contractType: string | null): boolean {
  return /uren contract/i.test(String(contractType ?? ''))
}
