/**
 * @registry-id: dailyOpsRevenueProductsGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Top revenue products — read-cache target (ADR-013, reserved)
 * @last-fix: [2026-07-02] ADR-013 reserved read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache (reserved - page not built yet)
 * @read-cache-json: daily_ops_read_cache · profile=revenue-products · levels=daily
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueMetrics.ts
 */

import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchTopProducts } from '../../../utils/dailyOpsRevenue/fetchCategoriesAndProducts'
import type { DailyOpsRevenueProductRow } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueProductRow[]> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseRevenueQuery(q)
  const limit = Number(q.limit) > 0 ? Number(q.limit) : 20
  const db = await getDb()
  return fetchTopProducts(db, ctx, limit)
})
