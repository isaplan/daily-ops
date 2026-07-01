/**
 * @registry-id: dailyOpsSnapshotBuildRevenueSection
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-07-01T21:30:00.000Z
 * @description: Builds DailyOpsSnapshotRevenueSection for one (businessDate, locationId).
 *   Reads only from aggregated collections: bork_business_days, bork_sales_by_hour,
 *   inbox-bork-basis-report. Never touches bork_raw_data.
 * @last-fix: [2026-07-01] Open register day headline = order-time hour sum; sealed days = inbox/paid SSOT
 *   Prior: [2026-06-24] Datalab daily benchmark fallback when inbox/Bork agg missing (2024 history)
 *   Prior: [2026-05-26] Snapshot carries order-time hourly Bork buckets beside paid-time buckets.
 *   Prior: [2026-05-25] Bork reads use resolveBorkAggReadSuffix (_v2) like products/hourly builders.
 *
 * @architecture:
 *   - Headline: open register day → sum `bork_sales_by_order_hour` (order-entry time).
 *     Sealed days → `resolveVenueDayHeadlineRevenue` (morning inbox 7|8 or paid Bork).
 *   - Hourly: pre-fill 24 slots (business_hour 0..23 → calendar_hour 8..7-next). Paid-time
 *     buckets come from bork_sales_by_hour; order-time buckets come from bork_sales_by_order_hour.
 *     No intraday inbox per-hour split (inbox is daily-level).
 *   - Intraday inbox rows are not stored in Mongo (dropped on ingest).
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
import {
  resolveVenueDayHeadlineRevenue,
  type BasisReportData,
} from '../inbox/basis-report-mapper'
import { readRevenueDailyBenchmark } from '../revenueDailyBenchmarkService'
import { sumBorkOrderHourDocs } from '../dailyOpsRevenue/orderTimeHeadline'
import { isOpenRegisterBusinessDate } from '~/utils/dailyOpsBusinessDate'

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

  const benchmarkRow = await readRevenueDailyBenchmark(db, businessDate, locationId)
  const benchmark = benchmarkRow
    ? {
        ex_vat: benchmarkRow.ex_vat,
        inc_vat: benchmarkRow.inc_vat,
        vat: benchmarkRow.vat,
        quantity: benchmarkRow.quantity,
        record_count: 0,
      }
    : null

  const orderTotals = sumBorkOrderHourDocs(borkOrderHours)
  const isOpenRegisterToday = isOpenRegisterBusinessDate(businessDate)

  const headline = isOpenRegisterToday
    ? {
        leadSource: 'bork' as const,
        morningInbox: undefined,
        totals: {
          ex_vat: orderTotals.ex_vat,
          inc_vat: orderTotals.inc_vat,
          vat: orderTotals.vat,
          quantity: orderTotals.quantity,
          record_count: orderTotals.record_count,
        },
      }
    : resolveVenueDayHeadlineRevenue({
        inboxReports: inboxRows as unknown as BasisReportData[],
        bork: borkTotals,
        hasBorkDay: borkDay != null,
        benchmark,
      })
  const leadSource = headline.leadSource as LeadRevenueSource
  const totals = headline.totals

  const sealedBorkTotals = isOpenRegisterToday
    ? {
        ex_vat: orderTotals.ex_vat,
        inc_vat: orderTotals.inc_vat,
        vat: orderTotals.vat,
        quantity: orderTotals.quantity,
        record_count: orderTotals.record_count,
      }
    : leadSource === 'datalab_benchmark' && benchmark
      ? {
          ex_vat: benchmark.ex_vat,
          inc_vat: benchmark.inc_vat,
          vat: benchmark.vat,
          quantity: benchmark.quantity,
          record_count: 0,
        }
      : borkTotals

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

  const intraday: DailyOpsSnapshotRevenueSection['intraday'] = []

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
    borkTotals: sealedBorkTotals,
    lastBuiltAt: new Date(),
  }
}
