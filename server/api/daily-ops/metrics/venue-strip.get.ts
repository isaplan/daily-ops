/**
 * @registry-id: dailyOpsVenueStripGet
 * @created: 2026-05-16T23:30:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: GET /api/daily-ops/metrics/venue-strip — read dashboard-bundle cache (ADR-013)
 * @last-fix: [2026-07-02] Mongo read-cache lookup via loadCachedVenueStrip(db)
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle · venueStrip slice
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsVenueStrip.vue
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { buildVenueStripResponse } from '../../../utils/dailyOpsVenueStrip'
import type { VenueStripResponseDto } from '~/types/daily-ops-dashboard'
import { loadCachedVenueStrip } from '../../../utils/dailyOpsSnapshot/cacheCascade'
import { snapshotCacheControl } from '../../../utils/dailyOpsSnapshot/dashboardBundle/snapshotCacheControl'

export default defineEventHandler(async (event): Promise<VenueStripResponseDto> => {
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseDailyOpsMetricsQuery(q)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  const db = await getDb()
  const cached = await loadCachedVenueStrip(db, ctx)
  if (cached) {
    console.info(`[venue-strip:cache] HIT ${ctx.startDate}..${ctx.endDate}`)
    return cached
  }

  return buildVenueStripResponse(db, ctx)
})
