/**
 * @registry-id: dailyOpsWeeklyDigestGet
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-07-09T15:30:00.000Z
 * @description: GET /api/daily-ops/analytics/weekly-digest — weekly report read-cache
 * @last-fix: [2026-07-09] schemaVersion 4 stale check for openingClosing
 * @adr-ref: ADR-004, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=weekly-digest · level=weekly
 *
 * @exports-to:
 * ✓ composables/useDailyOpsWeeklyReport.ts
 * ✓ pages/daily-ops/analytics/weekly-report.vue
 */

import { getDb } from '../../../utils/db'
import { findReadCachePayload, upsertReadCachePayload } from '../../../utils/dailyOpsReadCache/readCacheStore'
import { buildWeeklyDigest } from '../../../utils/dailyOpsWeeklyReport/buildWeeklyDigest'
import { resolveWeeklyRange } from '../../../utils/dailyOpsWeeklyReport/weekRange'
import { resolveWeeklyTargets } from '../../../utils/dailyOpsWeeklyReport/weeklyStatus'
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'
import { WEEKLY_DIGEST_PROFILE } from '~/types/daily-ops-weekly-report'

/** Pre–multi-metric chart cache lacks per-day profit / pnl / productivity / staff. */
function weeklyDigestSchemaStale(d: WeeklyDigestDto): boolean {
  if ((d.schemaVersion ?? 1) < 9) return true
  if (!d.openingClosing) return true
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

  const built = await buildWeeklyDigest(db, range, { locationId, targets })
  await upsertReadCachePayload(db, {
    profile: WEEKLY_DIGEST_PROFILE,
    level: 'weekly',
    key: range.weekKey,
    locationId,
    businessDateStart: range.startDate,
    businessDateEnd: range.endDate,
    payload: built,
  })
  return built
})
