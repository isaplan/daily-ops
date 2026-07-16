/**
 * @registry-id: dailyOpsCalendarEventsSeed
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-16T21:50:00.000Z
 * @last-fix: [2026-07-16] Include WK 2026 Netherlands major_event fixtures
 * @description: Seed holidays + major sports events into calendar_events
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ scripts/seed-calendar-events.ts
 */

import type { Db } from 'mongodb'
import type { CalendarEvent } from '~/types/calendarEvent'
import {
  CALENDAR_EVENTS_COLLECTION,
  CALENDAR_EVENTS_SEED_END_YEAR,
  CALENDAR_EVENTS_SEED_START_YEAR,
} from './constants'
import { nationalAndReligiousHolidaysForRange } from './nationalAndReligiousHolidays'
import { schoolHolidaysMidden } from './schoolHolidaysMidden'
import { wk2026NetherlandsMatches } from './wk2026Netherlands'

export async function ensureCalendarEventsIndex(db: Db): Promise<void> {
  await db.collection(CALENDAR_EVENTS_COLLECTION).createIndex({ id: 1 }, { unique: true, name: 'id_unique' })
  await db.collection(CALENDAR_EVENTS_COLLECTION).createIndex({ startDate: 1, endDate: 1 }, { name: 'date_range' })
}

export async function seedCalendarEvents(
  db: Db,
  opts?: { startYear?: number; endYear?: number },
): Promise<{ written: number }> {
  await ensureCalendarEventsIndex(db)
  const startYear = opts?.startYear ?? CALENDAR_EVENTS_SEED_START_YEAR
  const endYear = opts?.endYear ?? CALENDAR_EVENTS_SEED_END_YEAR

  const events: CalendarEvent[] = [
    ...nationalAndReligiousHolidaysForRange(startYear, endYear),
    ...schoolHolidaysMidden(),
    ...wk2026NetherlandsMatches(),
  ]

  const coll = db.collection(CALENDAR_EVENTS_COLLECTION)
  const ops = events.map((event) => ({
    updateOne: {
      filter: { id: event.id },
      update: { $set: { ...event, seededAt: new Date().toISOString() } },
      upsert: true,
    },
  }))
  const result = await coll.bulkWrite(ops, { ordered: false })
  return { written: result.upsertedCount + result.modifiedCount }
}
