/**
 * @registry-id: dailyOpsVenueStripRangeRollup
 * @created: 2026-06-10T00:00:00.000Z
 * @last-modified: 2026-06-10T00:00:00.000Z
 * @description: Fast multi-day venue strip from snapshot sections (no per-day DB round-trips)
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueStrip.ts
 */

import type { Db } from 'mongodb'
import type { VenueStripCardDto, VenueStripResponseDto } from '~/types/daily-ops-dashboard'
import type {
  DailyOpsSnapshotLaborSection,
  DailyOpsSnapshotRevenueProductsSection,
  DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from './constants'
import { enrichLaborWithPct, laborBlockFromSnapshotSection, productivityPerHour } from './labor'
import { mergeVenueStripCards } from './mergeCards'
import { contractsByTeamFromSnapshot, revenueFromSnapshotSections } from './revenue'
import { loadVenueStripSnapshotBatchesForRange } from './snapshotBatch'

function emptyVenueCard(venue: { locationId: string; locationName: string }): VenueStripCardDto {
  const row = { workers: 0, hours: 0, wages: 0, loaded: 0, laborPctOfRevenue: null as number | null }
  return {
    locationId: venue.locationId,
    locationName: venue.locationName,
    revenue: {
      total: 0,
      food: 0,
      beverage: 0,
      totalIncVat: 0,
      foodIncVat: 0,
      beverageIncVat: 0,
    },
    labor: { all: row, gewerkt: row, keuken: row, bediening: row, other: row },
    workers: [],
    active: { workers: 0, rows: [] },
    productivity: { totalPerHour: null, keukenPerHour: null, bedieningPerHour: null },
    contractsByTeam: { keuken: [], bediening: [], other: [] },
    coverage: { hasRevenue: false, hasLabor: false, snapshotBuilt: false },
  }
}

function buildDayCardFromBatch(
  venue: { locationId: string; locationName: string },
  rev: DailyOpsSnapshotRevenueSection | undefined,
  labor: DailyOpsSnapshotLaborSection | undefined,
  products: DailyOpsSnapshotRevenueProductsSection | undefined,
): VenueStripCardDto {
  const revenueParts = revenueFromSnapshotSections(rev ?? null, products ?? null)
  const revenue = {
    total: revenueParts.totalRevenue,
    food: revenueParts.food,
    beverage: revenueParts.beverage,
    totalIncVat: revenueParts.totalIncVat,
    foodIncVat: revenueParts.foodIncVat,
    beverageIncVat: revenueParts.beverageIncVat,
  }
  const laborBlock = enrichLaborWithPct(laborBlockFromSnapshotSection(labor ?? null), revenue.total)
  const locationName = labor?.locationName ?? rev?.locationName ?? venue.locationName

  return {
    locationId: venue.locationId,
    locationName,
    revenue,
    labor: laborBlock,
    workers: [],
    active: { workers: 0, rows: [] },
    productivity: {
      totalPerHour: productivityPerHour(revenue.total, laborBlock.gewerkt.hours),
      keukenPerHour: productivityPerHour(revenue.food, laborBlock.keuken.hours),
      bedieningPerHour: productivityPerHour(revenue.beverage, laborBlock.bediening.hours),
    },
    contractsByTeam: contractsByTeamFromSnapshot(labor ?? null),
    coverage: {
      hasRevenue: revenue.total > 0 || revenue.food > 0 || revenue.beverage > 0,
      hasLabor: laborBlock.all.hours > 0,
      snapshotBuilt: !!labor || !!rev,
    },
  }
}

/** Snapshot-only range rollup — 3 queries total, no per-day async labor resolution. */
export async function buildVenueStripRangeRollup(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<VenueStripResponseDto> {
  const batchesByDate = await loadVenueStripSnapshotBatchesForRange(db, ctx.startDate, ctx.endDate)

  const venues = VENUE_STRIP_LOCATIONS.map((venue) => {
    const dailyCards: VenueStripCardDto[] = []

    for (const batch of batchesByDate.values()) {
      const rev = batch.revenueByLoc.get(venue.locationId)
      const labor = batch.laborByLoc.get(venue.locationId)
      const products = batch.productsByLoc.get(venue.locationId)
      if (!rev && !labor && !products) continue
      dailyCards.push(buildDayCardFromBatch(venue, rev, labor, products))
    }

    if (dailyCards.length === 0) return emptyVenueCard(venue)
    if (dailyCards.length === 1) return dailyCards[0]!
    return mergeVenueStripCards(dailyCards)
  })

  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    venues,
  }
}
