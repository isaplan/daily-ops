/**
 * Backfill daily_ops snapshot sections (incl. revenue hourly/products/tables/workers).
 * Usage: pnpm exec tsx scripts/backfill-revenue-snapshot-sections.ts 2026-01-01 2026-05-19
 */
import { buildDailyOpsSnapshotRange } from '../server/services/dailyOpsSnapshotService'

async function main() {
  const start = process.argv[2] ?? '2026-05-01'
  const end = process.argv[3] ?? start
  const r = await buildDailyOpsSnapshotRange({ startDate: start, endDate: end })
  process.stdout.write(`Built ${r.built} sections, errors ${r.errors} (${start} – ${end}).\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
