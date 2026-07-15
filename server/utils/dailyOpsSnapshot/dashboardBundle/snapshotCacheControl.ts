/**
 * @registry-id: dailyOpsSnapshotCacheControl
 * @created: 2026-07-16T00:00:00.000Z
 * @last-modified: 2026-07-16T00:00:00.000Z
 * @description: Cache-Control headers for Daily Ops dashboard bundle GETs (ADR-010)
 * @last-fix: [2026-07-16] Extracted from fetchDashboardBundle to stay under monolith budget
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
  const sealedSingleDay = ctx.period !== 'today' && ctx.startDate === ctx.endDate && ctx.endDate < openRegister

  if (sealedSingleDay) {
    const yesterday = addCalendarDaysYmd(openRegister, -1)
    if (ctx.endDate === yesterday) {
      return 'public, max-age=3600, stale-while-revalidate=86400'
    }
    return 'public, max-age=86400, stale-while-revalidate=604800, immutable'
  }

  return 'no-store'
}
