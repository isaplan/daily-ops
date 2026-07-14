import type { Db } from 'mongodb'
import type { DailyOpsRevenueQueryContext, DailyOpsSimplePnLDto } from '~/types/daily-ops-revenue'
import { pnlFromRevenueLabor } from '../dailyOpsInsights/pnlFromRevenueLabor'
import { aggregateLaborForRange } from '../dailyOpsSnapshot/aggregateLaborForRange'
import { fetchRevenueRange, fetchRevenueRangeForDates } from './fetchRevenueRange'
import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function pnlSliceFromTotals(
  revenue: number,
  foodRevenue: number,
  beverageRevenue: number,
  loadedLabor: number,
  assumptions: DailyOpsSimplePnLAssumptions,
) {
  const catTotal = foodRevenue + beverageRevenue
  const foodShare = catTotal > 0 ? foodRevenue / catTotal : 0.5
  return pnlFromRevenueLabor(revenue, loadedLabor, foodShare, assumptions)
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

  const laborCost = round2(labor.loaded)
  const slice = pnlSliceFromTotals(
    totals.revenue,
    totals.foodRevenue,
    totals.beverageRevenue,
    laborCost,
    assumptions,
  )
  const foodCogs = round2((totals.foodRevenue * assumptions.foodCogsPct) / 100)
  const bevCogs = round2((totals.beverageRevenue * assumptions.bevCogsPct) / 100)
  const overhead = slice.fixed_overhead
  const result = slice.net_profit

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
    const cmpLaborCost = round2(cmpLabor.loaded)
    const cmpSlice = pnlSliceFromTotals(
      cmpTotals.revenue,
      cmpTotals.foodRevenue,
      cmpTotals.beverageRevenue,
      cmpLaborCost,
      assumptions,
    )
    const cmpFoodCogs = round2((cmpTotals.foodRevenue * assumptions.foodCogsPct) / 100)
    const cmpBevCogs = round2((cmpTotals.beverageRevenue * assumptions.bevCogsPct) / 100)
    dto.compare = {
      label: ctx.compareLabel,
      revenue: round2(cmpTotals.revenue),
      foodCogs: cmpFoodCogs,
      bevCogs: cmpBevCogs,
      laborCost: cmpLaborCost,
      overhead: cmpSlice.fixed_overhead,
      result: cmpSlice.net_profit,
    }
  }

  return dto
}
