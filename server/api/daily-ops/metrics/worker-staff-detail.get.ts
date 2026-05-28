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
