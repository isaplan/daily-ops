/**
 * @registry-id: accountingPnlAssumptions
 * @created: 2026-06-22T00:00:00.000Z
 * @last-modified: 2026-06-22T00:00:00.000Z
 * @description: Derive Daily Ops P&L assumption % from accounting totals (year or month, per venue).
 * @last-fix: [2026-06-22] SSOT for profit-by-interval + dashboard profit math
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildProfitByIntervalFromSnapshot.ts
 * ✓ server/utils/dailyOpsMetrics/profitHour.ts
 * ✓ server/utils/dailyOpsMetrics/dtoBuilders.ts
 * ✓ server/utils/dailyOpsSnapshot/drilldown/buildRevenueDrilldownHourly.ts
 */

import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'
import {
  ACCOUNTING_PNL_YEARS,
  accountingPnlMonthsForYear,
  accountingPnlTableLines,
  accountingPnlVenueRow,
  type AccountingPnlRow,
  type AccountingPnlVenueId,
  type AccountingPnlYear,
} from '~/utils/accountingPnlData'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'
import {
  clampPnlPct,
  DEFAULT_PNL_ASSUMPTIONS,
  normalizePnlAssumptions,
} from '~/utils/dailyOpsPnlAssumptionsDefaults'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

export type AccountingPnlAssumptionsSource = 'month' | 'year' | 'prior_year' | 'default'

export type AccountingPnlAssumptionsResolution = {
  assumptions: DailyOpsSimplePnLAssumptions
  source: AccountingPnlAssumptionsSource
  year: AccountingPnlYear | null
  month: number | null
  venueId: AccountingPnlVenueId | 'combined'
}

const LOCATION_TO_VENUE = Object.fromEntries(
  DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => [v.locationId, v.short.toLowerCase() as AccountingPnlVenueId]),
) as Record<string, AccountingPnlVenueId>

function normalizeAccountingYear (year: number): AccountingPnlYear | null {
  if (year === 2024 || year === 2025 || year === 2026) return year
  return null
}

function parseBusinessDateYmd (ymd: string): { year: number; month: number } | null {
  const parts = ymd.split('-')
  if (parts.length !== 3) return null
  const year = Number(parts[0])
  const month = Number(parts[1])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

function nearestAccountingMonth (year: AccountingPnlYear, month: number): number | null {
  const available = accountingPnlMonthsForYear(year)
  if (available.includes(month)) return month
  const prior = available.filter((m) => m <= month)
  return prior.length ? Math.max(...prior) : null
}

function venueTarget (locationId: string | null): AccountingPnlVenueId | 'combined' {
  if (!locationId) return 'combined'
  return LOCATION_TO_VENUE[locationId] ?? 'combined'
}

function rowForPeriod (
  year: AccountingPnlYear,
  month: number | null,
  target: AccountingPnlVenueId | 'combined',
): AccountingPnlRow | null {
  if (target === 'combined') {
    return accountingPnlTableLines(year, month).find((line) => line.key === 'combined')?.row ?? null
  }
  return accountingPnlVenueRow(year, target, month)
}

export function accountingPnlAssumptionsFromRow (row: AccountingPnlRow): DailyOpsSimplePnLAssumptions {
  const cogsPct =
    row.revenue > 0 ? (row.cogs / row.revenue) * 100 : DEFAULT_PNL_ASSUMPTIONS.foodCogsPct
  const overheadPct =
    row.revenue > 0 ? (row.fixed / row.revenue) * 100 : DEFAULT_PNL_ASSUMPTIONS.overheadPct
  const blended = clampPnlPct(cogsPct, DEFAULT_PNL_ASSUMPTIONS.foodCogsPct)
  return normalizePnlAssumptions({
    foodCogsPct: blended,
    bevCogsPct: blended,
    overheadPct: clampPnlPct(overheadPct, DEFAULT_PNL_ASSUMPTIONS.overheadPct),
  })
}

function resolveFromYear (
  year: AccountingPnlYear,
  month: number,
  target: AccountingPnlVenueId | 'combined',
): AccountingPnlAssumptionsResolution | null {
  const resolvedMonth = nearestAccountingMonth(year, month)
  if (resolvedMonth != null) {
    const monthlyRow = rowForPeriod(year, resolvedMonth, target)
    if (monthlyRow && monthlyRow.revenue > 0) {
      return {
        assumptions: accountingPnlAssumptionsFromRow(monthlyRow),
        source: 'month',
        year,
        month: resolvedMonth,
        venueId: target,
      }
    }
  }

  const annualRow = rowForPeriod(year, null, target)
  if (annualRow && annualRow.revenue > 0) {
    return {
      assumptions: accountingPnlAssumptionsFromRow(annualRow),
      source: 'year',
      year,
      month: null,
      venueId: target,
    }
  }

  return null
}

export function resolveAccountingPnlAssumptions (
  businessDateYmd: string,
  locationId: string | null,
): AccountingPnlAssumptionsResolution {
  const target = venueTarget(locationId)
  const parsed = parseBusinessDateYmd(businessDateYmd)
  if (!parsed) {
    return {
      assumptions: { ...DEFAULT_PNL_ASSUMPTIONS },
      source: 'default',
      year: null,
      month: null,
      venueId: target,
    }
  }

  const accountingYear = normalizeAccountingYear(parsed.year)
  if (accountingYear) {
    const current = resolveFromYear(accountingYear, parsed.month, target)
    if (current) return current
  }

  for (let i = ACCOUNTING_PNL_YEARS.length - 1; i >= 0; i -= 1) {
    const year = ACCOUNTING_PNL_YEARS[i]!
    if (accountingYear && year >= accountingYear) continue
    const prior = resolveFromYear(year, 12, target)
    if (prior) {
      return { ...prior, source: 'prior_year' }
    }
  }

  return {
    assumptions: { ...DEFAULT_PNL_ASSUMPTIONS },
    source: 'default',
    year: null,
    month: null,
    venueId: target,
  }
}

export function formatAccountingProfitEstimatesNote (): string {
  return (
    'Cost of sales and fixed overhead from accounting benchmarks (monthly when available, else year total). ' +
    'Labor: Eitje loaded cost × accounting calibration multiplier (per venue/year).'
  )
}

export type AccountingPnlBenchmarkLine = {
  locationId: string | null
  venueId: AccountingPnlVenueId | 'combined'
  label: string
  revenue: number
  labor: number
  cogs: number
  fixed: number
  result: number
}

export function accountingPnlBenchmarkForYear (
  year: AccountingPnlYear,
): AccountingPnlBenchmarkLine[] {
  return accountingPnlTableLines(year, null).map((line) => ({
    locationId:
      line.key === 'combined'
        ? null
        : (DAILY_OPS_PROFIT_VENUE_LOCATIONS.find((v) => v.short.toLowerCase() === line.key)?.locationId ?? null),
    venueId: line.key as AccountingPnlVenueId | 'combined',
    label: line.label,
    revenue: line.row.revenue,
    labor: line.row.labor,
    cogs: line.row.cogs,
    fixed: line.row.fixed,
    result: line.row.result,
  }))
}

export function accountingPnlBenchmarkYearForRange (
  startDate: string,
  endDate: string,
): AccountingPnlYear | null {
  if (!startDate || startDate.slice(0, 4) !== endDate.slice(0, 4)) return null
  const year = Number(startDate.slice(0, 4))
  if (year === 2024 || year === 2025 || year === 2026) return year
  return null
}
