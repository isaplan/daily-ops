import type { Db } from 'mongodb'
import type { DailyOpsRevenueQueryContext, DailyOpsSimplePnLDto } from '~/types/daily-ops-revenue'
import { aggregateLaborForRange } from '../dailyOpsSnapshot/aggregateLaborForRange'
import { fetchRevenueRange, fetchRevenueRangeForDates } from './fetchRevenueRange'
import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function computeSimplePnL(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
  assumptions: DailyOpsSimplePnLAssumptions,
): Promise<DailyOpsSimplePnLDto> {
  const totals = await fetchRevenueRange(db, ctx)
  const labor = await aggregateLaborForRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
  })

  const foodCogs = round2((totals.foodRevenue * assumptions.foodCogsPct) / 100)
  const bevCogs = round2((totals.beverageRevenue * assumptions.bevCogsPct) / 100)
  const laborCost = round2(labor.loaded)
  const overhead = round2((totals.revenue * assumptions.overheadPct) / 100)
  const result = round2(totals.revenue - foodCogs - bevCogs - laborCost - overhead)

  const daysExpected =
    Math.max(1, Math.ceil((Date.parse(ctx.endDate) - Date.parse(ctx.startDate)) / 86400000) + 1) *
    (ctx.locationId ? 1 : 3)

  const dto: DailyOpsSimplePnLDto = {
    revenue: round2(totals.revenue),
    foodRevenue: round2(totals.foodRevenue),
    beverageRevenue: round2(totals.beverageRevenue),
    foodCogs,
    bevCogs,
    laborCost,
    laborCoverage: {
      daysFound: labor.coverage.daysFound,
      daysExpected,
      pctComplete: daysExpected > 0 ? Math.round((labor.coverage.daysFound / daysExpected) * 100) : 0,
    },
    overhead,
    result,
    assumptions,
  }

  if (ctx.compareStartDate && ctx.compareEndDate && ctx.compareLabel) {
    const cmpLoc = ctx.compareLocationId ?? ctx.locationId
    const cmpTotals = await fetchRevenueRangeForDates(
      db,
      ctx.compareStartDate,
      ctx.compareEndDate,
      cmpLoc,
    )
    const cmpLabor = await aggregateLaborForRange(db, {
      startDate: ctx.compareStartDate,
      endDate: ctx.compareEndDate,
      locationId: cmpLoc,
    })
    const cmpFoodCogs = round2((cmpTotals.foodRevenue * assumptions.foodCogsPct) / 100)
    const cmpBevCogs = round2((cmpTotals.beverageRevenue * assumptions.bevCogsPct) / 100)
    const cmpResult = round2(
      cmpTotals.revenue - cmpFoodCogs - cmpBevCogs - round2(cmpLabor.loaded) - round2((cmpTotals.revenue * assumptions.overheadPct) / 100),
    )
    const cmpOverhead = round2((cmpTotals.revenue * assumptions.overheadPct) / 100)
    dto.compare = {
      label: ctx.compareLabel,
      revenue: round2(cmpTotals.revenue),
      foodCogs: cmpFoodCogs,
      bevCogs: cmpBevCogs,
      laborCost: round2(cmpLabor.loaded),
      overhead: cmpOverhead,
      result: cmpResult,
    }
  }

  return dto
}
