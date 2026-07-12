/**
 * @registry-id: dailyOpsProductivityOrderPaymentRhythmGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Order/payment rhythm — read-cache target (reserved)
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=revenue-order-payment-rhythm · levels=daily · Status: reserved
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueMetrics.ts
 */
import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchOrderPaymentRhythm } from '../../../utils/dailyOpsRevenue/fetchOrderPaymentRhythm'
import type { DailyOpsOrderPaymentRhythmPoint } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsOrderPaymentRhythmPoint[]> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseRevenueQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return fetchOrderPaymentRhythm(db, ctx)
})
