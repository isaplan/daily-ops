/**
 * @registry-id: staffOrgLaborBenchmarks
 * @created: 2026-07-23T10:40:00.000Z
 * @last-modified: 2026-07-23T10:40:00.000Z
 * @description: Seed labor % + food/bev shares from accounting P&L (ADR-016 read-only)
 * @last-fix: [2026-07-23] 2025 year totals; FT/PT/ZZP left null (no inhuur in P&L)
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/api/staff-org/labor-benchmarks.get.ts
 */

import type { StaffOrgLaborBenchmark } from '~/types/staff-org'
import {
  ACCOUNTING_PNL_LOCATION_ID_TO_VENUE,
  accountingPnlYearTotals,
  type AccountingPnlVenueId,
} from '~/utils/accountingPnlData'
import { accountingPnlRowWithMix } from '~/utils/accountingPnlMixData'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'
import { defaultTeamRevenueSplit } from '~/utils/staffOrg/locationTargets'

const BENCHMARK_YEAR = 2025 as const

function pct(part: number, whole: number): number | null {
  if (!(whole > 0) || !Number.isFinite(part)) return null
  return Math.round((part / whole) * 1000) / 10
}

function shareOrDefault(
  food: number,
  bev: number,
  locationId: string,
): { keukenRevenueShare: number; bedieningRevenueShare: number } {
  const sum = food + bev
  if (sum <= 0) return defaultTeamRevenueSplit(locationId)
  return {
    keukenRevenueShare: Math.round((food / sum) * 1000) / 1000,
    bedieningRevenueShare: Math.round((bev / sum) * 1000) / 1000,
  }
}

/**
 * Accounting P&L has total labor %, not FT/PT/ZZP.
 * Food → keuken share; beverage → bediening+bar share.
 * Contract/inhuur/zzp actuals stay null until staff timeseries seed is added.
 */
export function buildStaffOrgLaborBenchmarks(
  year: typeof BENCHMARK_YEAR = BENCHMARK_YEAR,
): StaffOrgLaborBenchmark[] {
  const out: StaffOrgLaborBenchmark[] = []

  for (const venue of DAILY_OPS_PROFIT_VENUE_LOCATIONS) {
    const venueId = ACCOUNTING_PNL_LOCATION_ID_TO_VENUE[venue.locationId] as
      | AccountingPnlVenueId
      | undefined
    if (!venueId) continue

    const base = accountingPnlYearTotals(year, venueId)
    if (!base) continue
    const row = accountingPnlRowWithMix(year, venueId, null, base)
    const monthlyRevenue = Math.round(row.revenue / 12)
    const laborCostPctTotal = pct(row.labor, row.revenue)
    const split = shareOrDefault(row.revenueFood, row.revenueBeverage, venue.locationId)

    out.push({
      locationId: venue.locationId,
      year,
      monthlyRevenue,
      laborCostPct: {
        total: laborCostPctTotal,
        ft: null,
        pt: null,
        zzp: null,
      },
      keukenRevenueShare: split.keukenRevenueShare,
      bedieningRevenueShare: split.bedieningRevenueShare,
    })
  }

  return out
}
