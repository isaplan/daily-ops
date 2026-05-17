/**
 * @registry-id: dailyOpsSnapshotBuildRevenueSection
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-13T09:20:00.000Z
 * @description: Builds DailyOpsSnapshotRevenueSection for one (businessDate, locationId).
 *   Reads only from aggregated collections: bork_business_days, bork_sales_by_hour,
 *   inbox-bork-basis-report. Never touches bork_raw_data.
 * @last-fix: [2026-05-13] Coerce DEBUG to string before .includes (boolean env).
 *
 * @architecture:
 *   - Lead-source decision: if any inbox row exists for (businessDate, locationId), inbox wins
 *     for headline `totals`. Otherwise bork V2 wins. borkTotals always populated for cross-check.
 *   - Hourly: pre-fill 24 slots (business_hour 0..23 → calendar_hour 8..7-next). Sourced from
 *     bork_sales_by_hour. No intraday inbox per-hour split (inbox is daily-level).
 *   - Intraday: capture each inbox poll (cron_hour 18/23 for same-day, 8 for next-morning seal).
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

const DEBUG = String(process.env.DEBUG ?? '').includes('snapshot:build')

export type BuildRevenueInput = {
  businessDate: string
  locationId: string
  locationName: string
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

  const [borkDay, borkHours, inboxRows] = await Promise.all([
    locOid ? db.collection('bork_business_days').findOne(borkFilter) : null,
    locOid
      ? db
          .collection('bork_sales_by_hour')
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

  const sealedInbox = inboxRows.find((r) => r.cron_hour === 8)
  const latestInbox = inboxRows[inboxRows.length - 1] ?? null
  const leadInbox = sealedInbox ?? latestInbox

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
    const inc = Number(leadInbox.final_revenue_incl_vat ?? leadInbox.final_revenue_inc_vat ?? 0)
    totals = { ex_vat: ex, inc_vat: inc, vat: inc - ex, quantity: 0, record_count: 0 }
  } else if (borkDay) {
    leadSource = 'bork'
    totals = borkTotals
  }

  const hourly = Array.from({ length: 24 }, (_, business_hour) => ({
    business_hour,
    calendar_hour: (business_hour + 8) % 24,
    revenue: { ex_vat: 0, inc_vat: 0, vat: 0 } as RevenueBreakdown,
    quantity: 0,
  }))
  for (const h of borkHours) {
    const idx = Number(h.business_hour)
    if (idx >= 0 && idx < 24) {
      hourly[idx]!.revenue.ex_vat = Number(h.total_revenue_ex_vat ?? 0)
      hourly[idx]!.revenue.inc_vat = Number(h.total_revenue_inc_vat ?? h.total_revenue ?? 0)
      hourly[idx]!.revenue.vat = Number(h.total_vat ?? 0)
      hourly[idx]!.quantity = Number(h.total_quantity ?? 0)
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
      `[snapshot:build] ${businessDate} ${locationName} | revenue | leadSource=${leadSource} bork_ex=${borkTotals.ex_vat.toFixed(2)} hours=${borkHours.length} inbox=${inboxRows.length}`
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
    intraday,
    borkTotals,
    lastBuiltAt: new Date(),
  }
}
