/**
 * @registry-id: dailyOpsBundleCoverage
 * @created: 2026-06-18T00:00:00.000Z
 * @last-modified: 2026-06-18T00:00:00.000Z
 * @description: Snapshot coverage for multi-day dashboard bundles (missing business dates)
 * @last-fix: [2026-06-18] Initial — daysFound / missingDates for week/month/year partial compile
 * @adr-ref: ADR-004, ADR-008
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/aggregateDailyBundles.ts
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 * ✓ server/utils/dailyOpsSnapshot/cacheCascade.ts
 */

import type { DailyOpsSnapshotCoverageDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsSnapshotMaster } from '~/types/daily-ops-snapshot'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'

export function computeBundleCoverage(
  startDate: string,
  endDate: string,
  foundDates: Iterable<string>,
): DailyOpsSnapshotCoverageDto {
  const expected = enumerateUtcDatesInclusive(startDate, endDate)
  const found = new Set(foundDates)
  const missingDates = expected.filter((d) => !found.has(d))
  return {
    daysExpected: expected.length,
    daysFound: expected.length - missingDates.length,
    missingDates,
  }
}

export function coverageFromDailyBundles(
  bundles: DailyOpsDashboardBundleDto[],
  startDate: string,
  endDate: string,
): DailyOpsSnapshotCoverageDto {
  const dates = bundles
    .map((b) => b.summary?.range?.startDate)
    .filter((d): d is string => !!d && d >= startDate && d <= endDate)
  return computeBundleCoverage(startDate, endDate, dates)
}

export function coverageFromSnapshotMasters(
  ctx: DailyOpsMetricsContext,
  masters: DailyOpsSnapshotMaster[],
): DailyOpsSnapshotCoverageDto {
  let rows = masters
  if (ctx.locationId) {
    rows = masters.filter((m) => m.locationId === ctx.locationId)
  }
  const dates = new Set(rows.map((m) => m.businessDate))
  return computeBundleCoverage(ctx.startDate, ctx.endDate, dates)
}

export function formatCoverageNote(coverage: DailyOpsSnapshotCoverageDto): string | null {
  if (coverage.missingDates.length === 0) return null
  const preview = coverage.missingDates.slice(0, 5).join(', ')
  const more =
    coverage.missingDates.length > 5 ? ` (+${coverage.missingDates.length - 5} more)` : ''
  return `Partial period: ${coverage.daysFound}/${coverage.daysExpected} days in snapshot. Missing: ${preview}${more}.`
}
