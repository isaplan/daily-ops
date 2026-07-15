/**
 * @registry-id: dailyOpsCalendarEventsGetRange
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-15T15:05:00.000Z
 * @last-fix: [2026-07-15] Map calendar event labels (e.g. tvt)
 * @description: Query calendar events overlapping a date range
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/weeklyReportDocument/buildWeeklyReportDocument.ts
 * ✓ server/api/weekly-reports/[weekKey]/events.post.ts
 */

import type { Db } from 'mongodb'
import type { CalendarEvent, CalendarEventLabel, CalendarEventType } from '~/types/calendarEvent'
import { CALENDAR_EVENTS_COLLECTION } from './constants'

function mapLabels(raw: unknown): CalendarEventLabel[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const labels = raw.filter((value): value is CalendarEventLabel => value === 'tvt')
  return labels.length ? labels : undefined
}

function mapDoc(doc: Record<string, unknown>): CalendarEvent {
  return {
    id: String(doc.id),
    startDate: String(doc.startDate),
    endDate: String(doc.endDate),
    type: doc.type as CalendarEventType,
    title: String(doc.title),
    note: doc.note != null ? String(doc.note) : undefined,
    labels: mapLabels(doc.labels),
  }
}

export async function getEventsForRange(db: Db, startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const docs = await db
    .collection(CALENDAR_EVENTS_COLLECTION)
    .find({
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    })
    .sort({ startDate: 1 })
    .toArray()
  return docs.map((d) => mapDoc(d as Record<string, unknown>))
}

export async function insertCustomCalendarEvent(
  db: Db,
  event: Omit<CalendarEvent, 'id'> & { id?: string },
): Promise<CalendarEvent> {
  const id = event.id ?? `custom-${event.startDate}-${Date.now()}`
  const row: CalendarEvent = { ...event, id, type: 'custom' }
  await db.collection(CALENDAR_EVENTS_COLLECTION).updateOne(
    { id },
    { $set: { ...row, updatedAt: new Date().toISOString() } },
    { upsert: true },
  )
  return row
}
