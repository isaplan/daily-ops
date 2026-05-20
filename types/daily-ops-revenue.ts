/**
 * @registry-id: dailyOpsRevenueTypes
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Daily Ops Revenue dashboard — periods, DTOs, compare kinds
 * @last-fix: [2026-05-20] Initial revenue overhaul types
 *
 * @exports-to:
 * ✓ utils/dailyOpsRevenuePeriod.ts
 * ✓ server/utils/dailyOpsRevenue/*
 * ✓ server/api/daily-ops/revenue/*
 * ✓ composables/useDailyOpsRevenue*
 * ✓ components/daily-ops/revenue/*
 */

export const DAILY_OPS_REVENUE_PERIOD_IDS = [
  'today',
  'yesterday',
  'd2',
  'd3',
  'd4',
  'd5',
  'd6',
  'd7',
  'this-week',
  'last-week',
  'wtd',
  'last-7d',
  'this-month',
  'last-month',
  'mtd',
  'last-30d',
  'q1',
  'q2',
  'q3',
  'q4',
  'last-q',
  'qtd',
  'lente',
  'zomer',
  'herfst',
  'winter',
  'this-year',
  'last-year',
  'ytd',
  'last-365d',
  'last-14d',
  'last-60d',
  'last-90d',
  'custom',
] as const

export type DailyOpsRevenuePeriodId = (typeof DAILY_OPS_REVENUE_PERIOD_IDS)[number]

export type DailyOpsRevenueCompareKind = 'none' | 'previous' | 'ly' | 'custom'

export type DailyOpsRevenueRange = {
  period: DailyOpsRevenuePeriodId
  startDate: string
  endDate: string
  label: string
}

export type DailyOpsRevenueQueryContext = {
  period: DailyOpsRevenuePeriodId
  startDate: string
  endDate: string
  label: string
  locationId?: string
  locationSpace?: string
  compareKind: DailyOpsRevenueCompareKind
  compareStartDate?: string
  compareEndDate?: string
  compareLabel?: string
}

export type DailyOpsSimplePnLAssumptions = {
  foodCogsPct: number
  bevCogsPct: number
  overheadPct: number
}

export type DailyOpsSimplePnLDto = {
  revenue: number
  foodRevenue: number
  beverageRevenue: number
  foodCogs: number
  bevCogs: number
  laborCost: number
  laborCoverage: { daysFound: number; daysExpected: number; pctComplete: number }
  overhead: number
  result: number
  assumptions: DailyOpsSimplePnLAssumptions
  compare?: {
    revenue: number
    result: number
    label: string
  }
}

export type DailyOpsRevenueKpiDto = {
  revenue: number
  itemsCount: number
  revenuePerItem: number
  leadSource: 'inbox_basis' | 'bork_api' | 'unknown'
  currentLabel: string
  compareDelta?: { amount: number; pct: number | null }
  compareLabel?: string
}

export type DailyOpsRevenueLocationDto = {
  locationId: string
  locationName: string
  revenue: number
  itemsCount: number
  revenuePerItem: number
  pctOfTotal: number
  compareRevenue?: number
  comparePct?: number | null
}

export type DailyOpsRevenueTimeseriesPoint = {
  date: string
  revenue: number
  itemsCount: number
}

export type DailyOpsRevenueTimeseriesDto = {
  granularity: 'day' | 'week' | 'month' | 'quarter'
  current: DailyOpsRevenueTimeseriesPoint[]
  compare?: DailyOpsRevenueTimeseriesPoint[]
  compareLabel?: string
}

export type DailyOpsRollingMediansWindow = {
  label: string
  median: number
  mean: number
  p25: number
  p75: number
}

export type DailyOpsRevenueRollingMediansDto = {
  windows: DailyOpsRollingMediansWindow[]
}

export type DailyOpsWeekdayPatternRow = {
  date: string
  dayOfWeek: string
  revenue: number
  itemsCount: number
  compareRevenue?: number
  comparePct?: number | null
}

export type DailyOpsHourlyMatrixCell = {
  revenue: number
  itemsCount: number
  foodRevenue: number
  drinksRevenue: number
}

export type DailyOpsHourlyMatrixRow = {
  hour: number
  weekdays: DailyOpsHourlyMatrixCell[]
}

export type DailyOpsRevenueHourlyMatrixDto = {
  rows: DailyOpsHourlyMatrixRow[]
}

export type DailyOpsRevenueCategoryDto = {
  name: string
  revenue: number
  itemsCount: number
  pctOfTotal: number
}

export type DailyOpsRevenueProductRow = {
  productName: string
  revenue: number
  itemsCount: number
  revenuePerItem: number
}

export type DailyOpsRevenueStaffRow = {
  staffName: string
  revenue: number
  orderCount: number
  avgProductsPerOrder: number
}

export type DailyOpsRevenueTableRow = {
  tableNum: string
  locationSpace: string
  revenue: number
  itemsCount: number
}

export type DailyOpsOrderPaymentRhythmPoint = {
  hour: number
  orderCount: number
  paymentCount: number
  orderCountCompare?: number
  paymentCountCompare?: number
}

export type DailyOpsCoOccurrencePair = {
  productA: string
  productB: string
  count: number
}

export type DailyOpsRevenueCoOccurrenceDto = {
  pairs: DailyOpsCoOccurrencePair[]
  note?: string
}
