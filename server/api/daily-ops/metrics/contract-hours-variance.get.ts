/**
 * @registry-id: dailyOpsContractHoursVarianceGet
 * @created: 2026-06-11T12:00:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: GET /api/daily-ops/metrics/contract-hours-variance — staff ±contract hours (4 wk)
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle · levels=daily|weekly|monthly|yearly · Status: reserved
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 */

import { getDb } from '../../../utils/db'
import { fetchDailyOpsContractHoursVariance } from '../../../utils/dailyOpsContractHoursVariance'
import type { DailyOpsContractHoursVarianceDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsContractHoursVarianceDto> => {
  const q = getQuery(event) as Record<string, unknown>
  const anchor = typeof q.anchor === 'string' ? q.anchor : undefined
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const db = await getDb()
  return fetchDailyOpsContractHoursVariance(db, anchor)
})
