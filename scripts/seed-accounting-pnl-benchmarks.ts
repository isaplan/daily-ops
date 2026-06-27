/**
 * Seed accounting P&L benchmarks into Mongo (accounting_pnl_benchmark).
 * Run: pnpm exec tsx scripts/seed-accounting-pnl-benchmarks.ts
 */

import { getDb } from '../server/utils/db'
import {
  ACCOUNTING_PNL_BENCHMARK_COLLECTION,
  seedAccountingPnlBenchmarks,
} from '../server/utils/accountingPnlBenchmarkService'
import { buildAccountingPnlSeedPeriods } from '../utils/accountingPnlSeedPeriods'

async function main (): Promise<void> {
  const db = await getDb()
  const expected = buildAccountingPnlSeedPeriods().length
  const touched = await seedAccountingPnlBenchmarks(db)
  const count = await db.collection(ACCOUNTING_PNL_BENCHMARK_COLLECTION).countDocuments()
  process.stdout.write(
    `accounting_pnl_benchmark: ${count} docs (${expected} expected), ${touched} upserted/updated\n`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  })
