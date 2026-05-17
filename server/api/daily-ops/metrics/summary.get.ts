import { getDb } from '../../../utils/db'
import {
  buildDailyOpsSummaryDto,
  fetchInboxBasisRevenueTotalExVat,
  fetchLaborMetricsPipelineInput,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import { aggregateLaborForRange } from '../../../utils/dailyOpsSnapshot/aggregateLaborForRange'
import type { DailyOpsSummaryDto } from '~/types/daily-ops-dashboard'

/** Same headline revenue + labor breakdown as bundle.get (summary slice only). */
export default defineEventHandler(async (event): Promise<DailyOpsSummaryDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const [laborInput, inboxBasisExVat, laborBreakdown] = await Promise.all([
    fetchLaborMetricsPipelineInput(db, ctx),
    fetchInboxBasisRevenueTotalExVat(db, ctx),
    aggregateLaborForRange(db, {
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      locationId: ctx.locationId,
    }),
  ])
  const dto = buildDailyOpsSummaryDto(ctx, laborInput.revMap, laborInput.labMap, {
    apiBusinessDaysTotal: laborInput.revenueSplit.businessDaysPeriodTotal,
    inboxBasisExVat,
  })
  if (laborBreakdown.coverage.daysFound > 0) {
    dto.summary.laborBreakdown = laborBreakdown
  }
  return dto
})
