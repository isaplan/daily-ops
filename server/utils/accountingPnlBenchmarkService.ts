/**
 * @registry-id: accountingPnlBenchmarkService
 * @created: 2026-06-21T00:00:00.000Z
 * @last-modified: 2026-08-04T22:31:45.000Z
 * @description: Seed + read + upsert accounting P&L benchmarks (Mongo accounting_pnl_benchmark).
 * @last-fix: [2026-08-04] Year view sums sealed monthly docs (live YTD); not frozen seed YTD
 * @adr-ref: ADR-014, ADR-019
 *
 * @exports-to:
 * ✓ server/api/daily-ops/finance/pnl.get.ts
 * ✓ server/api/daily-ops/finance/pnl.put.ts
 */

import type { Db } from 'mongodb'
import type {
  AccountingPnlBenchmarkPeriodDoc,
  AccountingPnlBenchmarkResponseDto,
  AccountingPnlBenchmarkTableLineDto,
  AccountingPnlMonthGridDto,
  AccountingPnlYearGridDto,
} from '~/types/accounting-pnl-benchmark'
import {
  ACCOUNTING_PNL_VENUES,
  ACCOUNTING_PNL_YEARS,
  ACCOUNTING_PNL_MONTH_LABELS,
  ACCOUNTING_PNL_MONTH_LONG_LABELS,
  accountingPnlMonthsForYear,
  accountingPnlPeriodLabel,
  accountingPnlYearLabel,
  type AccountingPnlRow,
  type AccountingPnlVenueId,
  type AccountingPnlYear,
} from '~/utils/accountingPnlData'
import {
  accountingPnlPeriodFilter,
  buildAccountingPnlSeedPeriods,
} from '~/utils/accountingPnlSeedPeriods'
import {
  normalizeAccountingPnlRow,
  sealAccountingPnlRow,
  sumAccountingPnlRows,
} from '~/utils/accountingPnlRowMath'
import { refreshFinanceAssumptions } from './accountingPnl/refreshFinanceAssumptions'

export const ACCOUNTING_PNL_BENCHMARK_COLLECTION = 'accounting_pnl_benchmark'

function normalizeVenueMap (
  venues: AccountingPnlBenchmarkPeriodDoc['venues'],
): Record<AccountingPnlVenueId, AccountingPnlRow> {
  return {
    vkb: normalizeAccountingPnlRow(venues.vkb),
    bea: normalizeAccountingPnlRow(venues.bea),
    lat: normalizeAccountingPnlRow(venues.lat),
  }
}

function normalizePeriodDoc (doc: AccountingPnlBenchmarkPeriodDoc): AccountingPnlBenchmarkPeriodDoc {
  const venues = normalizeVenueMap(doc.venues)
  return {
    ...doc,
    venues,
    combined: normalizeAccountingPnlRow(doc.combined ?? sumAccountingPnlRows(Object.values(venues))),
  }
}

function linesFromPeriod (doc: AccountingPnlBenchmarkPeriodDoc): AccountingPnlBenchmarkTableLineDto[] {
  const normalized = normalizePeriodDoc(doc)
  const lines: AccountingPnlBenchmarkTableLineDto[] = ACCOUNTING_PNL_VENUES.map((venue) => ({
    key: venue.id,
    label: venue.label,
    row: normalized.venues[venue.id],
  }))
  lines.push({ key: 'combined', label: 'Total (3 venues)', row: normalized.combined })
  return lines
}

function yearLabelFromMonths (year: number, months: number[]): string {
  if (!months.length) return String(year)
  const sorted = [...months].sort((a, b) => a - b)
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  if (first === 1 && last === 12 && sorted.length === 12) return String(year)
  const short = (m: number): string => ACCOUNTING_PNL_MONTH_LABELS[m - 1] ?? String(m)
  if (first === last) return `${year} (${short(first)})`
  return `${year} (${short(first)}–${short(last)} YTD)`
}

/**
 * Prefer live sum of sealed monthly docs over the frozen annual/YTD seed doc.
 * Returns null when no monthly rows with revenue exist (caller falls back to annual).
 */
async function buildYearPeriodFromMonths (
  col: ReturnType<Db['collection']>,
  year: AccountingPnlYear,
): Promise<AccountingPnlBenchmarkPeriodDoc | null> {
  const docs = await col
    .find({ year, month: { $ne: null, $gte: 1, $lte: 12 } })
    .sort({ month: 1 })
    .toArray() as AccountingPnlBenchmarkPeriodDoc[]

  const withRevenue = docs
    .map((d) => normalizePeriodDoc(d))
    .filter((d) => Number(d.combined?.revenue ?? 0) > 0 || ACCOUNTING_PNL_VENUES.some((v) => Number(d.venues[v.id]?.revenue ?? 0) > 0))

  if (!withRevenue.length) return null

  const months = withRevenue
    .map((d) => d.month)
    .filter((m): m is number => typeof m === 'number')

  const venues = {
    vkb: sumAccountingPnlRows(withRevenue.map((d) => d.venues.vkb)),
    bea: sumAccountingPnlRows(withRevenue.map((d) => d.venues.bea)),
    lat: sumAccountingPnlRows(withRevenue.map((d) => d.venues.lat)),
  }
  const combined = sumAccountingPnlRows(Object.values(venues))

  return {
    year,
    month: null,
    periodKind: year === 2026 ? 'ytd' : 'annual',
    periodLabel: yearLabelFromMonths(year, months),
    venues,
    combined,
    source: 'manual_edit',
  }
}

