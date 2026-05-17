/**
 * scripts/backfill-snapshots.ts
 *
 * Backfill daily_ops_snapshot (master + sections) for a date range, all locations.
 * Usage: tsx scripts/backfill-snapshots.ts --start 2026-02-17 --end 2026-05-11
 */

import { buildDailyOpsSnapshotRange } from '../server/services/dailyOpsSnapshotService'

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return def
}

async function run() {
  const start = arg('start')
  const end = arg('end')
  const locationId = arg('location')
  if (!start || !end) {
    console.error('Usage: tsx scripts/backfill-snapshots.ts --start YYYY-MM-DD --end YYYY-MM-DD [--location <id>]')
    process.exit(2)
  }

  const t0 = Date.now()
  console.log(`[snapshot:backfill] window=${start}..${end} location=${locationId ?? 'all'}`)
  const result = await buildDailyOpsSnapshotRange({ startDate: start, endDate: end, locationId })
  const ms = Date.now() - t0
  console.log(`[snapshot:backfill] done in ${(ms / 1000).toFixed(1)}s | built=${result.built} errors=${result.errors}`)

  process.exit(result.errors > 0 ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
