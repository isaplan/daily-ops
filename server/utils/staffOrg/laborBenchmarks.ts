/**
 * @registry-id: staffOrgLaborBenchmarks
 * @created: 2026-07-23T10:40:00.000Z
 * @last-modified: 2026-08-12T00:50:00.000Z
 * @description: Seed labor % + cost envelope from last 12 sealed accounting P&L months
 * @last-fix: [2026-08-12] Phase 2: attach Finance cost envelope (10%/COGS25%/flex) to seed
 * @adr-ref: ADR-016, ADR-019, ADR-022
 *
 * @exports-to:
 * ✓ server/api/staff-org/labor-benchmarks.get.ts
 */

import type { Db } from 'mongodb'
import type { StaffOrgCostEnvelopeSnapshot, StaffOrgLaborBenchmark } from '~/types/staff-org'
import { STAFF_ORG_WEEKS_PER_MONTH } from '~/types/staff-org'
import {
  PNL_BUDGET_TARGET_COGS_PCT,
  PNL_BUDGET_TARGET_MARGIN,
} from '~/types/accounting-pnl-budget'
import { fetchSealedMonthlyPnlRows } from '~/server/utils/accountingPnl/fetchSealedMonthlyPnlRows'
import {
  ACCOUNTING_PNL_LOCATION_ID_TO_VENUE,
  type AccountingPnlRow,
  type AccountingPnlVenueId,
} from '~/utils/accountingPnlData'
import { sumLineValues } from '~/utils/accountingPnlGrandchildLines'
import {
  fixedLaborFromRow,
} from '~/utils/accountingPnlBreakEvenMath'
import { buildPnlCostEnvelope, weekSliceFromEnvelope } from '~/utils/accountingPnl/costEnvelope'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'
import { defaultTeamRevenueSplit } from '~/utils/staffOrg/locationTargets'

const ROLLING_MONTHS = 12
const OH_STAMP_OVERIGE_LT = -50_000

function pct (part: number, whole: number): number | null {
  if (!(whole > 0) || !Number.isFinite(part)) return null
  return Math.round((part / whole) * 1000) / 10
}

function shareOrDefault (
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

function lonenFt (lines: Record<string, number>): number {
  return (
    (lines.salarisBediening ?? 0)
    + (lines.salarisKeuken ?? 0)
    + (lines.salarisOverhead ?? 0)
  )
}

function lonenPt (lines: Record<string, number>): number {
  return lines.inhuurFb ?? 0
}

function lonenZzp (lines: Record<string, number>): number {
  return (
    (lines.inhuurAfwas ?? 0)
    + (lines.inhuurStewarding ?? 0)
    + (lines.inhuurKeuken ?? 0)
    + (lines.inhuurOverhead ?? 0)
  )
}

function isOhStampMonth (row: AccountingPnlRow): boolean {
  return Number(row.fixedOverige ?? 0) < OH_STAMP_OVERIGE_LT || Number(row.fixed) < 0
}

function snapshotFromEnvelope (
  revenue: number,
  fixedLabor: number,
  fixedOh: number,
): StaffOrgCostEnvelopeSnapshot {
  const env = buildPnlCostEnvelope(revenue, fixedLabor, fixedOh)
  const week = weekSliceFromEnvelope(env)
  return {
    costBudget: env.cost_budget,
    cogsBudget: env.cogs_budget,
    laborOhBudget: env.labor_oh_budget,
    fixedLabor: env.fixed_labor,
    fixedOh: env.fixed_oh,
    flexBudget: env.flex_budget,
    weekCostBudget: week.cost_budget,
    weekFlexBudget: week.flex_budget,
    targetMargin: PNL_BUDGET_TARGET_MARGIN,
    targetCogsPct: PNL_BUDGET_TARGET_COGS_PCT,
  }
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
  cleanFixedLabor: number
  cleanFixedOh: number
  cleanMonths: number
}

function emptyAcc (): VenueAcc {
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
    cleanFixedLabor: 0,
    cleanFixedOh: 0,
    cleanMonths: 0,
  }
}

/**
 * Last 12 sealed monthly P&L rows (revenue > 0).
 * Total labor % + food/bev shares use the full window.
 * FT/PT/ZZP % use months that have Labor Lonen grandchildren (else null).
 * Cost envelope uses clean months (OH-stamp excluded) for fixed labor/OH.
 */
export async function buildStaffOrgLaborBenchmarks (
  db: Db,
): Promise<{ months: number; year: number; weeksPerMonth: number; venues: StaffOrgLaborBenchmark[] }> {
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
        acc.ft += lonenFt(lines as Record<string, number>)
        acc.pt += lonenPt(lines as Record<string, number>)
        acc.zzp += lonenZzp(lines as Record<string, number>)
        acc.monthsWithLonen += 1
      }

      if (row.revenue > 0 && !isOhStampMonth(row)) {
        acc.cleanFixedLabor += fixedLaborFromRow(row)
        acc.cleanFixedOh += row.fixed
        acc.cleanMonths += 1
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
    const monthlyRevenue = Math.round(acc.revenue / months)
    const fixedLaborMonthly = acc.cleanMonths > 0
      ? Math.round(acc.cleanFixedLabor / acc.cleanMonths)
      : 0
    const fixedOhMonthly = acc.cleanMonths > 0
      ? Math.round(acc.cleanFixedOh / acc.cleanMonths)
      : 0

    venues.push({
      locationId: venue.locationId,
      year,
      monthlyRevenue,
      laborCostPct: {
        total: pct(acc.labor, acc.revenue),
        ft: hasLonen ? pct(acc.ft, acc.lonenRevenue) : null,
        pt: hasLonen ? pct(acc.pt, acc.lonenRevenue) : null,
        zzp: hasLonen ? pct(acc.zzp, acc.lonenRevenue) : null,
      },
      keukenRevenueShare: split.keukenRevenueShare,
      bedieningRevenueShare: split.bedieningRevenueShare,
      fixedLaborMonthly,
      fixedOhMonthly,
      costEnvelope: snapshotFromEnvelope(monthlyRevenue, fixedLaborMonthly, fixedOhMonthly),
    })
  }

  return { months, year, weeksPerMonth: STAFF_ORG_WEEKS_PER_MONTH, venues }
}
