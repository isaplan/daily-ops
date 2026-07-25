/**
 * @registry-id: dailyOpsMetricsRevenueAveragesGet
 * @created: 2026-07-25T11:20:00.000Z
 * @last-modified: 2026-07-25T11:20:00.000Z
 * @description: GET rolling revenue averages + YoY (lazy KPI / venue strip)
 * @last-fix: [2026-07-25] Snapshot-only; optional current revenue map from client
 * @adr-ref: ADR-004, ADR-006
 * @data-source: snapshot
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueAverages.ts
 */

import { getDb } from '../../../utils/db'
import { fetchRevenueAverages } from '../../../utils/dailyOpsMetrics/fetchRevenueAverages'
import type { DailyOpsRevenueAveragesDto } from '~/types/revenue-averages'

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

export default defineEventHandler(async (event): Promise<DailyOpsRevenueAveragesDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const period = String(q.period ?? 'today')
  const anchor = q.anchor != null && String(q.anchor) !== '' ? String(q.anchor) : null
  const combinedRaw = q.revenue != null ? Number(q.revenue) : null
  const combinedRevenue = combinedRaw != null && Number.isFinite(combinedRaw) ? combinedRaw : undefined

  const db = await getDb()
  return fetchRevenueAverages(db, {
    period,
    anchor,
    currentRevenueByLocationId: parseVenueRevenue(q.venueRevenue),
    combinedRevenue,
  })
})
