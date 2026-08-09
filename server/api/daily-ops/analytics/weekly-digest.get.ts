/**
 * @registry-id: dailyOpsWeeklyDigestGet
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-08-09T00:35:00.000Z
 * @description: GET /api/daily-ops/analytics/weekly-digest — weekly report read-cache only
 * @last-fix: [2026-08-09] schemaVersion 12; cache miss → dataGap (no build/upsert on GET)
 * @adr-ref: ADR-004, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=weekly-digest · level=weekly
 *
 * @exports-to:
 * ✓ composables/useDailyOpsWeeklyReport.ts
 * ✓ pages/daily-ops/analytics/weekly-report.vue
 */

import { getDb } from '../../../utils/db'
import { findReadCachePayload } from '../../../utils/dailyOpsReadCache/readCacheStore'
import { emptyWeeklyDigestForCacheMiss } from '../../../utils/dailyOpsWeeklyReport/emptyWeeklyDigestForCacheMiss'
import { resolveWeeklyRange } from '../../../utils/dailyOpsWeeklyReport/weekRange'
import { resolveWeeklyTargets } from '../../../utils/dailyOpsWeeklyReport/weeklyStatus'
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'
import { WEEKLY_DIGEST_PROFILE } from '~/types/daily-ops-weekly-report'

/** Pre–schemaVersion 12 digests lack period-cache food/bev totals. */
function weeklyDigestSchemaStale (d: WeeklyDigestDto): boolean {
  if ((d.schemaVersion ?? 1) < 12) return true
  if (!d.openingClosing) return true
  if (!d.tableOccupancy) return true
  if (!d.comparisons?.rolling12Week) return true
  const row = d.dailyBreakdown[0]
  if (!row) return false
  return (
    row.profit == null
    || row.pnlResult == null
    || row.productivity == null
    || row.staffCount == null
  )
}

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
  const cached = await findReadCachePayload<WeeklyDigestDto>(db, {
    profile: WEEKLY_DIGEST_PROFILE,
    level: 'weekly',
    key: range.weekKey,
    locationId,
  })

  if (cached && cached.targets.presetId === targets.presetId && !weeklyDigestSchemaStale(cached)) {
    return cached
  }

  return emptyWeeklyDigestForCacheMiss(range, locationId, targets)
})
