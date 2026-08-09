/**
 * @registry-id: dailyOpsRevenueFetchCategoriesAndProducts
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-08-09T00:40:00.000Z
 * @description: Categories + top products from period-cache day nodes only
 * @last-fix: [2026-08-09] PERIOD_CACHE_ADR L3 — no snapshot product-section fallback
 * @adr-ref: ADR-004, ADR-013, PERIOD_CACHE_ADR L2, L3
 * @data-source: period-cache
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/categories.get.ts
 * ✓ server/api/daily-ops/revenue/products.get.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsRevenueCategoryDto,
  DailyOpsRevenueProductRow,
  DailyOpsRevenueQueryContext,
} from '~/types/daily-ops-revenue'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { findPeriodNode } from '../dailyOpsPeriodCache/store'
import type { DailyOpsPeriodNode } from '~/types/daily-ops-period-cache'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

async function loadDayNodesForRange (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsPeriodNode[]> {
  const locationId = ctx.locationId ?? 'all'
  const nodes: DailyOpsPeriodNode[] = []
  let cursor = ctx.startDate
  while (cursor <= ctx.endDate) {
    const node = await findPeriodNode(db, {
      locationId,
      level: 'day',
      periodKey: cursor,
    })
    if (node) nodes.push(node)
    cursor = addCalendarDaysYmd(cursor, 1)
  }
  return nodes
}

export async function fetchCategories (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueCategoryDto[]> {
  const nodes = await loadDayNodesForRange(db, ctx)
  if (nodes.length === 0) return []

  const map = new Map<string, { revenue: number; itemsCount: number }>()
  for (const node of nodes) {
    for (const c of node.revenue.byCategory ?? []) {
      const cur = map.get(c.name) ?? { revenue: 0, itemsCount: 0 }
      cur.revenue += c.exVat
      cur.itemsCount += c.qty
      map.set(c.name, cur)
    }
  }
  const total = [...map.values()].reduce((a, b) => a + b.revenue, 0)
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      revenue: round2(v.revenue),
      itemsCount: v.itemsCount,
      pctOfTotal: total > 0 ? round2((v.revenue / total) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function fetchTopProducts (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
  limit = 20,
): Promise<DailyOpsRevenueProductRow[]> {
  const nodes = await loadDayNodesForRange(db, ctx)
  if (nodes.length === 0) return []

  const map = new Map<string, { revenue: number; itemsCount: number }>()
  for (const node of nodes) {
    for (const p of node.revenue.byProductTop ?? []) {
      const cur = map.get(p.name) ?? { revenue: 0, itemsCount: 0 }
      cur.revenue += p.exVat
      cur.itemsCount += p.qty
      map.set(p.name, cur)
    }
  }
  const base = [...map.entries()]
    .map(([productName, v]) => ({
      productName,
      revenue: round2(v.revenue),
      itemsCount: v.itemsCount,
      revenuePerItem: v.itemsCount > 0 ? round2(v.revenue / v.itemsCount) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)

  const byWeekday = productWeekdayFromPeriodNodes(nodes, base.map((p) => p.productName))
  return base.map((p) => ({
    ...p,
    byWeekday: byWeekday.get(p.productName),
  }))
}

const DOW_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

function productWeekdayFromPeriodNodes (
  nodes: DailyOpsPeriodNode[],
  productNames: string[],
): Map<string, Array<{ dayOfWeek: string; itemsCount: number; revenue: number }>> {
  const out = new Map<string, Array<{ dayOfWeek: string; itemsCount: number; revenue: number }>>()
  if (productNames.length === 0) return out
  const nameSet = new Set(productNames)
  const acc = new Map<string, Map<string, { itemsCount: number; revenue: number }>>()

  for (const node of nodes) {
    const date = node.businessDateStart
    const dow = DOW_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()]!
    for (const p of node.revenue.byProductTop ?? []) {
      if (!nameSet.has(p.name)) continue
      if (!acc.has(p.name)) acc.set(p.name, new Map())
      const m = acc.get(p.name)!
      const cur = m.get(dow) ?? { itemsCount: 0, revenue: 0 }
      cur.itemsCount += p.qty
      cur.revenue += p.exVat
      m.set(dow, cur)
    }
  }

  for (const [name, m] of acc) {
    out.set(
      name,
      WEEKDAY_ORDER.map((dayOfWeek) => {
        const v = m.get(dayOfWeek) ?? { itemsCount: 0, revenue: 0 }
        return {
          dayOfWeek,
          itemsCount: v.itemsCount,
          revenue: round2(v.revenue),
        }
      }),
    )
  }
  return out
}
