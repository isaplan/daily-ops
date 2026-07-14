/**
 * @registry-id: dailyOpsCalendarEventsNationalReligious
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: NL national + religious holidays via date-holidays package
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsCalendarEvents/seedCalendarEvents.ts
 */

import Holidays from 'date-holidays'
import type { CalendarEvent, CalendarEventType } from '~/types/calendarEvent'

const RELIGIOUS_KEYWORDS = [
  'ramadan',
  'eid',
  'suikerfeest',
  'offerfeest',
  'pasen',
  'pinksteren',
  'hemelvaart',
  'kerstmis',
  'kerst',
  'oud en nieuw',
  'nieuwjaar',
  'sinterklaas',
  'jom kippur',
  'rosh hashana',
  'chanoeka',
  'hannukah',
  'pascha',
  'suikerfeest',
]

function classifyHoliday(name: string, type: string | undefined): CalendarEventType {
  const lower = name.toLowerCase()
  if (type === 'public' || type === 'bank') return 'national_holiday'
  if (RELIGIOUS_KEYWORDS.some((k) => lower.includes(k))) return 'religious'
  if (type === 'observance') return 'religious'
  return 'national_holiday'
}

function toYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function nationalAndReligiousHolidaysForYear(year: number): CalendarEvent[] {
  const hd = new Holidays('NL')
  hd.setLanguages('nl')
  const rows = hd.getHolidays(year) ?? []
  const out: CalendarEvent[] = []
  for (const row of rows) {
    const start = row.start instanceof Date ? row.start : new Date(row.date)
    const end = row.end instanceof Date ? row.end : start
    const startDate = toYmd(start)
    const endDate = toYmd(end)
    const title = String(row.name ?? 'Feestdag')
    const eventType = classifyHoliday(title, row.type)
    out.push({
      id: `nl-${year}-${startDate}-${eventType}`,
      startDate,
      endDate,
      type: eventType,
      title,
    })
  }
  return out
}

export function nationalAndReligiousHolidaysForRange(startYear: number, endYear: number): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (let y = startYear; y <= endYear; y += 1) {
    out.push(...nationalAndReligiousHolidaysForYear(y))
  }
  return out
}
