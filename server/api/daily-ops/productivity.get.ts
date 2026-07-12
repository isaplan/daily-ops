/**
 * @registry-id: dailyOpsProductivityStubGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Productivity section stub — period range only
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-010, ADR-013
 * @data-source: none
 * @read-cache-json: none
 */
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