async function resolveYearPeriodDoc (
  col: ReturnType<Db['collection']>,
  year: AccountingPnlYear,
): Promise<AccountingPnlBenchmarkPeriodDoc | null> {
  const fromMonths = await buildYearPeriodFromMonths(col, year)
  if (fromMonths) return fromMonths
  const annual = await col.findOne(accountingPnlPeriodFilter(year, null)) as AccountingPnlBenchmarkPeriodDoc | null
  return annual ? normalizePeriodDoc(annual) : null
}

function normalizeYear (raw: unknown): AccountingPnlYear | null {
  const year = Number(raw)
  if (year === 2024 || year === 2025 || year === 2026) return year
  return null
}

function normalizeMonth (raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const month = Number(raw)
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  return month
}

function normalizeGrid (raw: unknown): 'months' | 'years' | null {
  if (raw === 'months') return 'months'
  if (raw === 'years') return 'years'
  return null
}

async function fetchMonthGrid (
  col: ReturnType<Db['collection']>,
  year: AccountingPnlYear,
): Promise<AccountingPnlMonthGridDto> {
  const docs = await col
    .find({ year, month: { $ne: null, $gte: 1, $lte: 12 } })
    .sort({ month: 1 })
    .toArray() as AccountingPnlBenchmarkPeriodDoc[]

  const seedMonths = accountingPnlMonthsForYear(year)
  const dbMonths = docs
    .map((d) => d.month)
    .filter((m): m is number => typeof m === 'number' && m >= 1 && m <= 12)
  const months = [...new Set([...seedMonths, ...dbMonths])].sort((a, b) => a - b)

  const byMonth = new Map(docs.map((d) => [d.month, d]))
  const columns = months.flatMap((month) => {
    const doc = byMonth.get(month)
    if (!doc) return []
    const normalized = normalizePeriodDoc(doc)
    return [{
      month,
      label: ACCOUNTING_PNL_MONTH_LONG_LABELS[month - 1] ?? String(month),
      venues: ACCOUNTING_PNL_VENUES.map((venue) => ({
        key: venue.id,
        shortLabel: venue.shortLabel,
        row: normalized.venues[venue.id],
      })),
    }]
  })

  return { columns }
}

async function fetchYearGrid (
  col: ReturnType<Db['collection']>,
): Promise<AccountingPnlYearGridDto> {
  const columns = []
  for (const year of ACCOUNTING_PNL_YEARS) {
    const doc = await resolveYearPeriodDoc(col, year)
    if (!doc) continue
    const normalized = normalizePeriodDoc(doc)
    columns.push({
      year,
      label: normalized.periodLabel || accountingPnlYearLabel(year),
      venues: ACCOUNTING_PNL_VENUES.map((venue) => ({
        key: venue.id,
        shortLabel: venue.shortLabel,
        row: normalized.venues[venue.id],
      })),
    })
  }

  return { columns }
}

