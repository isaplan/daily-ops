/**
 * @registry-id: dailyOpsVenueStripSnapshotBatch
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-06-07T01:00:00.000Z
 * @description: Batch snapshot reads + venue card assembly for venue strip
 * @last-fix: [2026-06-07] Open day revenue via liveRevenue (aggregate + raw max, ADR-010)
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
import { enrichLaborWithPct, productivityPerHour, resolveVenueStripLabor } from './labor'
import { fetchVenueStripLiveRevenue } from './liveRevenue'
import { contractsByTeamFromSnapshot, revenueFromSnapshotSections } from './revenue'
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

export async function buildVenueStripCardFromSnapshots(
  db: Db,
  ctx: DailyOpsMetricsContext,
  venue: { locationId: string; locationName: string },
  batch: VenueStripSnapshotBatch,
  shiftTimeMaps: WorkerShiftTimeMaps,
): Promise<VenueStripCardDto> {
  const snapRev = batch.revenueByLoc.get(venue.locationId) ?? null
  const snapLabor = batch.laborByLoc.get(venue.locationId) ?? null
  const snapProducts = batch.productsByLoc.get(venue.locationId) ?? null

  const { totalRevenue, food, beverage, totalIncVat, foodIncVat, beverageIncVat } =
    revenueFromSnapshotSections(snapRev, snapProducts)

  const liveRevenue = await fetchVenueStripLiveRevenue(db, ctx.startDate, venue.locationId)
  const revenue = liveRevenue ?? {
    total: totalRevenue,
    food,
    beverage,
    totalIncVat,
    foodIncVat,
    beverageIncVat,
  }

  const headlineTotal = revenue.total
  const locationName = snapLabor?.locationName ?? snapRev?.locationName ?? venue.locationName

  const [laborBundle, contractsByTeam] = await Promise.all([
    resolveVenueStripLabor(db, snapLabor, ctx.startDate, venue.locationId, shiftTimeMaps),
    Promise.resolve(contractsByTeamFromSnapshot(snapLabor)),
  ])

  const laborWithPct = enrichLaborWithPct(laborBundle.labor, headlineTotal)

  return {
    locationId: venue.locationId,
    locationName,
    revenue,
    labor: laborWithPct,
    workers: laborBundle.workers,
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
