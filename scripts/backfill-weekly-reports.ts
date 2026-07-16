/**
 * Backfill weekly_reports documents for a year/week range × venue strip locations.
 *
 * Usage:
 *   pnpm weekly-reports:backfill
 *   pnpm weekly-reports:backfill -- --year 2026 --from-week 1 --to-week 28
 *   pnpm weekly-reports:backfill -- --year 2026 --from-week 24 --to-week 27 --force
 */

import { getDb } from '../server/utils/db'
import { weekRangeFromKey } from '../server/utils/dailyOpsWeeklyReport/weekRange'
import { VENUE_STRIP_LOCATIONS } from '../server/utils/venueStrip/constants'
import { upsertWeeklyReportDocument } from '../server/utils/weeklyReportDocument/upsertWeeklyReportDocument'

function arg(name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`)
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : defaultValue
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function weekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`
}

async function main(): Promise<void> {
  const year = Number(arg('year', '2026'))
  const fromWeek = Number(arg('from-week', '1'))
  const toWeek = Number(arg('to-week', '28'))
  const force = hasFlag('force')

  if (!Number.isFinite(year) || !Number.isFinite(fromWeek) || !Number.isFinite(toWeek)) {
    process.stderr.write('Invalid --year, --from-week, or --to-week\n')
    process.exit(1)
  }

  const weekKeys: string[] = []
  for (let w = fromWeek; w <= toWeek; w += 1) {
    const key = weekKey(year, w)
    if (!weekRangeFromKey(key)) {
      process.stderr.write(`Skipping invalid week key: ${key}\n`)
      continue
    }
    weekKeys.push(key)
  }

  const db = await getDb()
  let written = 0
  let errors = 0

  process.stdout.write(
    `[weekly-reports:backfill] ${weekKeys.length} weeks × ${VENUE_STRIP_LOCATIONS.length} venues\n`,
  )

  for (const weekKeyValue of weekKeys) {
    for (const venue of VENUE_STRIP_LOCATIONS) {
      try {
        await upsertWeeklyReportDocument(db, weekKeyValue, venue.locationId, { force })
        written += 1
        process.stdout.write(`  ✓ ${weekKeyValue} · ${venue.locationName}\n`)
      } catch (err) {
        errors += 1
        const msg = err instanceof Error ? err.message : String(err)
        process.stderr.write(`  ✗ ${weekKeyValue} · ${venue.locationName}: ${msg}\n`)
      }
    }
  }

  process.stdout.write(`[weekly-reports:backfill] done written=${written} errors=${errors}\n`)
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
