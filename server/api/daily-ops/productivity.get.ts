import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import type { DailyOpsSectionStubDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler((event): DailyOpsSectionStubDto => {
  const q = getQuery(event)
  const period = typeof q.period === 'string' ? q.period : 'today'
  const anchor = typeof q.anchor === 'string' ? q.anchor : undefined
  const range = resolveDailyOpsPeriod(period, anchor)

  return {
    range: {
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
    },
    section: 'productivity',
    title: 'Productivity',
    message: 'Dedicated productivity metrics for this period. Wire to aggregation when ready.',
  }
})
