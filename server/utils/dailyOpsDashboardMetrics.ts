/**
 * @registry-id: dailyOpsDashboardMetrics
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Thin barrel for Daily Ops dashboard metrics — live modules under dailyOpsMetrics/
 * @last-fix: [2026-05-28] Split 1600-line monolith; removed dead legacy Bork/Eitje GET reads
 * @adr-ref: ADR-004, ADR-006
 *
 * @architecture:
 *   UI GET path: server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts (snapshot-only).
 *   Do not add new read-time bork_* / eitje_* / inbox usage on dashboard GET.
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/*
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 * ✓ server/utils/dailyOpsRevenue/borkRevenueRead.ts
 */

export {
  parseDailyOpsMetricsQuery,
  enumerateUtcDatesInclusive,
  type DailyOpsMetricsContext,
} from './dailyOpsMetrics/context'

export { BORK_DOC_REVENUE_EXPR, BORK_DOC_REVENUE_INC_EXPR } from './dailyOpsMetrics/borkAggregationExprs'

export { type BorkHourAggregatesBundle, type TodayRevenueExtras } from './dailyOpsMetrics/types'

export {
  MOST_PROFITABLE_HOUR_DEFAULTS,
  MOST_PROFITABLE_HOUR_ESTIMATES_NOTE,
} from './dailyOpsMetrics/profitHour'

export {
  buildDailyOpsSummaryDto,
  buildDailyOpsRevenueBreakdownDto,
  VAT_DISCLAIMER,
} from './dailyOpsMetrics/dtoBuilders'

export { fetchWorkerStaffDetailMetrics } from './dailyOpsMetrics/workerStaffDetail'
