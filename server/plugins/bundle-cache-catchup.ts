/**
 * @registry-id: bundleCacheCatchupPlugin
 * @created: 2026-07-01T00:00:00.000Z
 * @last-modified: 2026-08-09T17:30:00.000Z
 * @description: Warm period-cache cascade when cold post-deploy (Phase 7)
 * @last-fix: [2026-08-09] Phase 7 — cascade period-cache; no dashboard-bundle / weekly-digest writes
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @write-cache-json: daily_ops_period_cache
 *
 * @exports-to:
 * ✓ nitro startup
 */
import { getDb } from '../utils/db'
import { cascadePeriodRange } from '../utils/dailyOpsPeriodCache/cascadePeriod'
import { DAILY_OPS_PERIOD_CACHE_COLLECTION } from '../utils/dailyOpsPeriodCache/store'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'

const SNAPSHOT_MASTER = DAILY_OPS_SNAPSHOT_COLLECTIONS.master
const MIN_PERIOD_DAY_DOCS = 60

function catchupEnabled (): boolean {
  if (process.env.BUNDLE_CACHE_CATCHUP_ON_START === '0') return false
  if (process.env.BUNDLE_CACHE_CATCHUP_ON_START === '1') return true
  return process.env.NODE_ENV === 'production'
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('ready', () => {
    void (async () => {
      if (!catchupEnabled()) return

      const db = await getDb()
      const dayCount = await db.collection(DAILY_OPS_PERIOD_CACHE_COLLECTION).countDocuments({
        level: 'day',
        locationId: 'all',
      })

      if (dayCount >= MIN_PERIOD_DAY_DOCS) {
        nitroApp.logger?.info(`[period-cache-catchup] skip; ${dayCount} period day all-location docs`)
        return
      }

      nitroApp.logger?.info(
        `[period-cache-catchup] cold period-cache (${dayCount} day/all) — cascading from snapshot range`,
      )

      const bounds = await db
        .collection(SNAPSHOT_MASTER)
        .aggregate([
          { $group: { _id: null, minDate: { $min: '$businessDate' }, maxDate: { $max: '$businessDate' } } },
        ])
        .toArray()
      const row = bounds[0] as { minDate?: string; maxDate?: string } | undefined
      if (!row?.minDate || !row?.maxDate) {
        nitroApp.logger?.warn('[period-cache-catchup] no snapshot rows — skip')
        return
      }

      await cascadePeriodRange(db, row.minDate, row.maxDate)
      nitroApp.logger?.info(`[period-cache-catchup] done ${row.minDate}..${row.maxDate}`)
    })().catch((e) => {
      const msg = e instanceof Error ? e.message : String(e)
      nitroApp.logger?.error(`[period-cache-catchup] failed: ${msg}`)
    })
  })
})
