/**
 * @registry-id: dailyOpsVenueStrip
 * @created: 2026-05-16T23:30:00.000Z
 * @last-modified: 2026-06-10T00:00:00.000Z
 * @description: Builds per-venue KPI cards for the Daily Ops venue strip (3 fixed locations).
 * @last-fix: [2026-06-10] Fast snapshot rollup for multi-day ranges (fixes year timeout)
 *   Prior: [2026-06-10] Multi-day range rollups via snapshot batch merge
 * @adr-ref: ADR-004, ADR-006
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/venue-strip.get.ts
 */

import type { Db } from 'mongodb'
import type { VenueStripCardDto, VenueStripResponseDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from './dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from './venueStrip/constants'
import { buildVenueStripRangeRollup } from './venueStrip/rangeRollup'
import {
  buildVenueStripCardFromSnapshots,
  loadVenueStripSnapshotBatch,
} from './venueStrip/snapshotBatch'
import { fetchVenueStripCheckIns } from './venueStrip/checkIns'
import { fetchWorkerShiftTimeMaps } from './venueStrip/workerShiftTimes'

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

async function buildVenueStripSingleDayResponse(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<VenueStripResponseDto> {
  const batch = await loadVenueStripSnapshotBatch(db, ctx.startDate)
  const locationIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const [shiftTimeMaps, checkInRows] = await Promise.all([
    fetchWorkerShiftTimeMaps(db, ctx.startDate, locationIds),
    fetchVenueStripCheckIns(db, ctx.startDate, locationIds),
  ])
  const venues = await Promise.all(
    VENUE_STRIP_LOCATIONS.map((v) =>
      buildVenueStripCardFromSnapshots(db, ctx, v, batch, shiftTimeMaps, checkInRows),
    ),
  )
  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    venues,
  }
}

/** @deprecated Use buildVenueStripResponse — kept for tests/callers that build one card. */
export async function buildVenueStripCard(
  db: Db,
  ctx: DailyOpsMetricsContext,
  venue: { locationId: string; locationName: string },
): Promise<VenueStripCardDto> {
  const response = await buildVenueStripSingleDayResponse(db, ctx)
  return response.venues.find((v) => v.locationId === venue.locationId) ?? emptyVenueCard(venue)
}

export async function buildVenueStripResponse(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<VenueStripResponseDto> {
  if (ctx.startDate === ctx.endDate) {
    return buildVenueStripSingleDayResponse(db, ctx)
  }
  return buildVenueStripRangeRollup(db, ctx)
}