export async function seedAccountingPnlBenchmarks (db: Db): Promise<number> {
  const col = db.collection<AccountingPnlBenchmarkPeriodDoc>(ACCOUNTING_PNL_BENCHMARK_COLLECTION)
  const periods = buildAccountingPnlSeedPeriods()
  let touched = 0
  const now = new Date()
  for (const period of periods) {
    const filter = accountingPnlPeriodFilter(period.year, period.month)
    const res = await col.updateOne(
      filter,
      {
        $set: {
          ...period,
          seededAt: now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    )
    if (res.upsertedCount > 0 || res.modifiedCount > 0) touched++
  }
  await col.createIndex({ year: 1, month: 1 }, { unique: true })
  return touched
}

export async function ensureAccountingPnlBenchmarksSeeded (db: Db): Promise<void> {
  const col = db.collection(ACCOUNTING_PNL_BENCHMARK_COLLECTION)
  const sample = await col.findOne({}) as AccountingPnlBenchmarkPeriodDoc | null
  if (!sample) {
    await seedAccountingPnlBenchmarks(db)
    return
  }
  // Re-seed when labor/fixed children are missing (schema upgrade).
  if (sample.venues?.vkb != null && sample.venues.vkb.laborLonen == null) {
    await seedAccountingPnlBenchmarks(db)
  }
}

export async function fetchAccountingPnlBenchmark (
  db: Db,
  yearRaw: unknown,
  monthRaw: unknown,
  gridRaw?: unknown,
): Promise<AccountingPnlBenchmarkResponseDto> {
  await ensureAccountingPnlBenchmarksSeeded(db)
  const year = normalizeYear(yearRaw) ?? 2026
  const month = normalizeMonth(monthRaw)
  const grid = normalizeGrid(gridRaw)

  const col = db.collection<AccountingPnlBenchmarkPeriodDoc>(ACCOUNTING_PNL_BENCHMARK_COLLECTION)

  if (grid === 'years') {
    const yearGrid = await fetchYearGrid(col)
    return {
      periodLabel: 'All years',
      year,
      month: null,
      lines: [],
      yearGrid,
      availableYears: [...ACCOUNTING_PNL_YEARS],
      availableMonths: accountingPnlMonthsForYear(year),
    }
  }

  if (grid === 'months') {
    const monthGrid = await fetchMonthGrid(col, year)
    return {
      periodLabel: accountingPnlYearLabel(year),
      year,
      month: null,
      lines: [],
      monthGrid,
      availableYears: [...ACCOUNTING_PNL_YEARS],
      availableMonths: accountingPnlMonthsForYear(year),
    }
  }

  if (month != null) {
    const monthDoc = await col.findOne(accountingPnlPeriodFilter(year, month)) as AccountingPnlBenchmarkPeriodDoc | null
    if (!monthDoc) {
      return {
        periodLabel: accountingPnlPeriodLabel(year, 'month', month),
        year,
        month,
        lines: [],
        availableYears: [...ACCOUNTING_PNL_YEARS],
        availableMonths: accountingPnlMonthsForYear(year),
      }
    }
    return {
      periodLabel: monthDoc.periodLabel,
      year: monthDoc.year,
      month: monthDoc.month,
      lines: linesFromPeriod(monthDoc),
      availableYears: [...ACCOUNTING_PNL_YEARS],
      availableMonths: accountingPnlMonthsForYear(year),
    }
  }

  const doc = await resolveYearPeriodDoc(col, year)
  if (!doc) {
    return {
      periodLabel: accountingPnlYearLabel(year),
      year,
      month: null,
      lines: [],
      availableYears: [...ACCOUNTING_PNL_YEARS],
      availableMonths: accountingPnlMonthsForYear(year),
    }
  }

  return {
    periodLabel: doc.periodLabel,
    year: doc.year,
    month: null,
    lines: linesFromPeriod(doc),
    availableYears: [...ACCOUNTING_PNL_YEARS],
    availableMonths: accountingPnlMonthsForYear(year),
  }
}

function periodKindFor (year: number, month: number | null): AccountingPnlBenchmarkPeriodDoc['periodKind'] {
  if (month != null) return 'monthly'
  if (year === 2026) return 'ytd'
  return 'annual'
}

export async function upsertAccountingPnlBenchmarkPeriods (
  db: Db,
  periods: Array<{ year: number; month: number | null; venues: Record<AccountingPnlVenueId, Partial<AccountingPnlRow>> }>,
  options?: { refreshAssumptions?: boolean },
): Promise<{ touched: number; assumptionsUpdated: boolean; breakEvenUpdated: boolean; monthsUsed: number }> {
  const col = db.collection<AccountingPnlBenchmarkPeriodDoc>(ACCOUNTING_PNL_BENCHMARK_COLLECTION)
  const now = new Date()
  let touched = 0

  for (const period of periods) {
    const year = normalizeYear(period.year)
    if (!year) continue
    const month = period.month == null ? null : normalizeMonth(period.month)
    if (period.month != null && month == null) continue

    const sealedVenues = {
      vkb: sealAccountingPnlRow(period.venues.vkb ?? {}),
      bea: sealAccountingPnlRow(period.venues.bea ?? {}),
      lat: sealAccountingPnlRow(period.venues.lat ?? {}),
    }
    const combined = sumAccountingPnlRows(Object.values(sealedVenues))
    const viewMode = month != null ? 'month' as const : 'year' as const
    const periodLabel = month != null
      ? accountingPnlPeriodLabel(year, viewMode, month)
      : accountingPnlYearLabel(year)

    const doc: AccountingPnlBenchmarkPeriodDoc = {
      year,
      month,
      periodKind: periodKindFor(year, month),
      periodLabel,
      venues: sealedVenues,
      combined,
      source: 'manual_edit',
    }

    const res = await col.updateOne(
      accountingPnlPeriodFilter(year, month),
      {
        $set: { ...doc, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    )
    if (res.upsertedCount > 0 || res.modifiedCount > 0) touched++
  }

  if (options?.refreshAssumptions === false) {
    return { touched, assumptionsUpdated: false, breakEvenUpdated: false, monthsUsed: 0 }
  }

  const refreshed = await refreshFinanceAssumptions(db)
  return {
    touched,
    assumptionsUpdated: refreshed.assumptionsUpdated,
    breakEvenUpdated: refreshed.breakEvenUpdated,
    monthsUsed: refreshed.monthsUsed,
  }
}

