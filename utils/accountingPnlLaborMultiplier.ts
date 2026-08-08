/**
 * @registry-id: accountingPnlLaborMultiplier
 * @created: 2026-06-22T00:00:00.000Z
 * @last-modified: 2026-08-05T10:50:00.000Z
 * @description: Employer labor calibration — Finance personnel ÷ ops loaded_cost (ADR-020 SSOT)
 * @last-fix: [2026-08-05] ADR-020: 2026 sealed Jan–Jun ratios; used by snapshot labor section (not Insights-only)
 * @adr-ref: ADR-014, ADR-020, ADR-021
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildLaborSection.ts
 * ✓ server/utils/dailyOpsSnapshot/buildProfitByIntervalFromSnapshot.ts
 * ✓ server/utils/dailyOpsMetrics/profitHour.ts
 * ✓ server/utils/dailyOpsSnapshot/drilldown/buildRevenueDrilldownHourly.ts
 * ✓ server/utils/dailyOpsInsights/buildPerformanceInsights.ts
 */

import type { AccountingPnlVenueId, AccountingPnlYear } from '~/utils/accountingPnlData'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

/** Bump when profit math or labor load assumptions change — invalidates pre-generated bundle JSON. */
export const DAILY_OPS_BUNDLE_CACHE_VERSION = 4

const LOCATION_TO_VENUE = Object.fromEntries(
  DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => [v.locationId, v.short.toLowerCase() as AccountingPnlVenueId]),
) as Record<string, AccountingPnlVenueId>

/**
 * Finance labor € ÷ ops snapshot `loaded_cost` for sealed months (dollar-weighted).
 * Apply on snapshot write so dashboard labor € = employer cost (ADR-020).
 * 2026 = Jan–Jun sealed audit (2026-08-05); 2025 = prior Analyse calibration.
 */
const CALIBRATED_LABOR_MULTIPLIER: Partial<
  Record<AccountingPnlYear, Record<AccountingPnlVenueId | 'combined', number>>
> = {
  2026: {
    vkb: 1.092,
    bea: 0.97,
    lat: 1.236,
    combined: 1.094,
  },
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

  for (let i = 2026; i >= 2024; i -= 1) {
    const y = i as AccountingPnlYear
    const table = CALIBRATED_LABOR_MULTIPLIER[y]
    if (table?.[target] != null) return table[target]!
    if (table?.combined != null) return table.combined
  }

  return 1.094
}

export function scaleEitjeLoadedLabor (
  eitjeLoaded: number,
  businessDateYmd: string,
  locationId: string | null,
): number {
  if (eitjeLoaded <= 0) return 0
  return eitjeLoaded * resolveAccountingLaborMultiplier(businessDateYmd, locationId)
}
