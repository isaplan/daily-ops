/**
 * @registry-id: dailyOpsVenueStripSnapshotBatch
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-06-10T00:00:00.000Z
 * @description: Batch snapshot reads + venue card assembly for venue strip
 * @last-fix: [2026-06-10] Range batch loader for multi-day venue strip rollups
 * @adr-ref: ADR-004, ADR-010
 */

import type { Db } from 'mongodb'
import type { VenueStripCardDto } from '~/types/daily-ops-dashboard'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotLaborSection,
  type DailyOpsSnapshotRevenueProductsSection,
  type DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from './constants'
import { buildVenueActiveWorkers } from './activeWorkers'
import type { CheckInRow } from './checkIns'
import { loadMemberCompensationForStaffRows } from '../eitjeAggCompensationEnrich'
import { enrichLaborWithPct, productivityPerHour, resolveVenueStripLabor } from './labor'
import { contractsByTeamFromSnapshot, revenueFromSnapshotSections } from './revenue'
import { fetchVenueStripLiveRevenue, isTodayBusinessDate } from './liveRevenue'
import type { WorkerShiftTimeMaps } from './workerShiftTimes'

export type VenueStripSnapshotBatch = {
  revenueByLoc: Map<string, DailyOpsSnapshotRevenueSection>
  laborByLoc: Map<string, DailyOpsSnapshotLaborSection>
  productsByLoc: Map<string, DailyOpsSnapshotRevenueProductsSection>
}

export async function loadVenueStripSnapshotBatch(
  db: Db,
  businessDate: string,
): Promise<VenueStripSnapshotBatch> {
  const locationIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const filter = { businessDate, locationId: { $in: locationIds } }
  const [revenueDocs, laborDocs, productDocs] = await Promise.all([
    db
      .collection<DailyOpsSnapshotRevenueSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotLaborSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueProductsSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection)
      .find(filter)
      .toArray(),
  ])
  return {
    revenueByLoc: new Map(revenueDocs.map((d) => [d.locationId, d])),
    laborByLoc: new Map(laborDocs.map((d) => [d.locationId, d])),
    productsByLoc: new Map(productDocs.map((d) => [d.locationId, d])),
  }
}

function batchFromDocs(
  revenueDocs: DailyOpsSnapshotRevenueSection[],
  laborDocs: DailyOpsSnapshotLaborSection[],
  productDocs: DailyOpsSnapshotRevenueProductsSection[],
): VenueStripSnapshotBatch {
  return {
    revenueByLoc: new Map(revenueDocs.map((d) => [d.locationId, d])),
    laborByLoc: new Map(laborDocs.map((d) => [d.locationId, d])),
    productsByLoc: new Map(productDocs.map((d) => [d.locationId, d])),
  }
}

/** Batch-load snapshot sections for every day in an inclusive business_date range. */
export async function loadVenueStripSnapshotBatchesForRange(
  db: Db,
  startDate: string,
  endDate: string,
): Promise<Map<string, VenueStripSnapshotBatch>> {
  const locationIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const filter = {
    businessDate: { $gte: startDate, $lte: endDate },
    locationId: { $in: locationIds },
  }
  const [revenueDocs, laborDocs, productDocs] = await Promise.all([
    db
      .collection<DailyOpsSnapshotRevenueSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotLaborSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueProductsSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection)
      .find(filter)
      .toArray(),
  ])

  const dates = new Set<string>()
  for (const d of revenueDocs) dates.add(d.businessDate)
  for (const d of laborDocs) dates.add(d.businessDate)
  for (const d of productDocs) dates.add(d.businessDate)

  const out = new Map<string, VenueStripSnapshotBatch>()
  for (const date of dates) {
    out.set(
      date,
      batchFromDocs(
        revenueDocs.filter((d) => d.businessDate === date),
        laborDocs.filter((d) => d.businessDate === date),
        productDocs.filter((d) => d.businessDate === date),
      ),
    )
  }
  return out
}

export async function buildVenueStripCardFromSnapshots(
  db: Db,
  ctx: DailyOpsMetricsContext,
  venue: { locationId: string; locationName: string },
  batch: VenueStripSnapshotBatch,
  shiftTimeMaps: WorkerShiftTimeMaps,
  checkInRows: CheckInRow[],
): Promise<VenueStripCardDto> {
  const snapRev = batch.revenueByLoc.get(venue.locationId) ?? null
  const snapLabor = batch.laborByLoc.get(venue.locationId) ?? null
  const snapProducts = batch.productsByLoc.get(venue.locationId) ?? null

  const { totalRevenue, food, beverage, totalIncVat, foodIncVat, beverageIncVat } =
    revenueFromSnapshotSections(snapRev, snapProducts)

  let revenue = {
    total: totalRevenue,
    food,
    beverage,
    totalIncVat,
    foodIncVat,
    beverageIncVat,
  }

  if (isTodayBusinessDate(ctx.startDate)) {
    const live = await fetchVenueStripLiveRevenue(db, ctx.startDate, venue.locationId)
    if (live) revenue = live
  }

  const headlineTotal = revenue.total
  const locationName = snapLabor?.locationName ?? snapRev?.locationName ?? venue.locationName

  const [laborBundle, contractsByTeam, memberComp] = await Promise.all([
    resolveVenueStripLabor(db, snapLabor, ctx.startDate, venue.locationId, shiftTimeMaps, checkInRows),
    Promise.resolve(contractsByTeamFromSnapshot(snapLabor)),
    loadMemberCompensationForStaffRows(db, checkInRows),
  ])

  const laborWithPct = enrichLaborWithPct(laborBundle.labor, headlineTotal)
  const active = buildVenueActiveWorkers(venue.locationId, ctx.startDate, checkInRows, memberComp)

  return {
    locationId: venue.locationId,
    locationName,
    revenue,
    labor: laborWithPct,
    workers: laborBundle.workers,
    active,
    productivity: {
      totalPerHour: productivityPerHour(headlineTotal, laborWithPct.gewerkt.hours),
      keukenPerHour: productivityPerHour(revenue.food, laborWithPct.keuken.hours),
      bedieningPerHour: productivityPerHour(revenue.beverage, laborWithPct.bediening.hours),
    },
    contractsByTeam,
    coverage: {
      hasRevenue: headlineTotal > 0 || revenue.food > 0 || revenue.beverage > 0,
      hasLabor: laborWithPct.all.hours > 0,
      snapshotBuilt: !!snapLabor || !!snapRev,
    },
  }
}
