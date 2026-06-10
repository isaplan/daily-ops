/**
 * @registry-id: dailyOpsVenueStripGet
 * @created: 2026-05-16T23:30:00.000Z
 * @last-modified: 2026-05-16T23:30:00.000Z
 * @description: GET /api/daily-ops/metrics/venue-strip — 3-venue KPI strip for Today/Yesterday.
 * @last-fix: [2026-05-16] Initial v1.
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsVenueStrip.vue
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { buildVenueStripResponse } from '../../../utils/dailyOpsVenueStrip'
import type { VenueStripResponseDto } from '~/types/daily-ops-dashboard'
import { loadCachedVenueStrip } from '../../../utils/dailyOpsSnapshot/cacheCascade'
import { snapshotCacheControl } from '../../../utils/dailyOpsSnapshot/fetchDashboardBundle'

export default defineEventHandler(async (event): Promise<VenueStripResponseDto> => {
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseDailyOpsMetricsQuery(q)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  const cached = await loadCachedVenueStrip(ctx)
  if (cached) {
    console.info(`[venue-strip:cache] HIT ${ctx.startDate}..${ctx.endDate}`)
    return cached
  }

  const db = await getDb()
  return buildVenueStripResponse(db, ctx)
})
