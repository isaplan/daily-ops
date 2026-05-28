/**
 * @registry-id: dailyOpsRevenueDrilldownTop10
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Top-10 workers/tables/products for revenue drilldown
 * @adr-ref: ADR-004
 */

import type { DailyOpsRevenueDrilldownDto, DailyOpsRevenueDrilldownTopRowDto } from '~/types/daily-ops-dashboard'
import type { BuildRevenueDrilldownInput } from './drilldownShared'
import { round2 } from './drilldownShared'

const DRINK_NAME_PATTERN =
  /wine|wijn|beer|bier|gint|gin |vodka|whisk|whiskey|rum|cocktail|cola|sprite|fanta|coffee|koffie|thee|tea|sap|juice|fris|prosecco|champagne|cider|tonic|latte|cappuccino|espresso|pils|stelz|borrel|aperol|campari|martini|soda|limonade/i

function pushTopRow(
  map: Map<string, DailyOpsRevenueDrilldownTopRowDto>,
  key: string,
  row: DailyOpsRevenueDrilldownTopRowDto,
): void {
  const prev = map.get(key)
  if (!prev) {
    map.set(key, { ...row, revenue: round2(row.revenue), quantity: row.quantity, count: row.count })
    return
  }
  prev.revenue = round2(prev.revenue + row.revenue)
  prev.quantity += row.quantity
  prev.count = (prev.count ?? 0) + (row.count ?? 0)
}

function topRows(map: Map<string, DailyOpsRevenueDrilldownTopRowDto>, limit = 10): DailyOpsRevenueDrilldownTopRowDto[] {
  return [...map.values()]
    .map((row) => ({ ...row, revenue: round2(row.revenue) }))
    .sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label))
    .slice(0, limit)
}

export function buildRevenueDrilldownTop10(
  input: BuildRevenueDrilldownInput,
): DailyOpsRevenueDrilldownDto['top10'] {
  const workers = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()
  const tables = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()
  const foodProducts = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()
  const beverages = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()

  for (const doc of input.workers) {
    for (const worker of doc.workers ?? []) {
      const label = String(worker.workerName ?? '').trim() || 'Unknown'
      pushTopRow(workers, String(worker.workerId ?? label), {
        label,
        subLabel: doc.locationName,
        revenue: Number(worker.revenue_ex_vat ?? 0),
        quantity: Number(worker.quantity ?? 0),
        count: Number(worker.order_count ?? 0),
      })
    }
  }
  for (const doc of input.tables) {
    for (const table of doc.tables ?? []) {
      const label = String(table.tableNum ?? '').trim() || 'Unknown table'
      const spaceName = String(table.locationSpace ?? '').trim()
      pushTopRow(tables, `${doc.locationId}|${label}|${spaceName}`, {
        label,
        subLabel: [doc.locationName, spaceName].filter(Boolean).join(' · '),
        revenue: Number(table.revenue_ex_vat ?? 0),
        quantity: Number(table.quantity ?? 0),
      })
    }
  }
  for (const doc of input.products) {
    for (const product of doc.products ?? []) {
      const label = String(product.productName ?? '').trim() || 'Unknown product'
      const target = DRINK_NAME_PATTERN.test(label) ? beverages : foodProducts
      pushTopRow(target, label, {
        label,
        subLabel: doc.locationName,
        revenue: Number(product.revenue_ex_vat ?? 0),
        quantity: Number(product.quantity ?? 0),
      })
    }
    for (const category of doc.categories ?? []) {
      const label = String(category.name ?? '').trim() || 'Unknown category'
      if (!DRINK_NAME_PATTERN.test(label)) continue
      pushTopRow(beverages, `category|${label}`, {
        label,
        subLabel: `${doc.locationName} · category`,
        revenue: Number(category.revenue_ex_vat ?? 0),
        quantity: Number(category.quantity ?? 0),
      })
    }
  }

  return {
    workers: topRows(workers),
    tables: topRows(tables),
    foodProducts: topRows(foodProducts),
    beverageProductsOrCategories: topRows(beverages),
  }
}
