/**
 * @registry-id: dailyOpsRevenueDrilldownTop10
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-06-02T23:30:00.000Z
 * @description: Top-10 workers/tables/products for revenue drilldown
 * @last-fix: [2026-06-02] Name-aware catalog resolver (guards recycled Bork product_key)
 *   Prior: [2026-06-02] Classify food vs beverage via product_catalog SSOT (not local name regex)
 *   Prior: [2026-05-28] Workers top-10 by payment time and order-entry time
 * @adr-ref: ADR-004
 */

import type { DailyOpsRevenueDrilldownDto, DailyOpsRevenueDrilldownTopRowDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsSnapshotRevenueWorkersSection } from '~/types/daily-ops-snapshot'
import type { ProductCatalogResolver } from '../../borkFoodBeverageSplit'
import { isBeverageCategoryName, isBeverageProduct } from '../../borkFoodBeverageSplit'
import type { BuildRevenueDrilldownInput } from './drilldownShared'
import { roundEur } from './drilldownShared'

const EMPTY_CATALOG: ProductCatalogResolver = { byKey: new Map(), byName: new Map() }

function pushTopRow(
  map: Map<string, DailyOpsRevenueDrilldownTopRowDto>,
  key: string,
  row: DailyOpsRevenueDrilldownTopRowDto,
): void {
  const prev = map.get(key)
  if (!prev) {
    map.set(key, { ...row, revenue: roundEur(row.revenue), quantity: row.quantity, count: row.count })
    return
  }
  prev.revenue = roundEur(prev.revenue + row.revenue)
  prev.quantity += row.quantity
  prev.count = (prev.count ?? 0) + (row.count ?? 0)
}

function topRows(map: Map<string, DailyOpsRevenueDrilldownTopRowDto>, limit = 10): DailyOpsRevenueDrilldownTopRowDto[] {
  return [...map.values()]
    .map((row) => ({ ...row, revenue: roundEur(row.revenue) }))
    .sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function buildWorkerTopRows(
  docs: DailyOpsSnapshotRevenueWorkersSection[],
  field: 'workers' | 'orderTimeWorkers',
): DailyOpsRevenueDrilldownTopRowDto[] {
  const workers = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()
  for (const doc of docs) {
    for (const worker of doc[field] ?? []) {
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
  return topRows(workers)
}

export function buildRevenueDrilldownTop10(
  input: BuildRevenueDrilldownInput,
  catalogResolver: ProductCatalogResolver = EMPTY_CATALOG,
): DailyOpsRevenueDrilldownDto['top10'] {
  const tables = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()
  const foodProducts = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()
  const beverages = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()

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
      const productId = String(product.productId ?? '').trim()
      const target = isBeverageProduct(productId, label, catalogResolver) ? beverages : foodProducts
      pushTopRow(target, label, {
        label,
        subLabel: doc.locationName,
        revenue: Number(product.revenue_ex_vat ?? 0),
        quantity: Number(product.quantity ?? 0),
      })
    }
    for (const category of doc.categories ?? []) {
      const label = String(category.name ?? '').trim() || 'Unknown category'
      if (!isBeverageCategoryName(label)) continue
      pushTopRow(beverages, `category|${label}`, {
        label,
        subLabel: `${doc.locationName} · category`,
        revenue: Number(category.revenue_ex_vat ?? 0),
        quantity: Number(category.quantity ?? 0),
      })
    }
  }

  return {
    workers: {
      paymentTime: buildWorkerTopRows(input.workers, 'workers'),
      orderTime: buildWorkerTopRows(input.workers, 'orderTimeWorkers'),
    },
    tables: topRows(tables),
    foodProducts: topRows(foodProducts),
    beverageProductsOrCategories: topRows(beverages),
  }
}
