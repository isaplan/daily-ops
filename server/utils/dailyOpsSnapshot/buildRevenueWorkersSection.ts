/**
 * @registry-id: dailyOpsSnapshotBuildRevenueWorkersSection
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Per-worker revenue snapshot from bork_sales_by_worker
 * @last-fix: [2026-05-20] Initial
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import type { DailyOpsSnapshotRevenueWorkersSection } from '../../../types/daily-ops-snapshot'
import type { BuildRevenueInput } from './buildRevenueSection'

function docRevenueEx(doc: Record<string, unknown>): number {
  const ex = Number(doc.total_revenue_ex_vat ?? 0)
  if (ex > 0) return ex
  return Number(doc.total_revenue ?? 0)
}

export async function buildRevenueWorkersSection(
  db: Db,
  input: BuildRevenueInput,
): Promise<DailyOpsSnapshotRevenueWorkersSection> {
  const { businessDate, locationId, locationName } = input
  const suffix = resolveBorkAggReadSuffix()
  const locOid = ObjectId.isValid(locationId) ? new ObjectId(locationId) : null
  const coll = `bork_sales_by_worker${suffix}`

  const rows = locOid
    ? await db
        .collection(coll)
        .find({ business_date: businessDate, locationId: locOid })
        .toArray()
    : []

  const byWorker = new Map<
    string,
    { workerName: string; revenue_ex_vat: number; quantity: number; order_count: number }
  >()

  for (const r of rows) {
    const doc = r as Record<string, unknown>
    const workerId = String(doc.workerId ?? doc.userId ?? doc.worker_id ?? '')
    const workerName = String(doc.workerName ?? doc.user_name ?? doc.worker_name ?? 'Onbekend')
    const key = workerId || workerName
    const rev = docRevenueEx(doc)
    const qty = Number(doc.total_quantity ?? 0)
    const orders = Number(doc.record_count ?? doc.order_count ?? 1)
    const cur = byWorker.get(key) ?? { workerName, revenue_ex_vat: 0, quantity: 0, order_count: 0 }
    cur.revenue_ex_vat += rev
    cur.quantity += qty
    cur.order_count += orders
    byWorker.set(key, cur)
  }

  const workers = Array.from(byWorker.entries())
    .map(([workerId, v]) => ({
      workerId,
      workerName: v.workerName,
      revenue_ex_vat: v.revenue_ex_vat,
      quantity: v.quantity,
      order_count: v.order_count,
    }))
    .sort((a, b) => b.revenue_ex_vat - a.revenue_ex_vat)

  return {
    schema_version: 1,
    businessDate,
    locationId,
    locationName,
    workers,
    lastBuiltAt: new Date(),
  }
}
