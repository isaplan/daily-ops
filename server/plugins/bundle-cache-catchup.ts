/**
 * On production startup: rebuild JSON bundle cache from Mongo snapshots when disk is cold (post-deploy).
 * Disable with BUNDLE_CACHE_CATCHUP_ON_START=0.
 */
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getDb } from '../utils/db'
import { refreshDashboardBundleCache } from '../utils/dailyOpsSnapshot/preGenerateBundleCache'

const CACHE_DAILY = resolve(process.cwd(), '.cache/daily-ops-bundles/daily')
const MIN_DAILY_ALL_FILES = 60

function catchupEnabled(): boolean {
  if (process.env.BUNDLE_CACHE_CATCHUP_ON_START === '0') return false
  if (process.env.BUNDLE_CACHE_CATCHUP_ON_START === '1') return true
  return process.env.NODE_ENV === 'production'
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('ready', () => {
    void (async () => {
      if (!catchupEnabled()) return

      let dailyAllCount = 0
      try {
        const files = await readdir(CACHE_DAILY)
        dailyAllCount = files.filter((f) => f.endsWith('-all.json')).length
      }
      catch {
        // cold — no cache dir yet
      }

      if (dailyAllCount >= MIN_DAILY_ALL_FILES) {
        nitroApp.logger?.info(`[bundle-cache-catchup] skip; ${dailyAllCount} daily all-location bundles present`)
        return
      }

      nitroApp.logger?.info(
        `[bundle-cache-catchup] cold cache (${dailyAllCount} daily) — rebuilding from snapshots`,
      )

      const db = await getDb()
      const bounds = await db
        .collection('daily_ops_snapshot_master')
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
        .collection('daily_ops_snapshot_master')
        .distinct('locationId', { businessDate: { $gte: row.minDate, $lte: row.maxDate } })

      await refreshDashboardBundleCache(
        db,
        row.minDate,
        row.maxDate,
        [...locationIds.map(String), 'all'],
      )

      nitroApp.logger?.info(`[bundle-cache-catchup] done ${row.minDate}..${row.maxDate}`)
    })().catch((e) => {
      const msg = e instanceof Error ? e.message : String(e)
      nitroApp.logger?.error(`[bundle-cache-catchup] failed: ${msg}`)
    })
  })
})
