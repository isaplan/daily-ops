/**
 * @registry-id: dailyOpsWorkerStaffDetailGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Worker drawer staff rows — read-cache target (reserved)
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=worker-staff-detail · levels=daily|weekly|monthly|yearly · Status: reserved
 *
 * @exports-to:
 * ✓ composables/useDailyOpsWorkerDrawer.ts
 */
import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { fetchWorkerStaffDetailMetrics } from '../../../utils/dailyOpsMetrics/workerStaffDetail'
import type { DailyOpsWorkerStaffDetailResponseDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(
  async (event): Promise<DailyOpsWorkerStaffDetailResponseDto> => {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
    const db = await getDb()
    const workerStaffDetail = await fetchWorkerStaffDetailMetrics(db, ctx)
    return { workerStaffDetail }
  }
)
