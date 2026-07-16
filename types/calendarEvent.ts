/**
 * @registry-id: calendarEventTypes
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-16T21:50:00.000Z
 * @last-fix: [2026-07-16] Added major_event type for WK/sports sales context
 * @description: Calendar event types for holidays and custom annotations (Den Haag)
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsCalendarEvents/*
 * ✓ server/utils/weeklyReportDocument/*
 * ✓ types/weeklyReportDocument.ts
 */

export type CalendarEventType =
  | 'national_holiday'
  | 'school_holiday_midden'
  | 'religious'
  | 'major_event'
  | 'custom'

/** Contract-worker time-for-time (tijd voor tijd) on recognized horeca public holidays. */
export type CalendarEventLabel = 'tvt'

export type CalendarEvent = {
  id: string
  startDate: string
  endDate: string
  type: CalendarEventType
  title: string
  note?: string
  labels?: CalendarEventLabel[]
}
