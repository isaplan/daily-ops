/**
 * Backfill precomputed daily_ops_revenue_benchmark docs (ADR-006 Phase A).
 *
 * Usage:
 *   pnpm snapshots:benchmarks:backfill -- --days 60
 *   pnpm snapshots:benchmarks:backfill -- --start 2026-03-01 --end 2026-05-28
 */

import { getDb } from '../server/utils/db'
import { VENUE_STRIP_LOCATIONS } from '../server/utils/dailyOpsVenueStrip'
import {
  writeRevenueBenchmarkAllLocations,
  writeRevenueBenchmarkForLocation,
} from '../server/utils/dailyOpsRevenue/revenueBenchmark'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '../utils/dailyOpsBusinessDate'

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

function eachDate(start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  while (cur <= end) {
    out.push(cur)
    cur = addCalendarDaysYmd(cur, 1)
  }
  return out
}

async function main() {
  const days = Number(arg('days') ?? '60')
  const end = arg('end') ?? amsterdamOpenRegisterBusinessDateYmd()
  const start = arg('start') ?? addCalendarDaysYmd(end, -(days - 1))

  const db = await getDb()
  const dates = eachDate(start, end)
  const locations = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)

  let written = 0
  for (const asOfDate of dates) {
    for (const locationId of locations) {
      await writeRevenueBenchmarkForLocation(db, asOfDate, locationId)
      written++
    }
    await writeRevenueBenchmarkAllLocations(db, asOfDate)
    written++
  }

  process.stdout.write(
    `Benchmark backfill complete: ${written} docs (${dates.length} dates × ${locations.length + 1} scopes)\n`,
  )
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`)
  process.exit(1)
})
