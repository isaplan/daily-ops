import type {
  AccountingPnlBenchmarkPeriodDoc,
  AccountingPnlBenchmarkPeriodKind,
} from '~/types/accounting-pnl-benchmark'
import type { AccountingPnlVenueId } from '~/utils/accountingPnlData'
import {
  ACCOUNTING_PNL_YEARS,
  accountingPnlMonthsForYear,
  accountingPnlPeriodLabel,
  accountingPnlTableLines,
  accountingPnlYearLabel,
  type AccountingPnlYear,
} from '~/utils/accountingPnlData'

function periodKindFor (year: AccountingPnlYear, month: number | null): AccountingPnlBenchmarkPeriodKind {
  if (month != null) return 'monthly'
  if (year === 2026) return 'ytd'
  return 'annual'
}

function buildPeriodDoc (
  year: AccountingPnlYear,
  month: number | null,
): AccountingPnlBenchmarkPeriodDoc | null {
  const lines = accountingPnlTableLines(year, month)
  if (!lines.length) return null

  const venues = {} as AccountingPnlBenchmarkPeriodDoc['venues']
  const combined = lines.find((l) => l.key === 'combined')?.row
  for (const line of lines) {
    if (line.key === 'combined') continue
    venues[line.key as AccountingPnlVenueId] = line.row
  }
  if (!combined) return null

  const viewMode = month != null ? 'month' as const : 'year' as const
  const periodLabel = month != null
    ? accountingPnlPeriodLabel(year, viewMode, month)
    : accountingPnlYearLabel(year)

  return {
    year,
    month,
    periodKind: periodKindFor(year, month),
    periodLabel,
    venues,
    combined,
    source: 'accounting_analyse_export',
  }
}

/** All benchmark periods to persist (annual/YTD + monthly). */
export function buildAccountingPnlSeedPeriods (): AccountingPnlBenchmarkPeriodDoc[] {
  const out: AccountingPnlBenchmarkPeriodDoc[] = []
  for (const year of ACCOUNTING_PNL_YEARS) {
    const annual = buildPeriodDoc(year, null)
    if (annual) out.push(annual)
    for (const month of accountingPnlMonthsForYear(year)) {
      const doc = buildPeriodDoc(year, month)
      if (doc) out.push(doc)
    }
  }
  return out
}

export function accountingPnlPeriodFilter (
  year: number,
  month: number | null,
): { year: number, month: number | null } {
  return { year, month: month ?? null }
}
