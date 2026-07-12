/**
 * @registry-id: dailyOpsWeeklyReportOpeningClosingOverlap
 * @created: 2026-07-09T15:30:00.000Z
 * @last-modified: 2026-07-09T15:30:00.000Z
 * @description: Shift overlap vs venue open/close windows (pre-open + post-close hours)
 * @last-fix: [2026-07-09] Eitje gewerkte shifts · keuken/bediening/afwas 50-50
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyOpeningClosing.ts
 */

import { isOperationalTeamName } from '../eitjeVenueLaborRollup'
import {
  amsterdamWeekdayMon0,
  venueOpenCloseWindow,
  venueOpeningHoursFor,
  type VenueDayHours,
} from '~/utils/dailyOpsVenueOpeningHours'

export type OpeningClosingShiftInput = {
  locationId: string
  businessDate: string
  teamName: string
  shiftStartMs: number
  shiftEndMs: number
}

export type OpeningClosingTeamTotals = {
  preOpenHours: number
  postCloseHours: number
  outsideHours: number
}

export type OpeningClosingTotals = OpeningClosingTeamTotals & {
  keuken: OpeningClosingTeamTotals
  bediening: OpeningClosingTeamTotals
}

function emptyTeamTotals(): OpeningClosingTeamTotals {
  return { preOpenHours: 0, postCloseHours: 0, outsideHours: 0 }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function addTeam(target: OpeningClosingTeamTotals, pre: number, post: number): void {
  target.preOpenHours = round2(target.preOpenHours + pre)
  target.postCloseHours = round2(target.postCloseHours + post)
  target.outsideHours = round2(target.outsideHours + pre + post)
}

function outsideMsForWindow(
  shiftStartMs: number,
  shiftEndMs: number,
  openMs: number,
  closeMs: number,
): { preOpenMs: number; postCloseMs: number } {
  const preOpenMs = Math.max(0, Math.min(shiftEndMs, openMs) - shiftStartMs)
  const postCloseMs = Math.max(0, shiftEndMs - Math.max(shiftStartMs, closeMs))
  return { preOpenMs, postCloseMs }
}

function outsideHoursForDayHours(
  businessDate: string,
  dayHours: VenueDayHours | null,
  shiftStartMs: number,
  shiftEndMs: number,
): { preOpenHours: number; postCloseHours: number } {
  if (!dayHours) return { preOpenHours: 0, postCloseHours: 0 }
  const window = venueOpenCloseWindow(businessDate, dayHours)
  if (!window) return { preOpenHours: 0, postCloseHours: 0 }
  const { preOpenMs, postCloseMs } = outsideMsForWindow(
    shiftStartMs,
    shiftEndMs,
    window.openMs,
    window.closeMs,
  )
  return {
    preOpenHours: preOpenMs / 3_600_000,
    postCloseHours: postCloseMs / 3_600_000,
  }
}

function accumulateShift(
  totals: OpeningClosingTotals,
  shift: OpeningClosingShiftInput,
): void {
  const venue = venueOpeningHoursFor(shift.locationId)
  if (!venue) return

  const weekday = amsterdamWeekdayMon0(shift.businessDate)
  const serviceDay = venue.service[weekday]
  const kitchenDay = venue.kitchen[weekday]
  const team = (shift.teamName ?? '').trim().toLowerCase()

  if (!isOperationalTeamName(team)) return

  const serviceOutside = outsideHoursForDayHours(
    shift.businessDate,
    serviceDay,
    shift.shiftStartMs,
    shift.shiftEndMs,
  )
  const kitchenOutside = outsideHoursForDayHours(
    shift.businessDate,
    kitchenDay,
    shift.shiftStartMs,
    shift.shiftEndMs,
  )

  if (team === 'keuken') {
    addTeam(totals.keuken, kitchenOutside.preOpenHours, kitchenOutside.postCloseHours)
    addTeam(totals, kitchenOutside.preOpenHours, kitchenOutside.postCloseHours)
    return
  }

  if (team === 'bediening') {
    addTeam(totals.bediening, serviceOutside.preOpenHours, serviceOutside.postCloseHours)
    addTeam(totals, serviceOutside.preOpenHours, serviceOutside.postCloseHours)
    return
  }

  if (team === 'afwas') {
    const halfKitchenPre = kitchenOutside.preOpenHours / 2
    const halfKitchenPost = kitchenOutside.postCloseHours / 2
    const halfServicePre = serviceOutside.preOpenHours / 2
    const halfServicePost = serviceOutside.postCloseHours / 2
    addTeam(totals.keuken, halfKitchenPre, halfKitchenPost)
    addTeam(totals.bediening, halfServicePre, halfServicePost)
    addTeam(
      totals,
      halfKitchenPre + halfServicePre,
      halfKitchenPost + halfServicePost,
    )
  }
}

export function accumulateOpeningClosingShifts(
  shifts: OpeningClosingShiftInput[],
): OpeningClosingTotals {
  const totals: OpeningClosingTotals = {
    ...emptyTeamTotals(),
    keuken: emptyTeamTotals(),
    bediening: emptyTeamTotals(),
  }
  for (const shift of shifts) accumulateShift(totals, shift)
  return totals
}
