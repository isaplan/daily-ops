/**
 * @registry-id: dailyOpsVenueStripSnapshotBatch
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Batch snapshot reads + venue card assembly for venue strip
 * @adr-ref: ADR-004
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
import { contractsByTeamFromSnapshot, revenueFromSnapshotSections } from './revenue'

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
): Promise<VenueStripCardDto> {
  const snapRev = batch.revenueByLoc.get(venue.locationId) ?? null
  const snapLabor = batch.laborByLoc.get(venue.locationId) ?? null
  const snapProducts = batch.productsByLoc.get(venue.locationId) ?? null

  const { totalRevenue, food, beverage } = revenueFromSnapshotSections(snapRev, snapProducts)

  const [laborBundle, contractsByTeam] = await Promise.all([
    resolveVenueStripLabor(db, snapLabor),
    Promise.resolve(contractsByTeamFromSnapshot(snapLabor)),
  ])

  const laborWithPct = enrichLaborWithPct(laborBundle.labor, totalRevenue)
  const locationName = snapLabor?.locationName ?? snapRev?.locationName ?? venue.locationName

  return {
    locationId: venue.locationId,
    locationName,
    revenue: { total: totalRevenue, food, beverage },
    labor: laborWithPct,
    workers: laborBundle.workers,
    productivity: {
      totalPerHour: productivityPerHour(totalRevenue, laborWithPct.gewerkt.hours),
      keukenPerHour: productivityPerHour(food, laborWithPct.keuken.hours),
      bedieningPerHour: productivityPerHour(beverage, laborWithPct.bediening.hours),
    },
    contractsByTeam,
    coverage: {
      hasRevenue: totalRevenue > 0 || food > 0 || beverage > 0,
      hasLabor: laborWithPct.all.hours > 0,
      snapshotBuilt: !!snapLabor || !!snapRev,
    },
  }
}
