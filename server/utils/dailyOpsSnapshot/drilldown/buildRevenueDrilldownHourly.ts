/**
 * @registry-id: dailyOpsRevenueDrilldownHourly
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Hourly revenue/labor/profit rows for revenue drilldown
 * @last-fix: [2026-05-28] Benchmark loading moved to drilldown/hourlyBenchmarks.ts
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueDrilldownSection.ts
 */

import type { DailyOpsRevenueDrilldownHourlyRowDto } from '~/types/daily-ops-dashboard'
import { MOST_PROFITABLE_HOUR_DEFAULTS } from '../../dailyOpsMetrics/profitHour'
import type { DailyOpsMetricsContext } from '../../dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from '../../venueStrip/constants'
import type { BuildRevenueDrilldownInput } from './drilldownShared'
import { benchmarkStatus } from './hourlyBenchmarks'
import { hourLabel, locDayKey, locHourKey, revenueScale, round2 } from './drilldownShared'

export function buildHourlyRows(
  ctx: DailyOpsMetricsContext,
  input: BuildRevenueDrilldownInput,
  hourlyBenchmarks: Map<number, number>,
): DailyOpsRevenueDrilldownHourlyRowDto[] {
  const rawByLocDay = new Map<string, number>()
  for (const doc of input.hourly) {
    for (const slot of doc.hourly ?? []) {
      rawByLocDay.set(
        locDayKey(doc.businessDate, doc.locationId),
        (rawByLocDay.get(locDayKey(doc.businessDate, doc.locationId)) ?? 0) + Number(slot.revenue?.ex_vat ?? 0),
      )
    }
  }

  const byHourLoc = new Map<string, { locationName: string; revenue: number; laborCost: number }>()
  for (const doc of input.hourly) {
    if (doc.businessDate < ctx.startDate || doc.businessDate > ctx.endDate) continue
    const scale = revenueScale(doc.businessDate, doc.locationId, rawByLocDay, input.headlineRevenueByLocDay)
    for (const slot of doc.hourly ?? []) {
      const hour = Number(slot.calendar_hour)
      if (!Number.isFinite(hour)) continue
      const key = `${hour}|${doc.locationId}`
      const prev = byHourLoc.get(key) ?? { locationName: doc.locationName, revenue: 0, laborCost: 0 }
      prev.revenue += Number(slot.revenue?.ex_vat ?? 0) * scale
      prev.laborCost += input.laborByLocHour.get(locHourKey(doc.locationId, doc.businessDate, hour))?.loadedCost ?? 0
      byHourLoc.set(key, prev)
    }
  }

  const catTotal = input.categoryTotals.food + input.categoryTotals.drinks
  const foodShare = catTotal > 0 ? input.categoryTotals.food / catTotal : 0.5
  const rows: DailyOpsRevenueDrilldownHourlyRowDto[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    const locations = VENUE_STRIP_LOCATIONS.map((location) => {
      const found = byHourLoc.get(`${hour}|${location.locationId}`)
      const revenue = round2(found?.revenue ?? 0)
      const laborCost = round2(found?.laborCost ?? 0)
      const foodRev = revenue * foodShare
      const bevRev = revenue - foodRev
      const cogsCost = round2(
        foodRev * MOST_PROFITABLE_HOUR_DEFAULTS.foodCogsPct +
          bevRev * MOST_PROFITABLE_HOUR_DEFAULTS.beverageCogsPct,
      )
      const fixedCost = round2(revenue * MOST_PROFITABLE_HOUR_DEFAULTS.fixedOverheadPct)
      return {
        locationId: location.locationId,
        locationName: found?.locationName ?? location.locationName,
        revenue,
        laborCost,
        profit: round2(revenue - laborCost - cogsCost - fixedCost),
      }
    })
    const revenue = round2(locations.reduce((sum, row) => sum + row.revenue, 0))
    const laborCost = round2(locations.reduce((sum, row) => sum + row.laborCost, 0))
    const foodRev = revenue * foodShare
    const bevRev = revenue - foodRev
    const cogsCost = round2(
      foodRev * MOST_PROFITABLE_HOUR_DEFAULTS.foodCogsPct +
        bevRev * MOST_PROFITABLE_HOUR_DEFAULTS.beverageCogsPct,
    )
    const fixedCost = round2(revenue * MOST_PROFITABLE_HOUR_DEFAULTS.fixedOverheadPct)
    const benchmarkRevenue = hourlyBenchmarks.get(hour) ?? null
    rows.push({
      calendarHour: hour,
      hourLabel: hourLabel(hour),
      revenue,
      laborCost,
      cogsCost,
      fixedCost,
      profit: round2(revenue - laborCost - cogsCost - fixedCost),
      benchmarkRevenue,
      benchmarkDelta: benchmarkRevenue != null ? round2(revenue - benchmarkRevenue) : null,
      benchmarkStatus: benchmarkStatus(revenue, benchmarkRevenue),
      locations,
    })
  }
  return rows
}
