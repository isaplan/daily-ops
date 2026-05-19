/**
 * @registry-id: dailyOpsPeriod
 * @last-modified: 2026-05-19T00:00:00.000Z
 * @last-fix: [2026-05-19] Re-export shared resolver (Amsterdam register business_date)
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsDashboardMetrics.ts => resolveDailyOpsPeriod()
 */

export { resolveDailyOpsPeriod, type DailyOpsDateRange } from '~/utils/dailyOpsPeriod'
