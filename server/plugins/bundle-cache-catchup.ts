/**
 * @registry-id: bundleCacheCatchupPlugin
 * @created: 2026-07-01T00:00:00.000Z
 * @last-modified: 2026-07-11T17:30:00.000Z
 * @description: Warm daily_ops_read_cache from snapshots when Mongo cache is cold post-deploy
 * @last-fix: [2026-07-11] Query daily_ops_snapshot master collection (was wrong daily_ops_snapshot_master)
 *   Prior: [2026-07-09] Warm weekly-digest read-cache on cold startup
 *   Prior: [2026-07-02] Check Mongo daily doc count instead of disk-only
 * @adr-ref: ADR-004, ADR-013
 * @data-source: snapshot-write-only
 * @write-cache-json: daily_ops_read_cache · dashboard-bundle · weekly-digest
 *
 * @exports-to:
 * ✓ nitro startup
 */
import { getDb } from '../utils/db'
import { countReadCacheDocs } from '../utils/dailyOpsReadCache/readCacheStore'
import { refreshDashboardBundleCache } from '../utils/dailyOpsSnapshot/preGenerateBundleCache'
import { warmRecentWeeklyDigestCache } from '../utils/dailyOpsSnapshot/aggregateWeeklyReadCache'
import { WEEKLY_DIGEST_PROFILE } from '~/types/daily-ops-weekly-report'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'

const SNAPSHOT_MASTER = DAILY_OPS_SNAPSHOT_COLLECTIONS.master

const MIN_DAILY_ALL_DOCS = 60

function catchupEnabled(): boolean {
  if (process.env.BUNDLE_CACHE_CATCHUP_ON_START === '0') return false
  if (process.env.BUNDLE_CACHE_CATCHUP_ON_START === '1') return true
  return process.env.NODE_ENV === 'production'
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('ready', () => {
    void (async () => {
      if (!catchupEnabled()) return

      const db = await getDb()
      const dailyAllCount = await countReadCacheDocs(db, 'dashboard-bundle', 'daily', 'all')

      if (dailyAllCount >= MIN_DAILY_ALL_DOCS) {
        nitroApp.logger?.info(`[bundle-cache-catchup] skip; ${dailyAllCount} Mongo daily all-location docs`)
        return
      }

      nitroApp.logger?.info(
        `[bundle-cache-catchup] cold Mongo cache (${dailyAllCount} daily) — rebuilding from snapshots`,
      )

      const bounds = await db
        .collection(SNAPSHOT_MASTER)
        .aggregate([
          { $group: { _id: null, minDate: { $min: '$businessDate' }, maxDate: { $max: '$businessDate' } } },
        ])
        .toArray()
      const row = bounds[0] as { minDate?: string; maxDate?: string } | undefined
      if (!row?.minDate || !row?.maxDate) {
        nitroApp.logger?.warn('[bundle-cache-catchup] no snapshot rows — skip')
        return
      }

      const locationIds = await db
        .collection(SNAPSHOT_MASTER)
        .distinct('locationId', { businessDate: { $gte: row.minDate, $lte: row.maxDate } })

      await refreshDashboardBundleCache(
        db,
        row.minDate,
        row.maxDate,
        [...locationIds.map(String), 'all'],
      )

      const weeklyCount = await countReadCacheDocs(db, WEEKLY_DIGEST_PROFILE, 'weekly', 'all')
      if (weeklyCount < 4) {
        nitroApp.logger?.info(`[bundle-cache-catchup] warming weekly-digest (${weeklyCount} docs)`)
        const weekly = await warmRecentWeeklyDigestCache(db, 8)
        nitroApp.logger?.info(`[bundle-cache-catchup] weekly-digest written=${weekly.written}`)
      }

      nitroApp.logger?.info(`[bundle-cache-catchup] done ${row.minDate}..${row.maxDate}`)
    })().catch((e) => {
      const msg = e instanceof Error ? e.message : String(e)
      nitroApp.logger?.error(`[bundle-cache-catchup] failed: ${msg}`)
    })
  })
})
