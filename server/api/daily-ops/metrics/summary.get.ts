import { getDb } from '../../../utils/db'
import {
  buildDailyOpsSummaryDto,
  fetchLaborByDate,
  fetchRevenueByDate,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import { aggregateLaborForRange } from '../../../utils/dailyOpsSnapshot/aggregateLaborForRange'
import type { DailyOpsSummaryDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsSummaryDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const [revMap, labMap, laborBreakdown] = await Promise.all([
    fetchRevenueByDate(db, ctx),
    fetchLaborByDate(db, ctx),
    aggregateLaborForRange(db, {
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      locationId: ctx.locationId,
    }),
  ])
  const dto = buildDailyOpsSummaryDto(ctx, revMap, labMap)
  if (laborBreakdown.coverage.daysFound > 0) {
    dto.summary.laborBreakdown = laborBreakdown
  }
  return dto
})
