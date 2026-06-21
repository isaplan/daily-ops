/**
 * @registry-id: dailyOpsBundleInvariant
 * @created: 2026-06-18T00:00:00.000Z
 * @last-modified: 2026-06-20T00:00:00.000Z
 * @description: Dashboard bundle invariants — sections must reconcile with headline totals
 * @last-fix: [2026-06-20] Also reject cache missing drilldown when headline revenue exists
 *   Prior: [2026-06-18] Initial — reject stale cache when KPI revenue exists but interval sum is empty
 * @adr-ref: ADR-004, ADR-008
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 */

import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'

const REV_EPS = 1

function sumIntervalRevenue(bundle: DailyOpsDashboardBundleDto): number {
  const cells = bundle.revenue?.profitByInterval?.cells ?? []
  return cells.reduce((sum, c) => sum + Number(c.revenue ?? 0), 0)
}

function drilldownHasContent(bundle: DailyOpsDashboardBundleDto): boolean {
  const dd = bundle.revenue?.drilldown
  if (!dd) return false
  const top10Count =
    (dd.top10?.tables?.length ?? 0) +
    (dd.top10?.foodProducts?.length ?? 0) +
    (dd.top10?.beverageProductsOrCategories?.length ?? 0) +
    (dd.top10?.workers?.paymentTime?.length ?? 0)
  const hourlyCount = (dd.hourlyRows ?? []).filter((r) => r.revenue > 0).length
  return top10Count > 0 || hourlyCount > 0 || (dd.spaces?.length ?? 0) > 0
}

/** True when headline revenue exists but profit-by-interval was dropped or sums to ~zero. */
export function bundleProfitByIntervalIncomplete(bundle: DailyOpsDashboardBundleDto): boolean {
  const headline = bundle.summary?.summary?.totalRevenue ?? 0
  if (headline <= REV_EPS) return false

  const pbi = bundle.revenue?.profitByInterval
  if (!pbi?.cells?.length) return true

  const intervalTotal = sumIntervalRevenue(bundle)
  return intervalTotal < headline * 0.05
}

/** True when cached bundle is missing drilldown despite headline revenue. */
export function bundleDrilldownIncomplete(bundle: DailyOpsDashboardBundleDto): boolean {
  const headline = bundle.summary?.summary?.totalRevenue ?? 0
  if (headline <= REV_EPS) return false
  return !drilldownHasContent(bundle)
}

/** Reject stale pre-aggregated JSON when headline sections are incomplete. */
export function bundleDashboardSectionsIncomplete(bundle: DailyOpsDashboardBundleDto): boolean {
  return bundleProfitByIntervalIncomplete(bundle) || bundleDrilldownIncomplete(bundle)
}
