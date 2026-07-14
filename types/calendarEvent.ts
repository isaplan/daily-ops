/**
 * @registry-id: calendarEventTypes
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
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
  | 'custom'

export type CalendarEvent = {
  id: string
  startDate: string
  endDate: string
  type: CalendarEventType
  title: string
  note?: string
}
