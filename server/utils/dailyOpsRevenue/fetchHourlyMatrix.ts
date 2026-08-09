/**
 * @registry-id: dailyOpsRevenueFetchHourlyMatrix
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-08-09T15:50:00.000Z
 * @description: Hourly revenue matrix from period-cache day nodes (byHour)
 * @last-fix: [2026-08-09] ZERO GET — period-cache only; miss → empty matrix (no snapshot)
 * @adr-ref: ADR-004, ADR-006, PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/hourly-matrix.get.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsRevenueHourlyMatrixDto, DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'
import { type HourlyMatrixAccumCell } from './borkRevenueRead'
import { loadPeriodDayNodesForRange } from '../dailyOpsPeriodCache/loadPeriodDayNodesForRange'

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]

function emptyCell (): HourlyMatrixAccumCell {
  return { revenue: 0, itemsCount: 0, foodRevenue: 0, drinksRevenue: 0 }
}

function ingestPeriodHourIntoAccum (
  accum: HourlyMatrixAccumCell[][],
  businessDate: string,
  byHour: Array<{ hour: number; exVat: number; qty: number }>,
  food: number,
  beverage: number,
  dayExVat: number,
): void {
  if (!byHour.length) return
  const dow = new Date(`${businessDate}T12:00:00Z`).getUTCDay()
  const col = DOW_ORDER.indexOf(dow)
  if (col < 0) return
  for (const h of byHour) {
    const hour = Number(h.hour)
    if (hour < 0 || hour > 23) continue
    const cell = accum[hour]![col]!
    cell.revenue += Number(h.exVat ?? 0)
    cell.itemsCount += Number(h.qty ?? 0)
    if (dayExVat > 0) {
      const share = h.exVat / dayExVat
      cell.foodRevenue += food * share
      cell.drinksRevenue += beverage * share
    }
  }
}

function toDto (accum: HourlyMatrixAccumCell[][]): DailyOpsRevenueHourlyMatrixDto {
  return {
    rows: accum.map((weekdays, hour) => ({
      hour,
      weekdays: weekdays.map((c) => ({
        revenue: Math.round(c.revenue * 100) / 100,
        itemsCount: c.itemsCount,
        foodRevenue: Math.round(c.foodRevenue * 100) / 100,
        drinksRevenue: Math.round(c.drinksRevenue * 100) / 100,
      })),
    })),
  }
}

export async function fetchHourlyMatrix (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueHourlyMatrixDto> {
  const accum = Array.from({ length: 24 }, () => DOW_ORDER.map(() => emptyCell()))
  const locationId = ctx.locationId ?? 'all'

  const nodes = await loadPeriodDayNodesForRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId,
  })

  for (const n of nodes) {
    ingestPeriodHourIntoAccum(
      accum,
      n.periodKey,
      n.revenue.byHour ?? [],
      n.revenue.food,
      n.revenue.beverage,
      n.revenue.exVat,
    )
  }

  return toDto(accum)
}
