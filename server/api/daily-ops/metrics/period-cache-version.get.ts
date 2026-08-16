/**
 * @registry-id: dailyOpsPeriodCacheVersionGet
 * @created: 2026-08-16T15:55:00.000Z
 * @last-modified: 2026-08-16T15:55:00.000Z
 * @description: Light period-cache version for client freshness (max lastBuiltAt + finance seals)
 * @last-fix: [2026-08-16] Client cache revalidate without full bundle GET
 * @adr-ref: ADR-004, ADR-013, ADR-022, PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache
 *
 * @exports-to:
 * ✓ composables/useDailyOpsClientMetricsCache.ts
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { DAILY_OPS_PERIOD_CACHE_COLLECTION } from '../../../utils/dailyOpsPeriodCache/store'
import { VENUE_STRIP_LOCATIONS } from '../../../utils/venueStrip/constants'

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const db = await getDb()
  const locationIds = [
    'all',
    ...VENUE_STRIP_LOCATIONS.map((v) => v.locationId),
  ]

  const startMonth = ctx.startDate.slice(0, 7)
  const endMonth = ctx.endDate.slice(0, 7)

  const rows = await db
    .collection(DAILY_OPS_PERIOD_CACHE_COLLECTION)
    .find(
      {
        locationId: { $in: locationIds },
        $or: [
          {
            level: 'day',
            periodKey: { $gte: ctx.startDate, $lte: ctx.endDate },
          },
          {
            level: 'month',
            periodKey: { $gte: startMonth, $lte: endMonth },
          },
        ],
      },
      { projection: { locationId: 1, provenance: 1, status: 1, level: 1, periodKey: 1, 'ratios.source': 1 } },
    )
    .toArray()

  let latestMs = 0
  let financeSealedMonths = 0

  for (const row of rows) {
    const built = Date.parse(String((row as { provenance?: { lastBuiltAt?: string } }).provenance?.lastBuiltAt ?? ''))
    if (Number.isFinite(built) && built > latestMs) latestMs = built

    if (row.level === 'month' && row.locationId === 'all') {
      if (
        row.status === 'finance_sealed'
        || (row as { ratios?: { source?: string } }).ratios?.source === 'finance_sealed'
      ) {
        financeSealedMonths += 1
      }
    }
  }

  return {
    period: ctx.period,
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    version: latestMs > 0 ? new Date(latestMs).toISOString() : null,
    financeSealedMonths,
  }
})
