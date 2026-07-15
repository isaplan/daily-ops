/**
 * @registry-id: weeklyReportDocumentTypes
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Sealed weekly report document schema (one doc per weekKey + locationId)
 * @adr-ref: ADR-004, ADR-013, ADR-015
 *
 * @exports-to:
 * ✓ server/utils/weeklyReportDocument/*
 * ✓ server/api/weekly-reports/*
 * ✓ composables/useWeeklyReportDocument.ts
 * ✓ components/weeklyReports/*
 */

import type { BlockAgree, BlockTodo } from '~/types/noteBlock'
import type { CalendarEvent } from '~/types/calendarEvent'
import type { WeatherRangePayload } from '~/types/weather'
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'

export const WEEKLY_REPORT_SCHEMA_VERSION = 1

export type WeeklyReportSectionKey =
  | 'kpi'
  | 'staff'
  | 'productSales'
  | 'labor'
  | 'revenuePnl'

export const WEEKLY_REPORT_SECTION_KEYS: WeeklyReportSectionKey[] = [
  'kpi',
  'staff',
  'productSales',
  'labor',
  'revenuePnl',
]

export type WeeklyReportSectionContent = {
  text: string
  todos: BlockTodo[]
  agrees: BlockAgree[]
  updatedAt: string | null
}

export type WeeklyReportDocument = {
  weekKey: string
  locationId: string
  locationName: string
  digest: WeeklyDigestDto
  weather: WeatherRangePayload
  /** Previous ISO week weather (Mon–Sun before this report). */
  previousWeekWeather: WeatherRangePayload | null
  events: CalendarEvent[]
  sections: Record<WeeklyReportSectionKey, WeeklyReportSectionContent>
  frozenAt: string | null
  builtAt: string
  schemaVersion: number
}

export type WeeklyReportListItem = {
  weekKey: string
  locationId: string
  locationName: string
  label: string
  startDate: string
  endDate: string
  frozenAt: string | null
  builtAt: string
}

export function emptyWeeklyReportSection(): WeeklyReportSectionContent {
  return { text: '', todos: [], agrees: [], updatedAt: null }
}

export function emptyWeeklyReportSections(): Record<WeeklyReportSectionKey, WeeklyReportSectionContent> {
  return {
    kpi: emptyWeeklyReportSection(),
    staff: emptyWeeklyReportSection(),
    productSales: emptyWeeklyReportSection(),
    labor: emptyWeeklyReportSection(),
    revenuePnl: emptyWeeklyReportSection(),
  }
}
