/**
 * @registry-id: dailyOpsDashboardBundleLoadRows
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Parallel snapshot section reads for dashboard bundle
 * @adr-ref: ADR-004
 */

import type { Db } from 'mongodb'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotLaborSection,
  type DailyOpsSnapshotMaster,
  type DailyOpsSnapshotRevenueByOrderTimeSection,
  type DailyOpsSnapshotRevenueHourlySection,
  type DailyOpsSnapshotRevenueProductsSection,
  type DailyOpsSnapshotRevenueSection,
  type DailyOpsSnapshotRevenueTablesSection,
  type DailyOpsSnapshotRevenueWorkersSection,
} from '~/types/daily-ops-snapshot'
import type { DailyOpsMetricsContext } from '../../dailyOpsDashboardMetrics'

export type SnapshotDashboardRows = {
  masters: DailyOpsSnapshotMaster[]
  revenue: DailyOpsSnapshotRevenueSection[]
  labor: DailyOpsSnapshotLaborSection[]
  hourly: DailyOpsSnapshotRevenueHourlySection[]
  orderTime: DailyOpsSnapshotRevenueByOrderTimeSection[]
  products: DailyOpsSnapshotRevenueProductsSection[]
  tables: DailyOpsSnapshotRevenueTablesSection[]
  workers: DailyOpsSnapshotRevenueWorkersSection[]
}

function rangeFilter(ctx: DailyOpsMetricsContext): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId
  return filter
}

export async function loadSnapshotDashboardRows(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<SnapshotDashboardRows> {
  const filter = rangeFilter(ctx)
  const [masters, revenue, labor, hourly, orderTime, products, tables, workers] = await Promise.all([
    db.collection<DailyOpsSnapshotMaster>(DAILY_OPS_SNAPSHOT_COLLECTIONS.master).find(filter).toArray(),
    db.collection<DailyOpsSnapshotRevenueSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).find(filter).toArray(),
    db.collection<DailyOpsSnapshotLaborSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection).find(filter).toArray(),
    db
      .collection<DailyOpsSnapshotRevenueHourlySection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueHourlySection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueByOrderTimeSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueByOrderTimeSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueProductsSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueTablesSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueWorkersSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueWorkersSection)
      .find(filter)
      .toArray(),
  ])
  return { masters, revenue, labor, hourly, orderTime, products, tables, workers }
}
