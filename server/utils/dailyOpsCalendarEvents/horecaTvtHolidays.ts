/**
 * @registry-id: dailyOpsCalendarEventsHorecaTvt
 * @created: 2026-07-15T15:05:00.000Z
 * @last-modified: 2026-07-15T15:05:00.000Z
 * @description: Erkende horeca feestdagen — contract workers get time-for-time (tvt)
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsCalendarEvents/nationalAndReligiousHolidays.ts
 */

import type { CalendarEventLabel } from '~/types/calendarEvent'

/** NL date-holidays titles for the nine recognized horeca public holidays. */
const HORECA_TVT_TITLE_MATCHERS = [
  /^nieuwjaar$/i,
  /^pasen$/i,
  /^tweede paasdag$/i,
  /^koningsdag$/i,
  /^hemelvaartsdag$/i,
  /^pinksteren$/i,
  /^tweede pinksterdag$/i,
  /^kerstmis$/i,
  /^tweede kerstdag$/i,
] as const

export function horecaTvtLabels(title: string): CalendarEventLabel[] | undefined {
  const normalized = title.trim()
  if (HORECA_TVT_TITLE_MATCHERS.some((re) => re.test(normalized))) {
    return ['tvt']
  }
  return undefined
}
