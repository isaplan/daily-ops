/**
 * @registry-id: dailyOpsSnapshotBuildRevenueTablesSection
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Per-table revenue snapshot from bork_sales_by_table (aggregated per table per day)
 * @last-fix: [2026-05-20] Initial
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import { getLocationSpaceForTable } from '../dailyOpsRevenue/locationSpaces'
import type { DailyOpsSnapshotRevenueTablesSection } from '../../../types/daily-ops-snapshot'
import type { BuildRevenueInput } from './buildRevenueSection'

function docRevenueEx(doc: Record<string, unknown>): number {
  const ex = Number(doc.total_revenue_ex_vat ?? 0)
  if (ex > 0) return ex
  return Number(doc.total_revenue ?? 0)
}

export async function buildRevenueTablesSection(
  db: Db,
  input: BuildRevenueInput,
): Promise<DailyOpsSnapshotRevenueTablesSection> {
  const { businessDate, locationId, locationName } = input
  const suffix = resolveBorkAggReadSuffix()
  const locOid = ObjectId.isValid(locationId) ? new ObjectId(locationId) : null
  const coll = `bork_sales_by_table${suffix}`

  const rows = locOid
    ? await db
        .collection(coll)
        .find({ business_date: businessDate, locationId: locOid })
        .toArray()
    : []

  const byTable = new Map<string, { revenue_ex_vat: number; quantity: number; locationSpace: string }>()

  for (const r of rows) {
    const doc = r as Record<string, unknown>
    const tableNum = String(doc.tableNum ?? doc.table_nr ?? doc.TableNr ?? '')
    if (!tableNum) continue
    const rev = docRevenueEx(doc)
    const qty = Number(doc.total_quantity ?? 0)
    const space = getLocationSpaceForTable(tableNum)
    const cur = byTable.get(tableNum) ?? { revenue_ex_vat: 0, quantity: 0, locationSpace: space }
    cur.revenue_ex_vat += rev
    cur.quantity += qty
    byTable.set(tableNum, cur)
  }

  const tables = Array.from(byTable.entries())
    .map(([tableNum, v]) => ({
      tableNum,
      locationSpace: v.locationSpace,
      revenue_ex_vat: v.revenue_ex_vat,
      quantity: v.quantity,
    }))
    .sort((a, b) => b.revenue_ex_vat - a.revenue_ex_vat)

  return {
    schema_version: 1,
    businessDate,
    locationId,
    locationName,
    tables,
    lastBuiltAt: new Date(),
  }
}
