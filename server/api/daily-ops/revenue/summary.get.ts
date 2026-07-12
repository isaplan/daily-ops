/**
 * @registry-id: dailyOpsRevenueSummaryGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Revenue KPI totals — read-cache target (ADR-013, reserved)
 * @last-fix: [2026-07-02] ADR-013 reserved read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache (reserved - page not built yet)
 * @read-cache-json: daily_ops_read_cache · profile=revenue-summary · levels=daily|weekly|monthly|yearly
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueMetrics.ts
 */

import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchRevenueRange, listDatesInRange } from '../../../utils/dailyOpsRevenue/fetchRevenueRange'
import { buildKpiVsBenchmark } from '../../../utils/dailyOpsRevenue/computeBenchmark60d'
import { readRevenueBenchmark60d } from '../../../utils/dailyOpsRevenue/revenueBenchmark'
import type { DailyOpsRevenueKpiDto } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueKpiDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseRevenueQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const totals = await fetchRevenueRange(db, ctx)
  const businessDays = listDatesInRange(ctx.startDate, ctx.endDate).length
  const revenuePerItem = totals.itemsCount > 0 ? totals.revenue / totals.itemsCount : 0
  const avgRevenuePerDay = businessDays > 0 ? totals.revenue / businessDays : 0

  const dto: DailyOpsRevenueKpiDto = {
    revenue: Math.round(totals.revenue * 100) / 100,
    revenueIncVat: Math.round(totals.revenueIncVat * 100) / 100,
    borkRevenueIncVat: Math.round(totals.borkRevenueIncVat * 100) / 100,
    borkRevenueExVat: Math.round(totals.borkRevenueExVat * 100) / 100,
    itemsCount: totals.itemsCount,
    revenuePerItem: Math.round(revenuePerItem * 100) / 100,
    businessDays,
    avgRevenuePerDay: Math.round(avgRevenuePerDay * 100) / 100,
    leadSource: totals.leadSource,
    currentLabel: ctx.label,
    compareLabel: ctx.compareLabel,
  }

  const bench = await readRevenueBenchmark60d(db, ctx.endDate, ctx.locationId)
  dto.vs60d = {
    label: '60d gem.',
    revenue: buildKpiVsBenchmark(dto.revenue, bench.avgDailyRevenue * businessDays),
    itemsCount: buildKpiVsBenchmark(dto.itemsCount, bench.avgDailyItems * businessDays),
    avgRevenuePerDay: buildKpiVsBenchmark(dto.avgRevenuePerDay, bench.avgDailyRevenue),
    revenuePerItem: buildKpiVsBenchmark(dto.revenuePerItem, bench.avgRevenuePerItem),
  }

  if (ctx.compareStartDate && ctx.compareEndDate) {
    const cmp = await fetchRevenueRange(db, {
      ...ctx,
      startDate: ctx.compareStartDate,
      endDate: ctx.compareEndDate,
      locationId: ctx.compareLocationId ?? ctx.locationId,
    })
    dto.compareDelta = {
      amount: Math.round((totals.revenue - cmp.revenue) * 100) / 100,
      pct: cmp.revenue > 0 ? Math.round(((totals.revenue - cmp.revenue) / cmp.revenue) * 10000) / 100 : null,
    }
  }

  return dto
})
