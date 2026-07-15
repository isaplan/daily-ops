/**
 * @registry-id: dailyOpsSnapshotFetchDashboardBundleLight
 * @created: 2026-07-16T00:00:00.000Z
 * @last-modified: 2026-07-16T00:00:00.000Z
 * @description: Fast year-scale dashboard bundle — summary + labor rollups only (ADR-004)
 * @last-fix: [2026-07-16] Extracted from fetchDashboardBundle to stay under monolith budget
 * @adr-ref: ADR-004, ADR-013, ADR-014
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsLaborMetricsDto,
  DailyOpsProfitByIntervalDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
  PeriodBreakdownDto,
  VenueStripResponseDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from '../../dailyOpsMetrics/context'
import { buildDailyOpsSummaryDto } from '../../dailyOpsMetrics/dtoBuilders'
import { loadPnlAssumptions } from '../../appSettings/pnlAssumptionsSetting'
import { aggregateLaborForRange } from '../aggregateLaborForRange'
import { buildPeriodBreakdownFromLaborMetrics } from '../buildPeriodBreakdown'
import { assembleLaborFromSnapshots } from './assembleLaborDto'
import { contractRollupsFromSnapshotLabor } from './laborContractRollups'
import { loadSnapshotDashboardRowsLight } from './loadSnapshotRows'
import { buildRevLabMaps } from './revLabMaps'
import { snapshotRound2 } from './shared'

type LightDashboardBundleDto = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
  venueStrip?: VenueStripResponseDto
  periodBreakdown?: PeriodBreakdownDto
}

const EMPTY_PROFIT_BY_INTERVAL: DailyOpsProfitByIntervalDto = {
  estimatesNote: 'Profit-by-interval omitted for long ranges (>31 days).',
  dates: [],
  cells: [],
}

const EMPTY_PROFIT_HOUR: DailyOpsRevenueBreakdownDto['mostProfitableHour'] = {
  hourLabel: '—',
  date: '',
  hour: 0,
  revenue: 0,
  laborCost: 0,
  cogsCost: 0,
  fixedCost: 0,
  profit: 0,
  estimatesNote: 'Hourly profit omitted for long ranges (>31 days).',
}

/** Fast path for year-scale ranges — summary + labor rollups only. */
export async function fetchDashboardBundleLight(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<LightDashboardBundleDto> {
  const rows = await loadSnapshotDashboardRowsLight(db, ctx)
  const snapshotContracts = contractRollupsFromSnapshotLabor(rows.labor)
  const { revMap, labMap, revByDateLocation } = buildRevLabMaps(rows.masters, rows.revenue, rows.labor)

  let apiMergedTotal = 0
  for (const r of rows.revenue) {
    apiMergedTotal += Number(r.borkTotals?.ex_vat ?? 0)
  }

  const laborBreakdown = await aggregateLaborForRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
  })

  const pnlAssumptions = await loadPnlAssumptions(db)

  const summary = buildDailyOpsSummaryDto(ctx, revMap, labMap, {
    apiBusinessDaysTotal: snapshotRound2(apiMergedTotal),
    inboxBasisExVat: null,
  }, { assumptions: pnlAssumptions, categoryTotals: { food: 0, drinks: 0 } })
  if (laborBreakdown.coverage.daysFound > 0) {
    summary.summary.laborBreakdown = laborBreakdown
  }

  const revenue: DailyOpsRevenueBreakdownDto = {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    revenueByCategory: [],
    revenueByTimePeriod: [],
    mostProfitableHour: EMPTY_PROFIT_HOUR,
    profitByInterval: EMPTY_PROFIT_BY_INTERVAL,
  }

  const labor: DailyOpsLaborMetricsDto = assembleLaborFromSnapshots(
    ctx,
    rows,
    revMap,
    labMap,
    revByDateLocation,
    {
      hoursCostByContractType: snapshotContracts.hoursCostByContractType,
      contractTypeByDay: snapshotContracts.contractTypeByDay,
    },
  )

  return {
    summary,
    revenue,
    labor,
    periodBreakdown: buildPeriodBreakdownFromLaborMetrics(labor, ctx.startDate, ctx.endDate, {
      assumptions: pnlAssumptions,
      categoryTotals: { food: 0, drinks: 0 },
    }),
  }
}
