/**
 * @registry-id: staffOrgLaborBenchmarks
 * @created: 2026-07-23T10:40:00.000Z
 * @last-modified: 2026-07-27T17:20:00.000Z
 * @description: Seed labor % + food/bev shares from last 12 sealed accounting P&L months
 * @last-fix: [2026-07-27] Rolling 12m sealed avg; FT=salaris*, PT=inhuurFb, ZZP=other inhuur*
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/api/staff-org/labor-benchmarks.get.ts
 */

import type { Db } from 'mongodb'
import type { StaffOrgLaborBenchmark } from '~/types/staff-org'
import { fetchSealedMonthlyPnlRows } from '~/server/utils/accountingPnl/fetchSealedMonthlyPnlRows'
import {
  ACCOUNTING_PNL_LOCATION_ID_TO_VENUE,
  type AccountingPnlVenueId,
} from '~/utils/accountingPnlData'
import { sumLineValues } from '~/utils/accountingPnlGrandchildLines'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'
import { defaultTeamRevenueSplit } from '~/utils/staffOrg/locationTargets'

const ROLLING_MONTHS = 12

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

/** Contract (FT) = bruto salarissen. */
function lonenFt(lines: Record<string, number>): number {
  return (
    (lines.salarisBediening ?? 0) +
    (lines.salarisKeuken ?? 0) +
    (lines.salarisOverhead ?? 0)
  )
}

/** Inhuur (PT) = Inhuur F&B only. */
function lonenPt(lines: Record<string, number>): number {
  return lines.inhuurFb ?? 0
}

/** ZZP = remaining inhuur lines (Afwas / Stewarding / Keuken / Overhead). */
function lonenZzp(lines: Record<string, number>): number {
  return (
    (lines.inhuurAfwas ?? 0) +
    (lines.inhuurStewarding ?? 0) +
    (lines.inhuurKeuken ?? 0) +
    (lines.inhuurOverhead ?? 0)
  )
}

type VenueAcc = {
  revenue: number
  labor: number
  revenueFood: number
  revenueBeverage: number
  lonenRevenue: number
  ft: number
  pt: number
  zzp: number
  monthsWithLonen: number
}

function emptyAcc(): VenueAcc {
  return {
    revenue: 0,
    labor: 0,
    revenueFood: 0,
    revenueBeverage: 0,
    lonenRevenue: 0,
    ft: 0,
    pt: 0,
    zzp: 0,
    monthsWithLonen: 0,
  }
}

/**
 * Last 12 sealed monthly P&L rows (revenue > 0).
 * Total labor % + food/bev shares use the full window.
 * FT/PT/ZZP % use months that have Labor Lonen grandchildren (else null).
 */
export async function buildStaffOrgLaborBenchmarks(
  db: Db,
): Promise<{ months: number; year: number; venues: StaffOrgLaborBenchmark[] }> {
  const sealed = await fetchSealedMonthlyPnlRows(db, { limit: ROLLING_MONTHS })
  const months = sealed.length
  const year = sealed[0]?.year ?? new Date().getFullYear()

  const byVenue = new Map<AccountingPnlVenueId, VenueAcc>()
  for (const venueId of ['vkb', 'bea', 'lat'] as const) {
    byVenue.set(venueId, emptyAcc())
  }

  for (const doc of sealed) {
    for (const venueId of ['vkb', 'bea', 'lat'] as const) {
      const row = doc.venues[venueId]
      const acc = byVenue.get(venueId)!
      acc.revenue += row.revenue
      acc.labor += row.labor
      acc.revenueFood += row.revenueFood
      acc.revenueBeverage += row.revenueBeverage

      const lines = row.laborLonenLines
      if (sumLineValues(lines) > 0) {
        acc.lonenRevenue += row.revenue
        acc.ft += lonenFt(lines)
        acc.pt += lonenPt(lines)
        acc.zzp += lonenZzp(lines)
        acc.monthsWithLonen += 1
      }
    }
  }

  const venues: StaffOrgLaborBenchmark[] = []
  for (const venue of DAILY_OPS_PROFIT_VENUE_LOCATIONS) {
    const venueId = ACCOUNTING_PNL_LOCATION_ID_TO_VENUE[venue.locationId] as
      | AccountingPnlVenueId
      | undefined
    if (!venueId) continue
    const acc = byVenue.get(venueId)
    if (!acc || !(acc.revenue > 0)) continue

    const hasLonen = acc.monthsWithLonen > 0 && acc.lonenRevenue > 0
    const split = shareOrDefault(acc.revenueFood, acc.revenueBeverage, venue.locationId)

    venues.push({
      locationId: venue.locationId,
      year,
      monthlyRevenue: Math.round(acc.revenue / months),
      laborCostPct: {
        total: pct(acc.labor, acc.revenue),
        ft: hasLonen ? pct(acc.ft, acc.lonenRevenue) : null,
        pt: hasLonen ? pct(acc.pt, acc.lonenRevenue) : null,
        zzp: hasLonen ? pct(acc.zzp, acc.lonenRevenue) : null,
      },
      keukenRevenueShare: split.keukenRevenueShare,
      bedieningRevenueShare: split.bedieningRevenueShare,
    })
  }

  return { months, year, venues }
}
