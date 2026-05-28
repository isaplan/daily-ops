/**
 * Nightly data retention purge — archive + fat-slice delete for sealed snapshot days.
 *
 * Usage:
 *   DATA_RETENTION_ARCHIVE_ENABLED=1 DATA_RETENTION_PURGE_FAT_AGG=1 pnpm retention:purge -- --days 7
 */

import { getDb } from '../server/utils/db'
import { VENUE_STRIP_LOCATIONS } from '../server/utils/dailyOpsVenueStrip'
import { runPostSealRetention } from '../server/utils/dailyOpsBlob/runPostSealRetention'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '../utils/dailyOpsBusinessDate'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '../types/daily-ops-snapshot'

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

async function main() {
  const days = Number(arg('days') ?? '7')
  const end = arg('end') ?? addCalendarDaysYmd(amsterdamOpenRegisterBusinessDateYmd(), -1)
  const start = arg('start') ?? addCalendarDaysYmd(end, -(days - 1))

  const db = await getDb()
  const locationIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)

  const sealed = await db
    .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master)
    .find({
      businessDate: { $gte: start, $lte: end },
      locationId: { $in: locationIds },
      status: 'final',
    })
    .project({ businessDate: 1, locationId: 1 })
    .toArray()

  let ok = 0
  let skipped = 0
  for (const row of sealed) {
    const r = await runPostSealRetention(db, String(row.businessDate), String(row.locationId))
    if (r.skipped.length === 0) ok++
    else {
      skipped++
      process.stdout.write(
        `${row.businessDate} ${row.locationId}: ${r.skipped.join('; ')}\n`,
      )
    }
  }

  process.stdout.write(
    `Retention purge scanned ${sealed.length} sealed venue-days (${start}..${end}): ok=${ok} skipped=${skipped}\n`,
  )
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`)
  process.exit(1)
})
