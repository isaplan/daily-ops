/**
 * @registry-id: accountingPnlBenchmarkService
 * @created: 2026-06-21T00:00:00.000Z
 * @last-modified: 2026-06-22T00:00:00.000Z
 * @description: Seed + read accounting P&L benchmarks (Mongo accounting_pnl_benchmark).
 * @last-fix: [2026-06-22] Year-grid read for stack graph view
 *
 * @exports-to:
 * ✓ server/api/daily-ops/finance/pnl.get.ts
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
  ACCOUNTING_PNL_MONTH_LONG_LABELS,
  accountingPnlMonthsForYear,
  accountingPnlYearLabel,
  type AccountingPnlYear,
} from '~/utils/accountingPnlData'
import {
  accountingPnlPeriodFilter,
  buildAccountingPnlSeedPeriods,
} from '~/utils/accountingPnlSeedPeriods'

export const ACCOUNTING_PNL_BENCHMARK_COLLECTION = 'accounting_pnl_benchmark'

function linesFromPeriod (doc: AccountingPnlBenchmarkPeriodDoc): AccountingPnlBenchmarkTableLineDto[] {
  const lines: AccountingPnlBenchmarkTableLineDto[] = ACCOUNTING_PNL_VENUES.map((venue) => ({
    key: venue.id,
    label: venue.label,
    row: doc.venues[venue.id],
  }))
  lines.push({ key: 'combined', label: 'Combined', row: doc.combined })
  return lines
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
  const months = accountingPnlMonthsForYear(year)
  const docs = await col
    .find({ year, month: { $in: months } })
    .sort({ month: 1 })
    .toArray() as AccountingPnlBenchmarkPeriodDoc[]

  const byMonth = new Map(docs.map((d) => [d.month, d]))
  const columns = months.flatMap((month) => {
    const doc = byMonth.get(month)
    if (!doc) return []
    return [{
      month,
      label: ACCOUNTING_PNL_MONTH_LONG_LABELS[month - 1] ?? String(month),
      venues: ACCOUNTING_PNL_VENUES.map((venue) => ({
        key: venue.id,
        shortLabel: venue.shortLabel,
        row: doc.venues[venue.id],
      })),
    }]
  })

  return { columns }
}

async function fetchYearGrid (
  col: ReturnType<Db['collection']>,
): Promise<AccountingPnlYearGridDto> {
  const docs = await col
    .find({ year: { $in: [...ACCOUNTING_PNL_YEARS] }, month: null })
    .sort({ year: 1 })
    .toArray() as AccountingPnlBenchmarkPeriodDoc[]

  const byYear = new Map(docs.map((d) => [d.year, d]))
  const columns = ACCOUNTING_PNL_YEARS.flatMap((year) => {
    const doc = byYear.get(year)
    if (!doc) return []
    return [{
      year,
      label: accountingPnlYearLabel(year),
      venues: ACCOUNTING_PNL_VENUES.map((venue) => ({
        key: venue.id,
        shortLabel: venue.shortLabel,
        row: doc.venues[venue.id],
      })),
    }]
  })

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
  const count = await col.countDocuments({}, { limit: 1 })
  if (count === 0) await seedAccountingPnlBenchmarks(db)
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

  const doc = await col.findOne(accountingPnlPeriodFilter(year, month))
  if (!doc) {
    return {
      periodLabel: month != null ? `Month ${month} ${year}` : String(year),
      year,
      month,
      lines: [],
      availableYears: [...ACCOUNTING_PNL_YEARS],
      availableMonths: accountingPnlMonthsForYear(year),
    }
  }

  return {
    periodLabel: doc.periodLabel,
    year: doc.year,
    month: doc.month,
    lines: linesFromPeriod(doc),
    availableYears: [...ACCOUNTING_PNL_YEARS],
    availableMonths: accountingPnlMonthsForYear(year),
  }
}
