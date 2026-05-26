/**
 * @registry-id: dailyOpsSnapshotBuildRevenueSection
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-26T00:55:00.000Z
 * @description: Builds DailyOpsSnapshotRevenueSection for one (businessDate, locationId).
 *   Reads only from aggregated collections: bork_business_days, bork_sales_by_hour,
 *   inbox-bork-basis-report. Never touches bork_raw_data.
 * @last-fix: [2026-05-26] Snapshot carries order-time hourly Bork buckets beside paid-time buckets.
 *   Prior: [2026-05-25] Bork reads use resolveBorkAggReadSuffix (_v2) like products/hourly builders.
 *
 * @architecture:
 *   - Lead-source decision: if any inbox row exists for (businessDate, locationId), inbox wins
 *     for headline `totals`. Otherwise bork V2 wins. borkTotals always populated for cross-check.
 *   - Inbox headline: `pickBasisReportByCronPriority` from basis-report-mapper (cron 7/8 = final yesterday).
 *   - Hourly: pre-fill 24 slots (business_hour 0..23 → calendar_hour 8..7-next). Paid-time
 *     buckets come from bork_sales_by_hour; order-time buckets come from bork_sales_by_order_hour.
 *     No intraday inbox per-hour split (inbox is daily-level).
 *   - Intraday: all inbox rows stored in `intraday` for audit; 18/23 are partials only.
 *
 * @exports-to:
 *   ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type {
  DailyOpsSnapshotRevenueSection,
  LeadRevenueSource,
  RevenueBreakdown,
} from '../../../types/daily-ops-snapshot'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import { pickBasisReportByCronPriority, type BasisReportData } from '../inbox/basis-report-mapper'

const runtimeProcess = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}
const DEBUG = String(runtimeProcess.process?.env?.DEBUG ?? '').includes('snapshot:build')

export type BuildRevenueInput = {
  businessDate: string
  locationId: string
  locationName: string
}

function createHourlySlots(): DailyOpsSnapshotRevenueSection['hourly'] {
  return Array.from({ length: 24 }, (_, business_hour) => ({
    business_hour,
    calendar_hour: (business_hour + 8) % 24,
    revenue: { ex_vat: 0, inc_vat: 0, vat: 0 } as RevenueBreakdown,
    quantity: 0,
  }))
}

export async function buildRevenueSection(
  db: Db,
  input: BuildRevenueInput
): Promise<DailyOpsSnapshotRevenueSection> {
  const { businessDate, locationId, locationName } = input

  // bork_*  collections store locationId as ObjectId (live confirmed 2026-05-13).
  // inbox stores location_id as string. Eitje stores locationId as string.
  const locOid = ObjectId.isValid(locationId) ? new ObjectId(locationId) : null
  const borkFilter = { business_date: businessDate, locationId: locOid }
  const borkSuffix = resolveBorkAggReadSuffix()

  const [borkDay, borkHours, borkOrderHours, inboxRows] = await Promise.all([
    locOid ? db.collection(`bork_business_days${borkSuffix}`).findOne(borkFilter) : null,
    locOid
      ? db
          .collection(`bork_sales_by_hour${borkSuffix}`)
          .find(borkFilter)
          .sort({ business_hour: 1 })
          .toArray()
      : [],
    locOid
      ? db
          .collection(`bork_sales_by_order_hour${borkSuffix}`)
          .find(borkFilter)
          .sort({ business_hour: 1 })
          .toArray()
      : [],
    db
      .collection('inbox-bork-basis-report')
      .find({ business_date: businessDate, location_id: locationId })
      .sort({ cron_hour: 1 })
      .toArray(),
  ])

  const borkTotals = {
    ex_vat: Number(borkDay?.total_revenue_ex_vat ?? 0),
    inc_vat: Number(borkDay?.total_revenue_inc_vat ?? borkDay?.total_revenue ?? 0),
    vat: Number(borkDay?.total_vat ?? 0),
    quantity: Number(borkDay?.total_quantity ?? 0),
    record_count: Number(borkDay?.record_count ?? 0),
  }

  const leadInbox = pickBasisReportByCronPriority(inboxRows as unknown as BasisReportData[]) ?? null

  let leadSource: LeadRevenueSource = 'none'
  let totals: RevenueBreakdown & { quantity: number; record_count: number } = {
    ex_vat: 0,
    inc_vat: 0,
    vat: 0,
    quantity: 0,
    record_count: 0,
  }
  if (leadInbox) {
    leadSource = 'inbox'
    const ex = Number(leadInbox.final_revenue_ex_vat ?? 0)
    const inc = Number(
      leadInbox.final_revenue_incl_vat ??
      (leadInbox as { final_revenue_inc_vat?: number }).final_revenue_inc_vat ??
      0
    )
    totals = { ex_vat: ex, inc_vat: inc, vat: inc - ex, quantity: 0, record_count: 0 }
  } else if (borkDay) {
    leadSource = 'bork'
    totals = borkTotals
  }

  const hourly = createHourlySlots()
  const orderHourly = createHourlySlots()
  for (const h of borkHours) {
    const idx = Number(h.business_hour)
    if (idx >= 0 && idx < 24) {
      hourly[idx]!.revenue.ex_vat = Number(h.total_revenue_ex_vat ?? 0)
      hourly[idx]!.revenue.inc_vat = Number(h.total_revenue_inc_vat ?? h.total_revenue ?? 0)
      hourly[idx]!.revenue.vat = Number(h.total_vat ?? 0)
      hourly[idx]!.quantity = Number(h.total_quantity ?? 0)
    }
  }
  for (const h of borkOrderHours) {
    const idx = Number(h.business_hour)
    if (idx >= 0 && idx < 24) {
      orderHourly[idx]!.revenue.ex_vat = Number(h.total_revenue_ex_vat ?? 0)
      orderHourly[idx]!.revenue.inc_vat = Number(h.total_revenue_inc_vat ?? h.total_revenue ?? 0)
      orderHourly[idx]!.revenue.vat = Number(h.total_vat ?? 0)
      orderHourly[idx]!.quantity = Number(h.total_quantity ?? 0)
    }
  }

  const intraday = inboxRows.map((r) => ({
    cron_hour: Number(r.cron_hour ?? 0),
    received_at: r.received_at instanceof Date ? r.received_at : new Date(r.received_at ?? Date.now()),
    revenue_ex_vat: Number(r.final_revenue_ex_vat ?? 0),
    revenue_inc_vat: Number(r.final_revenue_incl_vat ?? r.final_revenue_inc_vat ?? 0),
  }))

  if (DEBUG) {
    console.info(
      `[snapshot:build] ${businessDate} ${locationName} | revenue | leadSource=${leadSource} bork_ex=${borkTotals.ex_vat.toFixed(2)} paidHours=${borkHours.length} orderHours=${borkOrderHours.length} inbox=${inboxRows.length}`
    )
  }

  return {
    schema_version: 1,
    businessDate,
    locationId,
    locationName,
    leadSource,
    totals,
    hourly,
    orderHourly,
    intraday,
    borkTotals,
    lastBuiltAt: new Date(),
  }
}
