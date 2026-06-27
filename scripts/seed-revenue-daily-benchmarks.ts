/**
 * Seed Datalab daily revenue benchmarks into Mongo (revenue_daily_benchmark).
 * Run: pnpm seed:revenue-daily-benchmark
 *
 * Optional: pnpm seed:revenue-daily-benchmark -- --csv path/to/export.csv
 */

import { getDb } from '../server/utils/db'
import {
  DEFAULT_DATALAB_2024_CSV,
  REVENUE_DAILY_BENCHMARK_COLLECTION,
  seedRevenueDailyBenchmarksFromCsv,
} from '../server/utils/revenueDailyBenchmarkService'

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

async function main(): Promise<void> {
  const csvPath = arg('csv') ?? DEFAULT_DATALAB_2024_CSV
  const db = await getDb()
  const result = await seedRevenueDailyBenchmarksFromCsv(db, csvPath)
  const count = await db.collection(REVENUE_DAILY_BENCHMARK_COLLECTION).countDocuments()
  process.stdout.write(
    `revenue_daily_benchmark: ${count} docs, ${result.upserted} upserted, ${result.skipped} skipped (zero rows) from ${result.sourceFile}\n`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  })
