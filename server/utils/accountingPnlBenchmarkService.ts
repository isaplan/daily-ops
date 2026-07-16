/**
 * @registry-id: accountingPnlBenchmarkService
 * @created: 2026-06-21T00:00:00.000Z
 * @last-modified: 2026-07-16T11:05:00.000Z
 * @description: Seed + read + upsert accounting P&L benchmarks (Mongo accounting_pnl_benchmark).
 * @last-fix: [2026-07-16] Month grid includes DB months beyond seed window
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
import { accountingPnlAssumptionsFromRow } from '~/utils/accountingPnlAssumptions'
import { savePnlAssumptions } from './appSettings/pnlAssumptionsSetting'

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
  lines.push({ key: 'combined', label: 'Combined', row: normalized.combined })
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
  const docs = await col
    .find({ year: { $in: [...ACCOUNTING_PNL_YEARS] }, month: null })
    .sort({ year: 1 })
    .toArray() as AccountingPnlBenchmarkPeriodDoc[]

  const byYear = new Map(docs.map((d) => [d.year, d]))
  const columns = ACCOUNTING_PNL_YEARS.flatMap((year) => {
    const doc = byYear.get(year)
    if (!doc) return []
    const normalized = normalizePeriodDoc(doc)
    return [{
      year,
      label: accountingPnlYearLabel(year),
      venues: ACCOUNTING_PNL_VENUES.map((venue) => ({
        key: venue.id,
        shortLabel: venue.shortLabel,
        row: normalized.venues[venue.id],
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

function periodKindFor (year: number, month: number | null): AccountingPnlBenchmarkPeriodDoc['periodKind'] {
  if (month != null) return 'monthly'
  if (year === 2026) return 'ytd'
  return 'annual'
}

export async function upsertAccountingPnlBenchmarkPeriods (
  db: Db,
  periods: Array<{ year: number; month: number | null; venues: Record<AccountingPnlVenueId, Partial<AccountingPnlRow>> }>,
  options?: { refreshAssumptions?: boolean },
): Promise<{ touched: number; assumptionsUpdated: boolean }> {
  const col = db.collection<AccountingPnlBenchmarkPeriodDoc>(ACCOUNTING_PNL_BENCHMARK_COLLECTION)
  const now = new Date()
  let touched = 0
  let assumptionsSource: AccountingPnlRow | null = null

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
    if (month == null && !assumptionsSource) assumptionsSource = combined
  }

  let assumptionsUpdated = false
  if (options?.refreshAssumptions !== false && assumptionsSource && assumptionsSource.revenue > 0) {
    await savePnlAssumptions(db, accountingPnlAssumptionsFromRow(assumptionsSource))
    assumptionsUpdated = true
  }

  return { touched, assumptionsUpdated }
}

