import { getDb } from '../../../utils/db'
import {
  assembleDailyOpsLaborMetricsDto,
  fetchLaborMetricsPipelineInput,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import type { DailyOpsLaborMetricsDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsLaborMetricsDto> => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const input = await fetchLaborMetricsPipelineInput(db, ctx)
  return assembleDailyOpsLaborMetricsDto(ctx, input)
})
