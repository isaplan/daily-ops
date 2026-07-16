/**
 * @registry-id: dailyOpsCalendarEventsWk2026Netherlands
 * @created: 2026-07-16T21:50:00.000Z
 * @last-modified: 2026-07-16T21:50:00.000Z
 * @description: Netherlands (Oranje) played matches at FIFA World Cup 2026 — Amsterdam kickoff times
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsCalendarEvents/seedCalendarEvents.ts
 */

import type { CalendarEvent } from '~/types/calendarEvent'

/** Oranje fixtures only (Group F + Round of 32). Kickoff = Europe/Amsterdam (CEST). */
const WK_2026_NETHERLANDS: Array<{
  id: string
  startDate: string
  title: string
  note: string
}> = [
  {
    id: 'wk2026-ned-japan',
    startDate: '2026-06-14',
    title: 'WK 2026: Nederland – Japan',
    note: 'Groep F · AT&T Stadium, Dallas · aftrap 22:00 Amsterdam · 2–2',
  },
  {
    id: 'wk2026-ned-sweden',
    startDate: '2026-06-20',
    title: 'WK 2026: Nederland – Zweden',
    note: 'Groep F · NRG Stadium, Houston · aftrap 19:00 Amsterdam · 5–1',
  },
  {
    id: 'wk2026-ned-tunisia',
    startDate: '2026-06-26',
    title: 'WK 2026: Tunesië – Nederland',
    note: 'Groep F · Arrowhead Stadium, Kansas City · aftrap 01:00 Amsterdam · 1–3',
  },
  {
    id: 'wk2026-ned-morocco',
    startDate: '2026-06-30',
    title: 'WK 2026: Nederland – Marokko',
    note: '1/16 finale · Estadio BBVA, Monterrey · aftrap 03:00 Amsterdam · 1–1 (2–3 pens)',
  },
]

export function wk2026NetherlandsMatches(): CalendarEvent[] {
  return WK_2026_NETHERLANDS.map((row) => ({
    id: row.id,
    startDate: row.startDate,
    endDate: row.startDate,
    type: 'major_event' as const,
    title: row.title,
    note: row.note,
  }))
}
