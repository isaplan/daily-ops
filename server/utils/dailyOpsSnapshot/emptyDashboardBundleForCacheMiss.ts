/**
 * @registry-id: dailyOpsEmptyDashboardBundle
 * @created: 2026-07-16T12:15:00.000Z
 * @last-modified: 2026-07-16T12:15:00.000Z
 * @description: Empty dashboard bundle for ADR-013 cache miss (no live rebuild on GET)
 * @last-fix: [2026-07-16] Initial — zeros + coverage note when read-cache missing
 * @adr-ref: ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 */

import type {
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'

/** Return shape for GET miss — UI shows empty/partial; fix via snapshot + cache rebuild. */
export function emptyDashboardBundleForCacheMiss(
  ctx: DailyOpsMetricsContext,
): DailyOpsDashboardBundleDto {
  const range = {
    period: ctx.period,
    startDate: ctx.startDate,
    endDate: ctx.endDate,
  }
  const coverageNote =
    'Read-cache miss for this period — rebuild with pnpm snapshots:backfill / cascadeGenerate (ADR-013).'

  const summary: DailyOpsSummaryDto = {
    range,
    snapshotCoverage: {
      daysExpected: 1,
      daysFound: 0,
      missingDates: [
        ctx.startDate === ctx.endDate ? ctx.startDate : `${ctx.startDate}..${ctx.endDate}`,
      ],
    },
    summary: {
      totalRevenue: 0,
      totalLaborCost: 0,
      totalLaborHours: 0,
      profit: 0,
      profitMarginPct: 0,
      revenuePerLaborHour: null,
      laborCostPctOfRevenue: 0,
    },
    vatDisclaimer: coverageNote,
  }

  const revenue: DailyOpsRevenueBreakdownDto = {
    range,
    revenueByCategory: [],
    revenueByTimePeriod: [],
    mostProfitableHour: {
      hourLabel: '—',
      date: '',
      hour: 0,
      revenue: 0,
      laborCost: 0,
      cogsCost: 0,
      fixedCost: 0,
      profit: 0,
      estimatesNote: coverageNote,
    },
    profitByInterval: {
      estimatesNote: coverageNote,
      dates: [],
      cells: [],
    },
  }

  const labor = {
    range,
    inventory: {
      hasBorkCronData: false,
      hasBorkHourData: false,
      hasEitjeAggData: false,
      notes: [coverageNote],
    },
    workersByTeamLocation: [],
    workersByTeamLocationByDay: [],
    locationLaborPctByDay: [],
    revenueByLocationDay: [],
    hoursCostByContractType: [],
    contractTypeByDay: [],
    daily: [],
    periodRollup: {
      revenue: 0,
      laborCost: 0,
      hours: 0,
      laborCostPctOfRevenue: null,
      revenuePerLaborHour: null,
    },
    productivityByLocationDay: [],
  } as DailyOpsLaborMetricsDto

  return { summary, revenue, labor }
}
