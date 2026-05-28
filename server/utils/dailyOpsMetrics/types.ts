/**
 * @registry-id: dailyOpsMetricsTypes
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Shared DTO helper types for Daily Ops metrics builders
 * @adr-ref: ADR-004
 */

import type { DailyOpsRevenueBreakdownDto } from '~/types/daily-ops-dashboard'

export type BorkHourAggregatesBundle = {
  byHourOnly: { _id: number; amount: number }[]
  byDayHour: { _id: { d: string; h: number; loc?: string }; revenue: number }[]
}

export type TodayRevenueExtras = NonNullable<DailyOpsRevenueBreakdownDto['todayRevenueDetail']>

export type DailyOpsLabMapEntry = {
  laborCost: number
  hours: number
  distinctWorkerCount?: number
}

export type DailyOpsLabMap = Map<string, DailyOpsLabMapEntry>
