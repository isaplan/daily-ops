/**
 * @registry-id: accountingPnlLaborMultiplier
 * @created: 2026-06-22T00:00:00.000Z
 * @last-modified: 2026-06-22T00:00:00.000Z
 * @description: Eitje loaded labor → accounting personnel calibration (per venue/year).
 * @last-fix: [2026-06-25] Wired into Insights staff costs + Staff %
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildProfitByIntervalFromSnapshot.ts
 * ✓ server/utils/dailyOpsMetrics/profitHour.ts
 * ✓ server/utils/dailyOpsSnapshot/drilldown/buildRevenueDrilldownHourly.ts
 * ✓ server/utils/dailyOpsInsights/buildPerformanceInsights.ts
 */

import type { AccountingPnlVenueId, AccountingPnlYear } from '~/utils/accountingPnlData'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

/** Bump when profit math or assumptions change — invalidates pre-generated bundle JSON. */
export const DAILY_OPS_BUNDLE_CACHE_VERSION = 2

const LOCATION_TO_VENUE = Object.fromEntries(
  DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => [v.locationId, v.short.toLowerCase() as AccountingPnlVenueId]),
) as Record<string, AccountingPnlVenueId>

/**
 * Accounting personnel ÷ Eitje loaded (full-year 2025 dashboard vs Analyse export).
 * Combined ≈ 1.65; VKB-only ≈ 1.39 — not a single org-wide 1.56.
 */
const CALIBRATED_LABOR_MULTIPLIER: Partial<
  Record<AccountingPnlYear, Record<AccountingPnlVenueId | 'combined', number>>
> = {
  2025: {
    vkb: 1.387,
    bea: 1.695,
    lat: 2.225,
    combined: 1.647,
  },
}

function parseYear (ymd: string): number | null {
  const year = Number(ymd.slice(0, 4))
  return Number.isInteger(year) ? year : null
}

function normalizeAccountingYear (year: number): AccountingPnlYear | null {
  if (year === 2024 || year === 2025 || year === 2026) return year
  return null
}

function venueTarget (locationId: string | null): AccountingPnlVenueId | 'combined' {
  if (!locationId) return 'combined'
  return LOCATION_TO_VENUE[locationId] ?? 'combined'
}

export function resolveAccountingLaborMultiplier (
  businessDateYmd: string,
  locationId: string | null,
): number {
  const parsedYear = parseYear(businessDateYmd)
  const year = parsedYear != null ? normalizeAccountingYear(parsedYear) : null
  const target = venueTarget(locationId)

  if (year) {
    const table = CALIBRATED_LABOR_MULTIPLIER[year]
    if (table?.[target] != null) return table[target]!
    if (table?.combined != null) return table.combined
  }

  for (let i = 2025; i >= 2024; i -= 1) {
    const y = i as AccountingPnlYear
    const table = CALIBRATED_LABOR_MULTIPLIER[y]
    if (table?.[target] != null) return table[target]!
    if (table?.combined != null) return table.combined
  }

  return 1.647
}

export function scaleEitjeLoadedLabor (
  eitjeLoaded: number,
  businessDateYmd: string,
  locationId: string | null,
): number {
  if (eitjeLoaded <= 0) return 0
  return eitjeLoaded * resolveAccountingLaborMultiplier(businessDateYmd, locationId)
}
