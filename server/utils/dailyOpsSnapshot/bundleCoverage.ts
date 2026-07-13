/**
 * @registry-id: dailyOpsBundleCoverage
 * @created: 2026-06-18T00:00:00.000Z
 * @last-modified: 2026-07-13T09:58:00.000Z
 * @description: Snapshot coverage for multi-day dashboard bundles (missing business dates)
 * @last-fix: [2026-07-13] Merge nested snapshotCoverage from rollup children (month→year)
 *   Prior: [2026-06-18] Initial — daysFound / missingDates for week/month/year partial compile
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

function clipYmdRange(
  start: string,
  end: string,
  clipStart: string,
  clipEnd: string,
): { start: string; end: string } | null {
  const sliceStart = start > clipStart ? start : clipStart
  const sliceEnd = end < clipEnd ? end : clipEnd
  if (sliceStart > sliceEnd) return null
  return { start: sliceStart, end: sliceEnd }
}

/** Found business dates contributed by one child bundle within a parent range. */
function foundDatesFromBundle(
  bundle: DailyOpsDashboardBundleDto,
  parentStart: string,
  parentEnd: string,
): string[] {
  const range = bundle.summary?.range
  if (!range?.startDate || !range?.endDate) return []

  const clipped = clipYmdRange(range.startDate, range.endDate, parentStart, parentEnd)
  if (!clipped) return []

  const { start: sliceStart, end: sliceEnd } = clipped
  const cov = bundle.summary.snapshotCoverage

  if (cov) {
    const expected = enumerateUtcDatesInclusive(sliceStart, sliceEnd)
    const missing = new Set(
      cov.missingDates.filter((d) => d >= sliceStart && d <= sliceEnd),
    )
    return expected.filter((d) => !missing.has(d))
  }

  if (range.startDate === range.endDate) {
    return range.startDate >= parentStart && range.startDate <= parentEnd ? [range.startDate] : []
  }

  return enumerateUtcDatesInclusive(sliceStart, sliceEnd)
}

export function coverageFromDailyBundles(
  bundles: DailyOpsDashboardBundleDto[],
  startDate: string,
  endDate: string,
): DailyOpsSnapshotCoverageDto {
  const found = new Set<string>()
  for (const bundle of bundles) {
    for (const d of foundDatesFromBundle(bundle, startDate, endDate)) {
      found.add(d)
    }
  }
  return computeBundleCoverage(startDate, endDate, found)
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
  return `Partial period: ${coverage.daysFound}/${coverage.daysExpected} days loaded. Missing: ${preview}${more}.`
}

/** True when a cached bundle was stitched from incomplete daily read-cache docs. */
export function bundleHasCoverageGaps(bundle: DailyOpsDashboardBundleDto | null | undefined): boolean {
  return (bundle?.summary?.snapshotCoverage?.missingDates?.length ?? 0) > 0
}
