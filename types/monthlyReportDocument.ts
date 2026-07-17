/**
 * @registry-id: monthlyReportDocumentTypes
 * @created: 2026-07-17T00:00:00.000Z
 * @last-modified: 2026-07-17T00:00:00.000Z
 * @description: Sealed monthly report document schema (one doc per monthKey + locationId)
 * @adr-ref: ADR-004, ADR-013, ADR-015
 *
 * @exports-to:
 * ✓ server/utils/monthlyReportDocument/*
 * ✓ server/api/monthly-reports/*
 * ✓ composables/useMonthlyReportDocument.ts
 * ✓ components/weeklyReports/*
 */

import type { BlockAgree, BlockTodo } from '~/types/noteBlock'
import type { CalendarEvent } from '~/types/calendarEvent'
import type { WeatherRangePayload } from '~/types/weather'
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'
import type { AccountingPnlBenchmarkTableLineDto } from '~/types/accounting-pnl-benchmark'

export const MONTHLY_REPORT_SCHEMA_VERSION = 1

export type MonthlyReportSectionKey =
  | 'kpi'
  | 'staff'
  | 'productSales'
  | 'labor'
  | 'revenuePnl'

export const MONTHLY_REPORT_SECTION_KEYS: MonthlyReportSectionKey[] = [
  'kpi',
  'staff',
  'productSales',
  'labor',
  'revenuePnl',
]

export type MonthlyReportSectionContent = {
  text: string
  todos: BlockTodo[]
  agrees: BlockAgree[]
  updatedAt: string | null
}

export type MonthlyReportDocument = {
  monthKey: string
  locationId: string
  locationName: string
  /** Reuses WeeklyDigestDto shape (weekKey holds monthKey). */
  digest: WeeklyDigestDto
  /** Real accounting P&L for this venue+month, or null when missing. */
  accountingPnl: AccountingPnlBenchmarkTableLineDto | null
  weather: WeatherRangePayload
  previousMonthWeather: WeatherRangePayload | null
  events: CalendarEvent[]
  sections: Record<MonthlyReportSectionKey, MonthlyReportSectionContent>
  /** When set, computed digest is sealed (UI: Locked). */
  frozenAt: string | null
  /** True when locked via Save; false/undefined = auto-lock. */
  lockedManually?: boolean
  builtAt: string
  schemaVersion: number
}

export type MonthlyReportListItem = {
  monthKey: string
  locationId: string
  locationName: string
  label: string
  startDate: string
  endDate: string
  frozenAt: string | null
  builtAt: string
}

export function emptyMonthlyReportSection(): MonthlyReportSectionContent {
  return { text: '', todos: [], agrees: [], updatedAt: null }
}

export function emptyMonthlyReportSections(): Record<MonthlyReportSectionKey, MonthlyReportSectionContent> {
  return {
    kpi: emptyMonthlyReportSection(),
    staff: emptyMonthlyReportSection(),
    productSales: emptyMonthlyReportSection(),
    labor: emptyMonthlyReportSection(),
    revenuePnl: emptyMonthlyReportSection(),
  }
}
