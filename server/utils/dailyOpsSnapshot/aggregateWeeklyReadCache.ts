/**
 * @registry-id: dailyOpsAggregateWeeklyReadCache
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-08-09T17:30:00.000Z
 * @description: Phase 7 — cascade period-cache weeks (no weekly-digest profile write)
 * @last-fix: [2026-08-09] Phase 7 retire weekly-digest read-cache writer
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @write-cache-json: daily_ops_period_cache · week cascade
 *
 * @exports-to:
 * ✓ server/tasks/daily-ops/weekly-digest-cache.ts
 * ✓ server/plugins/bundle-cache-catchup.ts
 */

import type { Db } from 'mongodb'
import { cascadePeriodRange } from '../dailyOpsPeriodCache/cascadePeriod'
import { previousWeekRange, resolveWeeklyRange, type WeeklyRange } from '../dailyOpsWeeklyReport/weekRange'

export async function aggregateWeeklyReadCache (
  db: Db,
  range: WeeklyRange,
  _locationIds?: string[],
): Promise<{ written: number }> {
  await cascadePeriodRange(db, range.startDate, range.endDate)
  return { written: 0 }
}

export async function warmRecentWeeklyDigestCache (
  db: Db,
  weeksBack = 8,
): Promise<{ written: number }> {
  let range = resolveWeeklyRange({ period: 'last-week' })
  let written = 0
  for (let i = 0; i < weeksBack; i += 1) {
    const result = await aggregateWeeklyReadCache(db, range)
    written += result.written
    range = previousWeekRange(range)
  }
  return { written }
}
