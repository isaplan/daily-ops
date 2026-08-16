/**
 * @registry-id: dailyOpsSnapshotCacheControl
 * @created: 2026-07-16T00:00:00.000Z
 * @last-modified: 2026-08-16T15:55:00.000Z
 * @description: Cache-Control headers for Daily Ops dashboard bundle GETs (ADR-010)
 * @last-fix: [2026-08-16] Align HTTP cache with Today/week/archive freshness tiers
 * @adr-ref: ADR-004, ADR-010, ADR-013
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 * ✓ server/api/daily-ops/metrics/summary.get.ts
 * ✓ server/api/daily-ops/metrics/labor.get.ts
 * ✓ server/api/daily-ops/metrics/revenue-breakdown.get.ts
 * ✓ server/api/daily-ops/metrics/venue-strip.get.ts
 */

import type { DailyOpsMetricsContext } from '../../dailyOpsMetrics/context'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

export function snapshotCacheControl(ctx: DailyOpsMetricsContext): string {
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()

  if (ctx.period === 'today' || ctx.endDate >= openRegister) {
    return 'no-store'
  }

  // This week / recent days — short browser cache
  if (
    ctx.period === 'this-week'
    || ctx.period === 'yesterday'
    || ctx.period === 'last-week'
    || /^d[2-7]$/.test(ctx.period)
  ) {
    return 'private, max-age=600, stale-while-revalidate=3600'
  }

  const monthAgo = addCalendarDaysYmd(openRegister, -31)
  if (ctx.endDate >= monthAgo) {
    return 'private, max-age=3600, stale-while-revalidate=86400'
  }

  // Older than a month — sticky until Finance/rebuild (client also version-checks)
  return 'private, max-age=86400, stale-while-revalidate=604800'
}
