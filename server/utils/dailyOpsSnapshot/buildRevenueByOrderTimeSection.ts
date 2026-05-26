/**
 * @registry-id: dailyOpsSnapshotBuildRevenueByOrderTimeSection
 * @created: 2026-05-26T01:12:00.000Z
 * @last-modified: 2026-05-26T01:12:00.000Z
 * @description: Order-time hourly revenue snapshot section from bork_sales_by_order_hour.
 * @last-fix: [2026-05-26] Initial dedicated revenue-by-order-time section.
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 * ✓ scripts/backfill-revenue-by-order-time-snapshots.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type {
  DailyOpsSnapshotRevenueByOrderTimeSection,
  DailyOpsSnapshotRevenueSection,
  RevenueBreakdown,
} from '../../../types/daily-ops-snapshot'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import type { BuildRevenueInput } from './buildRevenueSection'

function createHourlySlots(): DailyOpsSnapshotRevenueSection['hourly'] {
  return Array.from({ length: 24 }, (_, business_hour) => ({
    business_hour,
    calendar_hour: (business_hour + 8) % 24,
    revenue: { ex_vat: 0, inc_vat: 0, vat: 0 } as RevenueBreakdown,
    quantity: 0,
  }))
}

export async function buildRevenueByOrderTimeSection(
  db: Db,
  input: BuildRevenueInput,
): Promise<DailyOpsSnapshotRevenueByOrderTimeSection> {
  const { businessDate, locationId, locationName } = input
  const locOid = ObjectId.isValid(locationId) ? new ObjectId(locationId) : null
  const borkSuffix = resolveBorkAggReadSuffix()
  const hourly = createHourlySlots()

  const rows = locOid
    ? await db
        .collection(`bork_sales_by_order_hour${borkSuffix}`)
        .find({ business_date: businessDate, locationId: locOid })
        .sort({ business_hour: 1 })
        .toArray()
    : []

  for (const row of rows) {
    const idx = Number(row.business_hour)
    if (idx < 0 || idx >= 24) continue
    hourly[idx]!.revenue.ex_vat = Number(row.total_revenue_ex_vat ?? 0)
    hourly[idx]!.revenue.inc_vat = Number(row.total_revenue_inc_vat ?? row.total_revenue ?? 0)
    hourly[idx]!.revenue.vat = Number(row.total_vat ?? 0)
    hourly[idx]!.quantity = Number(row.total_quantity ?? 0)
  }

  return {
    schema_version: 1,
    businessDate,
    locationId,
    locationName,
    hourly,
    lastBuiltAt: new Date(),
  }
}
