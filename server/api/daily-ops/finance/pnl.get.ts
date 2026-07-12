/**
 * @registry-id: dailyOpsFinancePnlGet
 * @created: 2026-06-21T00:00:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: GET /api/daily-ops/finance/pnl — accounting P&L benchmarks from Mongo.
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 *
 * @adr-ref: ADR-013
 * @data-source: direct-db
 * @read-cache-json: none
 *
 * @exports-to:
 * ✓ pages/daily-ops/finance/pnl.vue
 */

import { getDb } from '../../../utils/db'
import { fetchAccountingPnlBenchmark } from '../../../utils/accountingPnlBenchmarkService'
import type { AccountingPnlBenchmarkResponseDto } from '~/types/accounting-pnl-benchmark'

export default defineEventHandler(async (event): Promise<AccountingPnlBenchmarkResponseDto> => {
  const q = getQuery(event) as Record<string, unknown>
  setResponseHeader(event, 'Cache-Control', 'private, max-age=300')
  const db = await getDb()
  return fetchAccountingPnlBenchmark(db, q.year, q.month, q.grid)
})
