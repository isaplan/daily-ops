import type { PeriodBreakdownGranularity, PeriodBreakdownRowDto } from '~/types/daily-ops-dashboard'
import {
  amsterdamWeekdayMon0,
  venueOpeningHoursFor,
} from '~/utils/dailyOpsVenueOpeningHours'
import { weekdayShortForYmd } from '~/utils/inbox/importTableQuickDates'

const MONTH_SHORT_EN = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const

/** ISO week key `YYYY-Wnn` for a calendar date. */
export function getIsoWeekFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  const thursday = new Date(date)
  thursday.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7))
  const year = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekNo = Math.ceil(((thursday.getTime() - jan4.getTime()) / 86400000 + jan4.getUTCDay() + 1) / 7)
  return `${year}-W${String(weekNo).padStart(2, '0')}`
}

/** Monday (UTC) of an ISO week key `YYYY-Wnn`. */
export function isoWeekMondayYmd(weekKey: string): string | null {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const monW1 = new Date(jan4)
  monW1.setUTCDate(jan4.getUTCDate() - dow + 1)
  const monday = new Date(monW1)
  monday.setUTCDate(monW1.getUTCDate() + (week - 1) * 7)
  const y = monday.getUTCFullYear()
  const mo = monday.getUTCMonth() + 1
  const d = monday.getUTCDate()
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Chart label for ISO week buckets — e.g. `2026-W26` → `jul-wk26`. */
export function formatIsoWeekBucketLabel(weekKey: string): string {
  const weekMatch = weekKey.match(/W(\d{2})$/)
  const wk = weekMatch ? String(Number(weekMatch[1])) : weekKey.replace(/.*W/i, '')
  const mon = isoWeekMondayYmd(weekKey)
  if (!mon) return weekKey.replace(/^\d{4}-/, '')
  const monthIdx = Number(mon.slice(5, 7)) - 1
  const monShort = MONTH_SHORT_EN[monthIdx] ?? mon.slice(5, 7)
  return `${monShort}-wk${wk}`
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Calendar hours (0–23) when venue service is open on business_date. */
export function venueServiceCalendarHoursForDate(
  locationId: string,
  businessDate: string,
): Set<number> {
  const venue = venueOpeningHoursFor(locationId)
  if (!venue) return new Set()

  const wd = amsterdamWeekdayMon0(businessDate)
  const dayHours = venue.service[wd]
  if (!dayHours) return new Set()

  const openMins = timeToMinutes(dayHours.open)
  const closeMins = timeToMinutes(dayHours.close)
  const hours = new Set<number>()

  const openHour = Math.floor(openMins / 60)

  if (closeMins > openMins) {
    const lastHour = closeMins % 60 === 0
      ? Math.floor(closeMins / 60) - 1
      : Math.floor(closeMins / 60)
    for (let h = openHour; h <= Math.min(23, lastHour); h += 1) {
      hours.add(h)
    }
    return hours
  }

  for (let h = openHour; h <= 23; h += 1) hours.add(h)
  return hours
}

export function unionVenueServiceHours(
  locationIds: string[],
  businessDate: string,
): Set<number> {
  const out = new Set<number>()
  for (const id of locationIds) {
    for (const h of venueServiceCalendarHoursForDate(id, businessDate)) {
      out.add(h)
    }
  }
  return out
}

export function filterHourRowsForVenues(
  rows: PeriodBreakdownRowDto[],
  locationIds: string[],
  businessDate: string,
): PeriodBreakdownRowDto[] {
  const allowed = unionVenueServiceHours(locationIds, businessDate)
  if (allowed.size === 0) {
    return rows.filter((r) => {
      const h = Number(r.bucketKey)
      return Number.isFinite(h) && (r.revenue > 0 || r.laborCost > 0 || r.profit !== 0 || r.staffCount > 0)
    })
  }
  return rows.filter((r) => {
    const h = Number(r.bucketKey)
    if (!Number.isFinite(h) || !allowed.has(h)) return false
    return r.revenue > 0 || r.laborCost > 0 || r.profit !== 0 || r.staffCount > 0
  })
}

export function formatPeriodBreakdownBucketLabel(
  bucketKey: string,
  granularity: PeriodBreakdownGranularity,
  bucketLabel?: string,
): string {
  if (granularity === 'hour') {
    const h = Number(bucketKey)
    if (Number.isFinite(h)) return `${String(h).padStart(2, '0')}:00`
    return bucketLabel ?? bucketKey
  }

  if (granularity === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(bucketKey)) {
    const [y, m, d] = bucketKey.split('-')
    const wd = weekdayShortForYmd(bucketKey)
    return `${wd} ${d}/${m}/${y.slice(2)}`
  }

  if (granularity === 'week' && bucketKey.includes('W')) {
    return formatIsoWeekBucketLabel(bucketKey)
  }

  if (granularity === 'month' && /^\d{4}-\d{2}$/.test(bucketKey)) {
    return bucketLabel ?? bucketKey
  }

  return bucketLabel ?? bucketKey
}

export function formatPeriodBreakdownMoney(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1000) {
    const k = Math.round((value / 1000) * 10) / 10
    const sign = value < 0 ? '-' : ''
    return `${sign}€${Math.abs(k).toFixed(1)}k`
  }
  return `€${Math.round(value)}`
}

export function formatPeriodBreakdownEurPerHour(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `€${Math.round(value)}`
}
