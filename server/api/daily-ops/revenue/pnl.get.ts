/**
 * @registry-id: dailyOpsRevenuePnlGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Simple revenue P&L — read-cache target (ADR-013, reserved)
 * @last-fix: [2026-07-02] ADR-013 reserved read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache (reserved - page not built yet)
 * @read-cache-json: daily_ops_read_cache · profile=revenue-pnl · levels=daily
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueMetrics.ts
 */

import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { computeSimplePnL } from '../../../utils/dailyOpsRevenue/computeSimplePnL'
import { loadPnlAssumptions } from '../../../utils/appSettings/pnlAssumptionsSetting'
import type { DailyOpsSimplePnLDto } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsSimplePnLDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseRevenueQuery(q)
  const db = await getDb()
  const assumptions = await loadPnlAssumptions(db)
  return computeSimplePnL(db, ctx, assumptions)
})
