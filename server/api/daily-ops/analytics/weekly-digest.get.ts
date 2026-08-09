/**
 * @registry-id: dailyOpsWeeklyDigestGet
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-08-09T17:55:00.000Z
 * @description: GET /api/daily-ops/analytics/weekly-digest — period-cache projection (Phase 7)
 * @last-fix: [2026-08-09] ZERO-GET sides empty; occupancy from period-cache
 * @adr-ref: ADR-004, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=day
 *
 * @exports-to:
 * ✓ composables/useDailyOpsWeeklyReport.ts
 * ✓ pages/daily-ops/analytics/weekly-report.vue
 */

import { getDb } from '../../../utils/db'
import { emptyWeeklyDigestForCacheMiss } from '../../../utils/dailyOpsWeeklyReport/emptyWeeklyDigestForCacheMiss'
import { buildWeeklyDigest } from '../../../utils/dailyOpsWeeklyReport/buildWeeklyDigest'
import { resolveWeeklyRange } from '../../../utils/dailyOpsWeeklyReport/weekRange'
import { resolveWeeklyTargets } from '../../../utils/dailyOpsWeeklyReport/weeklyStatus'
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'

export default defineEventHandler(async (event): Promise<WeeklyDigestDto> => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=300')
  const q = getQuery(event) as Record<string, unknown>
  const range = resolveWeeklyRange({
    week: typeof q.week === 'string' ? q.week : undefined,
    period: typeof q.period === 'string' ? q.period : 'last-week',
    anchor: typeof q.anchor === 'string' ? q.anchor : undefined,
  })
  const locationId = typeof q.location === 'string' && q.location.length > 0 ? q.location : 'all'
  const targets = resolveWeeklyTargets(typeof q.targets === 'string' ? q.targets : undefined)

  const db = await getDb()
  const built = await buildWeeklyDigest(db, range, { locationId, targets })
  if (built.dataGap && built.coverage.daysFound === 0) {
    return emptyWeeklyDigestForCacheMiss(range, locationId, targets)
  }
  return built
})
