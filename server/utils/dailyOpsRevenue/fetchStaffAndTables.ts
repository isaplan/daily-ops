/**
 * @registry-id: dailyOpsRevenueFetchStaffAndTables
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-08-09T15:50:00.000Z
 * @description: Per-staff / per-table revenue from period-cache day nodes (GET)
 * @last-fix: [2026-08-09] ZERO GET — period-cache byWorker/byTable only (no snapshot)
 * @adr-ref: ADR-004, PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/per-staff.get.ts
 * ✓ server/api/daily-ops/revenue/per-table.get.ts
 * ✓ server/api/daily-ops/productivity/*
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsRevenueQueryContext,
  DailyOpsRevenueStaffRow,
  DailyOpsRevenueTableRow,
} from '~/types/daily-ops-revenue'
import { LOCATION_SPACE_LABELS, type LocationSpaceId } from './locationSpaces'
import { loadPeriodDayNodesForRange } from '../dailyOpsPeriodCache/loadPeriodDayNodesForRange'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

export async function fetchStaffRevenue (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueStaffRow[]> {
  const nodes = await loadPeriodDayNodesForRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId ?? 'all',
  })
  const map = new Map<string, { revenue: number; orderCount: number; quantity: number }>()
  for (const n of nodes) {
    for (const w of n.revenue.byWorker ?? []) {
      const name = w.workerName || w.workerId
      if (!name) continue
      const cur = map.get(name) ?? { revenue: 0, orderCount: 0, quantity: 0 }
      cur.revenue += w.exVat
      cur.orderCount += w.orderCount
      cur.quantity += w.qty
      map.set(name, cur)
    }
  }
  return [...map.entries()]
    .map(([staffName, v]) => ({
      staffName,
      revenue: round2(v.revenue),
      orderCount: v.orderCount,
      avgProductsPerOrder: v.orderCount > 0 ? round2(v.quantity / v.orderCount) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function fetchTableRevenue (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
  spaceFilter?: string,
): Promise<DailyOpsRevenueTableRow[]> {
  const nodes = await loadPeriodDayNodesForRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId ?? 'all',
  })
  const map = new Map<string, { revenue: number; itemsCount: number; locationSpace: string }>()
  for (const n of nodes) {
    for (const t of n.revenue.byTable ?? []) {
      if (spaceFilter && t.locationSpace !== spaceFilter) continue
      const cur = map.get(t.tableNum) ?? {
        revenue: 0,
        itemsCount: 0,
        locationSpace: t.locationSpace,
      }
      cur.revenue += t.exVat
      cur.itemsCount += t.qty
      map.set(t.tableNum, cur)
    }
  }
  return [...map.entries()]
    .map(([tableNum, v]) => ({
      tableNum,
      locationSpace: LOCATION_SPACE_LABELS[v.locationSpace as LocationSpaceId] ?? v.locationSpace,
      revenue: round2(v.revenue),
      itemsCount: v.itemsCount,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function fetchLocationSpaceSplit (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<Array<{ space: string; revenue: number; itemsCount: number; revenuePerItem: number }>> {
  const tables = await fetchTableRevenue(db, ctx, ctx.locationSpace)
  const map = new Map<string, { revenue: number; itemsCount: number }>()
  for (const t of tables) {
    const key = t.locationSpace
    const cur = map.get(key) ?? { revenue: 0, itemsCount: 0 }
    cur.revenue += t.revenue
    cur.itemsCount += t.itemsCount
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([space, v]) => ({
      space,
      revenue: round2(v.revenue),
      itemsCount: v.itemsCount,
      revenuePerItem: v.itemsCount > 0 ? round2(v.revenue / v.itemsCount) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}
