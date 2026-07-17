/**
 * Backfill monthly_reports documents for a year/month range × venue strip locations.
 *
 * Usage:
 *   pnpm monthly-reports:backfill
 *   pnpm monthly-reports:backfill -- --year 2026 --from-month 1 --to-month 6
 *   pnpm monthly-reports:backfill -- --year 2025 --from-month 1 --to-month 12 --force
 */

import { getDb } from '../server/utils/db'
import { monthRangeFromKey } from '../server/utils/dailyOpsMonthlyReport/monthRange'
import { VENUE_STRIP_LOCATIONS } from '../server/utils/venueStrip/constants'
import { upsertMonthlyReportDocument } from '../server/utils/monthlyReportDocument/upsertMonthlyReportDocument'

function arg(name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`)
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : defaultValue
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

async function main(): Promise<void> {
  const year = Number(arg('year', '2026'))
  const fromMonth = Number(arg('from-month', '1'))
  const toMonth = Number(arg('to-month', '6'))
  const force = hasFlag('force')

  if (!Number.isFinite(year) || !Number.isFinite(fromMonth) || !Number.isFinite(toMonth)) {
    process.stderr.write('Invalid --year, --from-month, or --to-month\n')
    process.exit(1)
  }
  if (fromMonth < 1 || toMonth > 12 || fromMonth > toMonth) {
    process.stderr.write('Months must be 1–12 and from-month ≤ to-month\n')
    process.exit(1)
  }

  const monthKeys: string[] = []
  for (let m = fromMonth; m <= toMonth; m += 1) {
    const key = monthKey(year, m)
    if (!monthRangeFromKey(key)) {
      process.stderr.write(`Skipping invalid month key: ${key}\n`)
      continue
    }
    monthKeys.push(key)
  }

  const db = await getDb()
  let written = 0
  let errors = 0

  process.stdout.write(
    `[monthly-reports:backfill] ${monthKeys.length} months × ${VENUE_STRIP_LOCATIONS.length} venues\n`,
  )

  for (const monthKeyValue of monthKeys) {
    for (const venue of VENUE_STRIP_LOCATIONS) {
      try {
        await upsertMonthlyReportDocument(db, monthKeyValue, venue.locationId, { force })
        written += 1
        process.stdout.write(`  ✓ ${monthKeyValue} · ${venue.locationName}\n`)
      } catch (err) {
        errors += 1
        const msg = err instanceof Error ? err.message : String(err)
        process.stderr.write(`  ✗ ${monthKeyValue} · ${venue.locationName}: ${msg}\n`)
      }
    }
  }

  process.stdout.write(`[monthly-reports:backfill] done written=${written} errors=${errors}\n`)
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
