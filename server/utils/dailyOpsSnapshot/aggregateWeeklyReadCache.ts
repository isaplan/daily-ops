/**
 * @registry-id: dailyOpsAggregateWeeklyReadCache
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-07-09T00:00:00.000Z
 * @description: Write weekly-digest profile to daily_ops_read_cache (ADR-013)
 * @last-fix: [2026-07-09] Aggregate 7 daily snapshots into weekly read-cache JSON
 * @adr-ref: ADR-004, ADR-013
 * @data-source: snapshot-write-only
 * @write-cache-json: daily_ops_read_cache · profile=weekly-digest · level=weekly
 *
 * @exports-to:
 * ✓ server/tasks/daily-ops/weekly-digest-cache.ts
 * ✓ server/plugins/bundle-cache-catchup.ts
 */

import type { Db } from 'mongodb'
import { upsertReadCachePayload } from '../dailyOpsReadCache/readCacheStore'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { buildWeeklyDigest } from '../dailyOpsWeeklyReport/buildWeeklyDigest'
import { resolveWeeklyTargets } from '../dailyOpsWeeklyReport/weeklyStatus'
import { resolveWeeklyRange, previousWeekRange, type WeeklyRange } from '../dailyOpsWeeklyReport/weekRange'
import { WEEKLY_DIGEST_PROFILE } from '~/types/daily-ops-weekly-report'

export async function aggregateWeeklyReadCache(
  db: Db,
  range: WeeklyRange,
  locationIds?: string[],
): Promise<{ written: number }> {
  const targets = resolveWeeklyTargets()
  const ids = locationIds ?? [...VENUE_STRIP_LOCATIONS.map((v) => v.locationId), 'all']
  let written = 0

  for (const locationId of ids) {
    const payload = await buildWeeklyDigest(db, range, { locationId, targets })
    await upsertReadCachePayload(db, {
      profile: WEEKLY_DIGEST_PROFILE,
      level: 'weekly',
      key: range.weekKey,
      locationId,
      businessDateStart: range.startDate,
      businessDateEnd: range.endDate,
      payload,
    })
    written += 1
  }

  return { written }
}

export async function warmRecentWeeklyDigestCache(
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
