/**
 * @registry-id: dailyOpsMetricsBreakEvenGet
 * @created: 2026-07-24T11:35:00.000Z
 * @last-modified: 2026-08-09T00:30:00.000Z
 * @last-fix: [2026-08-09] GET reads period-cache only (PERIOD_CACHE_ADR L2/L4)
 * @adr-ref: PERIOD_CACHE_ADR L2, L3, L4
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 * ✓ components/daily-ops/DailyOpsVenueStrip.vue
 * ✓ components/daily-ops/revenue/RevenuePnLCard.vue
 */

import { getDb } from '../../../utils/db'
import {
  resolveBreakEvenBundleFromPeriodCache,
  resolveBreakEvenFromPeriodCache,
} from '../../../utils/dailyOpsPeriodCache/resolveBreakEvenFromPeriodCache'
import type { DailyOpsBreakEvenBundleDto, DailyOpsBreakEvenDto } from '~/types/break-even'

function parseVenueRevenue (raw: unknown): Record<string, number> | undefined {
  if (raw == null || raw === '') return undefined
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v)
      if (Number.isFinite(n)) out[k] = n
    }
    return out
  }
  if (typeof raw === 'string') {
    try {
      return parseVenueRevenue(JSON.parse(raw))
    } catch {
      return undefined
    }
  }
  return undefined
}

export default defineEventHandler(async (event): Promise<DailyOpsBreakEvenDto | DailyOpsBreakEvenBundleDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const period = String(q.period ?? 'today')
  const anchor = q.anchor != null && String(q.anchor) !== '' ? String(q.anchor) : null
  const locationId = q.locationId != null && String(q.locationId) !== '' ? String(q.locationId) : null
  const revenue = Number(q.revenue ?? 0)
  const includePct = q.includePct !== 'false' && q.includePct !== false
  const includeVenues = q.includeVenues === 'true' || q.includeVenues === true || q.includeVenues === '1'
  const dayCountRaw = q.dayCount != null ? Number(q.dayCount) : null
  const dayCount = dayCountRaw != null && Number.isFinite(dayCountRaw) && dayCountRaw > 0
    ? Math.round(dayCountRaw)
    : null
  const venueRevenueByLocationId = parseVenueRevenue(q.venueRevenue)

  const db = await getDb()
  const input = {
    period,
    anchor,
    locationId,
    revenue: Number.isFinite(revenue) ? revenue : 0,
    includePct,
    dayCount,
    venueRevenueByLocationId,
  }

  if (includeVenues) return resolveBreakEvenBundleFromPeriodCache(db, input)
  return resolveBreakEvenFromPeriodCache(db, input)
})
