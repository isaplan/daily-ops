/**
 * @registry-id: dailyOpsProductivityTablesRevenueGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Table revenue ranking — read-cache target (reserved)
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=revenue-per-table · levels=daily · Status: reserved
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueMetrics.ts
 */
import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchTableRevenue } from '../../../utils/dailyOpsRevenue/fetchStaffAndTables'
import type { DailyOpsRevenueTableRow } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueTableRow[]> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseRevenueQuery(q)
  const space = typeof q.space === 'string' ? q.space : undefined
  const db = await getDb()
  return fetchTableRevenue(db, ctx, space)
})
