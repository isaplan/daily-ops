/**
 * @registry-id: dailyOpsLoadDashboardBundleForGet
 * @created: 2026-08-09T00:30:00.000Z
 * @last-modified: 2026-08-16T14:20:00.000Z
 * @description: Dashboard GET loader — sealed days = period-cache; open register Today = live snapshot path
 * @last-fix: [2026-08-16] Today: no parallel strip (strip has own endpoint); in-flight dedupe
 *   Prior: [2026-08-10] Self-heal closed days still status=open (stale early labor) before assemble
 * @adr-ref: ADR-004, ADR-010, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: period-cache | snapshot-today-live
 * @read-cache-json: daily_ops_period_cache · level=day (sealed); Today uses snapshots + check_ins
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 * ✓ server/api/daily-ops/metrics/summary.get.ts
 * ✓ server/api/daily-ops/metrics/labor.get.ts
 * ✓ server/api/daily-ops/metrics/revenue-breakdown.get.ts
 * ✓ server/api/daily-ops/overview.get.ts
 * ✓ server/api/daily-ops/metrics/venue-strip.get.ts
 * ✓ server/api/daily-ops/metrics/table-occupancy-kpis.get.ts
 */

import type { Db } from 'mongodb'
import { isOpenRegisterBusinessDate } from '~/utils/dailyOpsBusinessDate'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { assembleDashboardBundleFromPeriodCache } from '../dailyOpsPeriodCache/assembleDashboardBundleFromPeriodCache'
import { cascadePeriodRange } from '../dailyOpsPeriodCache/cascadePeriod'
import { sealDayNodesForDate } from '../dailyOpsPeriodCache/sealDayNode'
import { DAILY_OPS_PERIOD_CACHE_COLLECTION } from '../dailyOpsPeriodCache/store'
import {
  fetchDailyOpsDashboardBundle,
  type DailyOpsDashboardBundleDto,
} from './fetchDashboardBundle'

/** True when the request is exactly the open register business day (Today). */
export function isOpenRegisterTodayContext (ctx: DailyOpsMetricsContext): boolean {
  return ctx.startDate === ctx.endDate && isOpenRegisterBusinessDate(ctx.startDate)
}

/**
 * Closed single day still marked `open` = day never re-sealed after final snapshot
 * (shows early-day labor). Rebuild period-cache from snapshots once, then assemble.
 */
async function healStaleOpenDayNodes (
  db: Db,
  businessDate: string,
): Promise<void> {
  if (isOpenRegisterBusinessDate(businessDate)) return

  const staleOpen = await db.collection(DAILY_OPS_PERIOD_CACHE_COLLECTION).countDocuments({
    level: 'day',
    periodKey: businessDate,
    status: 'open',
  })
  if (staleOpen === 0) return

  await sealDayNodesForDate(db, businessDate)
  await cascadePeriodRange(db, businessDate, businessDate)
}

function getLoadKey (ctx: DailyOpsMetricsContext): string {
  return `${ctx.period}|${ctx.startDate}|${ctx.endDate}|${ctx.locationId ?? 'all'}`
}

/** Coalesce concurrent identical GETs (strip+bundle race, double mount). */
const inflightLoads = new Map<string, Promise<DailyOpsDashboardBundleDto>>()

async function loadDashboardBundleForGetInner (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto> {
  if (isOpenRegisterTodayContext(ctx)) {
    // Strip is served by /venue-strip via buildVenueStripResponse — don't rebuild here
    return await fetchDailyOpsDashboardBundle(db, ctx)
  }

  if (ctx.startDate === ctx.endDate) {
    await healStaleOpenDayNodes(db, ctx.startDate)
  }

  return assembleDashboardBundleFromPeriodCache(db, ctx)
}

/**
 * GET path:
 * - **Today (open register day):** live snapshot + check_ins / open-shift overlays (not finished period-cache).
 * - **Yesterday and older / multi-day:** period-cache projection only.
 */
export async function loadDashboardBundleForGet (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto> {
  const key = getLoadKey(ctx)
  const existing = inflightLoads.get(key)
  if (existing) return existing

  const pending = loadDashboardBundleForGetInner(db, ctx).finally(() => {
    inflightLoads.delete(key)
  }) as Promise<DailyOpsDashboardBundleDto & { cacheVersion?: string | null }>
  inflightLoads.set(key, pending)
  return pending
}
