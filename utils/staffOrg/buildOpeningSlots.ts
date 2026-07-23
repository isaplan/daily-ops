/**
 * @registry-id: staffOrgOpeningSlots
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T18:15:00.000Z
 * @description: Day/evening slot open hours from venue opening-hours SSOT (shared client/server)
 * @last-fix: [2026-07-22] Move to utils for client metrics recompute
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ utils/staffOrg/buildSlotMetrics.ts
 * ✓ server/api/staff-org/opening-hours.get.ts
 * ✓ pages/staff-org/[id].vue
 */

import type { StaffOrgSlotHours, StaffOrgTeam, StaffOrgWeekday } from '~/types/staff-org'
import {
  DAILY_OPS_VENUE_OPENING_HOURS,
  type VenueDayHours,
  type VenueWeekdayIndex,
} from '~/utils/dailyOpsVenueOpeningHours'

/** Fixed cut between day and evening slots. */
export const STAFF_ORG_SLOT_CUT = '18:00'

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Hours between open and close; close after midnight wraps past 24h. */
export function hoursBetween(open: string, close: string): number {
  let start = timeToMinutes(open)
  let end = timeToMinutes(close)
  if (end <= start) end += 24 * 60
  return Math.max(0, (end - start) / 60)
}

function clipSlot(
  dayHours: VenueDayHours | null,
  slot: 'day' | 'evening',
): { open: string; close: string; openHours: number } | null {
  if (!dayHours) return null
  const openM = timeToMinutes(dayHours.open)
  let closeM = timeToMinutes(dayHours.close)
  if (closeM <= openM) closeM += 24 * 60
  const cutM = timeToMinutes(STAFF_ORG_SLOT_CUT)

  if (slot === 'day') {
    if (openM >= cutM) return null
    const endM = Math.min(closeM, cutM)
    if (endM <= openM) return null
    const close = endM >= 24 * 60
      ? `${String(Math.floor((endM - 24 * 60) / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
      : STAFF_ORG_SLOT_CUT
    return { open: dayHours.open, close, openHours: (endM - openM) / 60 }
  }

  const startM = Math.max(openM, cutM)
  if (startM >= closeM) return null
  const open = startM === cutM ? STAFF_ORG_SLOT_CUT : dayHours.open
  return {
    open,
    close: dayHours.close,
    openHours: (closeM - startM) / 60,
  }
}

export function buildOpeningSlotHours(): StaffOrgSlotHours[] {
  const out: StaffOrgSlotHours[] = []
  const weekdays = [0, 1, 2, 3, 4, 5, 6] as StaffOrgWeekday[]
  const teams: StaffOrgTeam[] = ['bediening', 'keuken', 'bar']
  const slots = ['day', 'evening'] as const

  for (const venue of DAILY_OPS_VENUE_OPENING_HOURS) {
    for (const weekday of weekdays) {
      for (const team of teams) {
        const weekly = team === 'keuken' ? venue.kitchen : venue.service
        const dayHours = weekly[weekday as VenueWeekdayIndex]
        for (const slot of slots) {
          const clipped = clipSlot(dayHours, slot)
          out.push({
            locationId: venue.locationId,
            locationName: venue.locationName,
            weekday,
            team,
            slot,
            openHours: clipped?.openHours ?? null,
            open: clipped?.open ?? null,
            close: clipped?.close ?? null,
          })
        }
      }
    }
  }
  return out
}

export function slotOpenHoursLookup(
  rows: StaffOrgSlotHours[],
): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const r of rows) {
    map.set(`${r.locationId}|${r.team}|${r.weekday}|${r.slot}`, r.openHours)
  }
  return map
}
