/**
 * @registry-id: dailyOpsVenueStrip
 * @created: 2026-05-16T23:30:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Builds per-venue KPI cards for the Daily Ops venue strip (3 fixed locations, single day).
 * @last-fix: [2026-05-28] Split into venueStrip/* modules; snapshot-only GET (ADR-004/006)
 * @adr-ref: ADR-004, ADR-006
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/venue-strip.get.ts
 */

import type { Db } from 'mongodb'
import type { VenueStripCardDto, VenueStripResponseDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from './dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from './venueStrip/constants'
import { buildVenueStripCardFromSnapshots, loadVenueStripSnapshotBatch } from './venueStrip/snapshotBatch'

/** @deprecated Use buildVenueStripResponse — kept for tests/callers that build one card. */
export async function buildVenueStripCard(
  db: Db,
  ctx: DailyOpsMetricsContext,
  venue: { locationId: string; locationName: string },
): Promise<VenueStripCardDto> {
  const batch = await loadVenueStripSnapshotBatch(db, ctx.startDate)
  return buildVenueStripCardFromSnapshots(db, ctx, venue, batch)
}

export async function buildVenueStripResponse(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<VenueStripResponseDto> {
  const batch = await loadVenueStripSnapshotBatch(db, ctx.startDate)
  const venues = await Promise.all(
    VENUE_STRIP_LOCATIONS.map((v) => buildVenueStripCardFromSnapshots(db, ctx, v, batch)),
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
