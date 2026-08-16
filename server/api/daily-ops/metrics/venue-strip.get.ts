/**
 * @registry-id: dailyOpsVenueStripGet
 * @created: 2026-05-16T23:30:00.000Z
 * @last-modified: 2026-08-16T15:55:00.000Z
 * @description: GET /api/daily-ops/metrics/venue-strip — Today live strip; sealed = strip-only period-cache
 * @last-fix: [2026-08-16] Sealed periods: strip-only assemble (no full dashboard bundle)
 *   Prior: [2026-08-16] Today = strip-only build (no full dashboard bundle)
 * @adr-ref: ADR-004, ADR-010, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: snapshot-today-live | period-cache
 * @read-cache-json: daily_ops_period_cache · level=day (sealed only)
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsVenueStrip.vue
 * ✓ composables/useDailyOpsVenueStripMetrics.ts
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import type { VenueStripResponseDto } from '~/types/daily-ops-dashboard'
import { assembleVenueStripFromPeriodCache } from '../../../utils/dailyOpsPeriodCache/assembleDashboardBundleFromPeriodCache'
import { isOpenRegisterTodayContext } from '../../../utils/dailyOpsSnapshot/loadDashboardBundleForGet'
import { buildVenueStripResponse } from '../../../utils/dailyOpsVenueStrip'
import { snapshotCacheControl } from '../../../utils/dailyOpsSnapshot/dashboardBundle/snapshotCacheControl'
import { VENUE_STRIP_LOCATIONS } from '../../../utils/venueStrip/constants'

function emptyStrip (ctx: { period: string; startDate: string; endDate: string }): VenueStripResponseDto {
  return {
    range: {
      period: ctx.period as VenueStripResponseDto['range']['period'],
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    venues: VENUE_STRIP_LOCATIONS.map((v) => ({
      locationId: v.locationId,
      locationName: v.locationName,
      revenue: {
        total: 0,
        food: 0,
        beverage: 0,
        totalIncVat: 0,
        foodIncVat: 0,
        beverageIncVat: 0,
      },
      labor: {
        all: { workers: 0, hours: 0, wages: 0, loaded: 0, laborPctOfRevenue: null },
        gewerkt: { workers: 0, hours: 0, wages: 0, loaded: 0, laborPctOfRevenue: null },
        keuken: { workers: 0, hours: 0, wages: 0, loaded: 0, laborPctOfRevenue: null },
        bediening: { workers: 0, hours: 0, wages: 0, loaded: 0, laborPctOfRevenue: null },
        other: { workers: 0, hours: 0, wages: 0, loaded: 0, laborPctOfRevenue: null },
      },
      workers: [],
      active: { workers: 0, rows: [] },
      productivity: { totalPerHour: null, keukenPerHour: null, bedieningPerHour: null },
      contractsByTeam: { keuken: [], bediening: [], other: [] },
      coverage: { hasRevenue: false, hasLabor: false, snapshotBuilt: false },
    })),
  }
}

export default defineEventHandler(async (event): Promise<VenueStripResponseDto & { cacheVersion?: string | null }> => {
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseDailyOpsMetricsQuery(q)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  const db = await getDb()

  if (isOpenRegisterTodayContext(ctx)) {
    const strip = await buildVenueStripResponse(db, ctx)
    return { ...strip, cacheVersion: null }
  }

  const strip = await assembleVenueStripFromPeriodCache(db, ctx)
  if (strip.venues?.length) return strip
  return { ...emptyStrip(ctx), cacheVersion: null }
})
