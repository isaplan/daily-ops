/**
 * @registry-id: dailyOpsVenueOpeningHours
 * @created: 2026-07-09T15:30:00.000Z
 * @last-modified: 2026-07-09T15:30:00.000Z
 * @description: SSOT — venue service + kitchen opening hours (Amsterdam local time)
 * @last-fix: [2026-07-09] Initial VKB / Bea / L'Amour schedules for weekly open-close KPI
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyOpeningClosing.ts
 * ✓ server/utils/dailyOpsWeeklyReport/openingClosingOverlap.ts
 */

import { AMSTERDAM_TZ, addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'

/** Monday = 0 … Sunday = 6 (Amsterdam calendar weekday of business_date). */
export type VenueWeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type VenueDayHours = {
  open: string
  close: string
}

export type VenueWeeklyHours = Record<VenueWeekdayIndex, VenueDayHours | null>

export type VenueOpeningHoursConfig = {
  locationId: string
  locationName: string
  /** Bediening / guest-facing hours. */
  service: VenueWeeklyHours
  /** Keuken hours (may differ from service). */
  kitchen: VenueWeeklyHours
}

const closed = (): null => null

const h = (open: string, close: string): VenueDayHours => ({ open, close })

const VKB: VenueWeeklyHours = {
  0: h('14:30', '23:00'),
  1: h('12:00', '23:00'),
  2: h('12:00', '23:00'),
  3: h('12:00', '00:30'),
  4: h('12:00', '01:00'),
  5: h('12:00', '01:00'),
  6: h('12:00', '22:00'),
}

const VKB_KITCHEN: VenueWeeklyHours = {
  0: h('14:30', '22:00'),
  1: h('12:00', '22:00'),
  2: h('12:00', '22:00'),
  3: h('12:00', '22:00'),
  4: h('12:00', '22:00'),
  5: h('12:00', '22:00'),
  6: h('12:00', '22:00'),
}

const BEA_SERVICE: VenueWeeklyHours = {
  0: closed(),
  1: h('15:00', '23:00'),
  2: h('15:00', '00:30'),
  3: h('15:00', '00:30'),
  4: h('15:00', '02:00'),
  5: h('12:00', '02:00'),
  6: h('12:00', '22:00'),
}

const BEA_KITCHEN: VenueWeeklyHours = {
  0: closed(),
  1: h('15:00', '20:30'),
  2: h('15:00', '20:30'),
  3: h('15:00', '20:30'),
  4: h('15:00', '22:00'),
  5: h('12:00', '22:00'),
  6: h('12:00', '20:00'),
}

const LAT_SERVICE: VenueWeeklyHours = {
  0: closed(),
  1: h('15:30', '23:30'),
  2: h('15:30', '23:30'),
  3: h('15:30', '00:30'),
  4: h('15:30', '00:30'),
  5: h('12:00', '00:30'),
  6: h('12:00', '23:00'),
}

const LAT_KITCHEN: VenueWeeklyHours = {
  0: closed(),
  1: closed(),
  2: h('15:30', '22:00'),
  3: h('15:30', '22:00'),
  4: h('15:30', '22:00'),
  5: h('12:00', '22:00'),
  6: h('12:00', '22:00'),
}

export const DAILY_OPS_VENUE_OPENING_HOURS: VenueOpeningHoursConfig[] = [
  {
    locationId: '69d6cfa63d2adf93b79d1ae7',
    locationName: 'Van Kinsbergen',
    service: VKB,
    kitchen: VKB_KITCHEN,
  },
  {
    locationId: '69d6cfa63d2adf93b79d1ae6',
    locationName: 'Bar Bea',
    service: BEA_SERVICE,
    kitchen: BEA_KITCHEN,
  },
  {
    locationId: '69d6cfa73d2adf93b79d1ae8',
    locationName: "l'Amour Toujours",
    service: LAT_SERVICE,
    kitchen: LAT_KITCHEN,
  },
]

const HOURS_BY_LOCATION = new Map(DAILY_OPS_VENUE_OPENING_HOURS.map((v) => [v.locationId, v]))

export function venueOpeningHoursFor(locationId: string): VenueOpeningHoursConfig | undefined {
  return HOURS_BY_LOCATION.get(locationId)
}

export function amsterdamWeekdayMon0(businessDate: string): VenueWeekdayIndex {
  const probe = parseAmsterdamTimeOnDate(businessDate, '12:00')
  if (!probe) return 0
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: AMSTERDAM_TZ,
    weekday: 'short',
  }).format(probe)
  const map: Record<string, VenueWeekdayIndex> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }
  return map[short] ?? 0
}

/** Parse HH:MM on a business_date in Europe/Amsterdam. */
export function parseAmsterdamTimeOnDate(businessDate: string, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  const baseMs = Date.parse(`${businessDate}T00:00:00.000Z`)
  for (let offsetH = -4; offsetH <= 28; offsetH += 1) {
    const probe = new Date(baseMs + offsetH * 3600000)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: AMSTERDAM_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(probe)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
    const ymd = `${get('year')}-${get('month')}-${get('day')}`
    if (ymd === businessDate && Number(get('hour')) === hour && Number(get('minute')) === minute) {
      return probe
    }
  }
  return null
}

export type VenueOpenCloseWindow = {
  openMs: number
  closeMs: number
}

export function venueOpenCloseWindow(
  businessDate: string,
  dayHours: VenueDayHours,
): VenueOpenCloseWindow | null {
  const openAt = parseAmsterdamTimeOnDate(businessDate, dayHours.open)
  if (!openAt) return null
  const openMins = timeToMinutes(dayHours.open)
  const closeMins = timeToMinutes(dayHours.close)
  const closeDate = closeMins <= openMins ? addCalendarDaysYmd(businessDate, 1) : businessDate
  const closeAt = parseAmsterdamTimeOnDate(closeDate, dayHours.close)
  if (!closeAt) return null
  return { openMs: openAt.getTime(), closeMs: closeAt.getTime() }
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
