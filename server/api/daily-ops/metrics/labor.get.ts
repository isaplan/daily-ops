import { getDb } from '../../../utils/db'
import {
  enumerateUtcDatesInclusive,
  fetchHoursCostByContractType,
  fetchLaborProductivityByLocationDay,
  fetchRevenueByDate,
  fetchLaborByDate,
  fetchWorkersByTeamLocation,
  inventoryCollections,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import type { DailyOpsLaborDayDto, DailyOpsLaborMetricsDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsLaborMetricsDto> => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()

  const [workersByTeamLocation, hoursCostByContractType, productivityByLocationDay, inventory, revMap, labMap] =
    await Promise.all([
      fetchWorkersByTeamLocation(db, ctx),
      fetchHoursCostByContractType(db, ctx),
      fetchLaborProductivityByLocationDay(db, ctx),
      inventoryCollections(db, ctx),
      fetchRevenueByDate(db, ctx),
      fetchLaborByDate(db, ctx),
    ])

  const days = enumerateUtcDatesInclusive(ctx.startDate, ctx.endDate)
  let sumRev = 0
  let sumLab = 0
  let sumHours = 0

  const daily: DailyOpsLaborDayDto[] = days.map((date) => {
    const revenue = revMap.get(date) ?? 0
    const lab = labMap.get(date)
    const laborCost = lab?.laborCost ?? 0
    const hours = lab?.hours ?? 0
    sumRev += revenue
    sumLab += laborCost
    sumHours += hours
    const laborCostPctOfRevenue = revenue > 0 ? (laborCost / revenue) * 100 : null
    const revenuePerLaborHour = hours > 0 ? revenue / hours : null
    return {
      date,
      revenue: Math.round(revenue * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      hours: Math.round(hours * 100) / 100,
      laborCostPctOfRevenue:
        laborCostPctOfRevenue != null ? Math.round(laborCostPctOfRevenue * 10) / 10 : null,
      revenuePerLaborHour:
        revenuePerLaborHour != null ? Math.round(revenuePerLaborHour * 100) / 100 : null,
    }
  })

  const periodRollup = {
    revenue: Math.round(sumRev * 100) / 100,
    laborCost: Math.round(sumLab * 100) / 100,
    hours: Math.round(sumHours * 100) / 100,
    laborCostPctOfRevenue:
      sumRev > 0 ? Math.round((sumLab / sumRev) * 100 * 10) / 10 : null,
    revenuePerLaborHour:
      sumHours > 0 ? Math.round((sumRev / sumHours) * 100) / 100 : null,
  }

  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    inventory: {
      hasBorkCronData: inventory.hasBorkCronData,
      hasBorkHourData: inventory.hasBorkHourData,
      hasEitjeAggData: inventory.hasEitjeAggData,
      notes: inventory.notes,
    },
    workersByTeamLocation,
    hoursCostByContractType,
    daily,
    periodRollup,
    productivityByLocationDay,
  }
})
