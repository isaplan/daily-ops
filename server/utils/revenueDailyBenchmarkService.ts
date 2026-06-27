/**
 * @registry-id: revenueDailyBenchmarkService
 * @created: 2026-06-24T00:00:00.000Z
 * @last-modified: 2026-06-24T00:00:00.000Z
 * @description: Seed + read Datalab daily revenue benchmarks (Mongo revenue_daily_benchmark)
 * @last-fix: [2026-06-24] 2024 full-year Datalab CSV import
 * @adr-ref: ADR-004, ADR-006
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueSection.ts
 * ✓ scripts/seed-revenue-daily-benchmarks.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Db } from 'mongodb'
import type { RevenueDailyBenchmarkDoc } from '~/types/revenue-daily-benchmark'
import { parseDatalabDailyRevenueCsv } from '~/utils/borkDatalabDailyRevenueCsv'

export const REVENUE_DAILY_BENCHMARK_COLLECTION = 'revenue_daily_benchmark'

export const DEFAULT_DATALAB_2024_CSV = resolve(
  process.cwd(),
  'dev-docs/validation-data-eitje-bork/bork-validation/daily-revenue-datalab-2024-full-year.csv',
)

export type RevenueDailyBenchmarkTotals = {
  ex_vat: number
  inc_vat: number
  vat: number
  quantity: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function docToTotals(doc: RevenueDailyBenchmarkDoc): RevenueDailyBenchmarkTotals {
  return {
    ex_vat: doc.ex_vat,
    inc_vat: doc.inc_vat,
    vat: doc.vat,
    quantity: doc.quantity,
  }
}

export async function readRevenueDailyBenchmark(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<RevenueDailyBenchmarkTotals | null> {
  const doc = await db
    .collection<RevenueDailyBenchmarkDoc>(REVENUE_DAILY_BENCHMARK_COLLECTION)
    .findOne({ businessDate, locationId })
  if (!doc) return null
  if (doc.ex_vat <= 0 && doc.inc_vat <= 0) return null
  return docToTotals(doc)
}

export async function seedRevenueDailyBenchmarksFromCsv(
  db: Db,
  csvPath: string = DEFAULT_DATALAB_2024_CSV,
): Promise<{ upserted: number; skipped: number; sourceFile: string }> {
  const sourceFile = csvPath.startsWith(process.cwd())
    ? csvPath.slice(process.cwd().length + 1)
    : csvPath
  const csvText = readFileSync(csvPath, 'utf-8')
  const parsed = parseDatalabDailyRevenueCsv(csvText)
  const col = db.collection<RevenueDailyBenchmarkDoc>(REVENUE_DAILY_BENCHMARK_COLLECTION)
  const now = new Date()
  let upserted = 0
  let skipped = 0

  for (const row of parsed) {
    const ex_vat = round2(row.ex_vat)
    const inc_vat = round2(row.inc_vat)
    if (ex_vat <= 0 && inc_vat <= 0) {
      skipped += 1
      continue
    }
    const vat = round2(inc_vat - ex_vat)
    const doc: RevenueDailyBenchmarkDoc = {
      businessDate: row.businessDate,
      locationId: row.locationId,
      locationName: row.locationName,
      ex_vat,
      inc_vat,
      vat,
      quantity: row.quantity,
      source: 'datalab_export',
      sourceFile,
      updatedAt: now,
    }
    await col.updateOne(
      { businessDate: row.businessDate, locationId: row.locationId },
      { $set: doc },
      { upsert: true },
    )
    upserted += 1
  }

  await col.createIndex({ businessDate: 1, locationId: 1 }, { unique: true })
  await col.createIndex({ businessDate: 1 })

  return { upserted, skipped, sourceFile }
}
