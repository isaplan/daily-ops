/**
 * @registry-id: dailyOpsRevenueCoOccurrenceGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Product co-occurrence — read-cache target (ADR-013, reserved)
 * @last-fix: [2026-07-02] ADR-013 reserved read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache (reserved - page not built yet)
 * @read-cache-json: daily_ops_read_cache · profile=revenue-co-occurrence · levels=daily
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueMetrics.ts
 */

import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchCoOccurrence } from '../../../utils/dailyOpsRevenue/fetchCoOccurrence'
import type { DailyOpsRevenueCoOccurrenceDto } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueCoOccurrenceDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseRevenueQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return fetchCoOccurrence(db, ctx)
})
