/**
 * Backfill daily_ops snapshots (master + ALL sections: revenue, labor/Eitje operational, hourly, products, tables, workers).
 *
 * Default: discover oldest → newest business_date in Mongo, then build newest-first.
 *
 * Usage:
 *   pnpm snapshots:backfill
 *   pnpm snapshots:backfill -- --dry-run
 *   pnpm snapshots:backfill -- --start 2024-01-01 --end 2026-05-20
 *   pnpm snapshots:backfill -- --location 69d6cfa63d2adf93b79d1ae6
 *
 * Requires: MONGODB_URI (or DATABASE_URL) in .env / .env.local
 */

import { getDb } from '../server/utils/db'
import { buildDailyOpsSnapshot } from '../server/services/dailyOpsSnapshotService'
import {
  addCalendarDaysYmd,
  amsterdamOpenRegisterBusinessDateYmd,
} from '../utils/dailyOpsBusinessDate'

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function addDay(ymd: string): string {
  return addCalendarDaysYmd(ymd, 1)
}

function listDatesInclusive(start: string, end: string): string[] {
  const out: string[] = []
  let cursor = start
  while (cursor <= end) {
    out.push(cursor)
    cursor = addDay(cursor)
  }
  return out
}

function minYmd(a: string, b: string): string {
  return a <= b ? a : b
}

function maxYmd(a: string, b: string): string {
  return a >= b ? a : b
}

async function minMaxOnCollection(
  db: Awaited<ReturnType<typeof getDb>>,
  collection: string,
  dateField: string,
): Promise<{ min: string; max: string } | null> {
  const coll = db.collection(collection)
  const n = await coll.estimatedDocumentCount()
  if (n === 0) return null
  const [lo] = await coll.find().sort({ [dateField]: 1 }).limit(1).project({ [dateField]: 1 }).toArray()
  const [hi] = await coll.find().sort({ [dateField]: -1 }).limit(1).project({ [dateField]: 1 }).toArray()
  const min = lo?.[dateField]
  const max = hi?.[dateField]
  if (typeof min !== 'string' || typeof max !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(min)) {
    return null
  }
  if (typeof max !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(max)) {
    return { min, max: min }
  }
  return { min, max }
}

async function discoverBusinessDateRange(
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<{ startDate: string; endDate: string; sources: string[] }> {
  const suffix =
    process.env.BORK_AGG_VERSION_SUFFIX ?? process.env.BORK_AGG_V2_SUFFIX ?? '_v2'
  const candidates: Array<{ label: string; min: string; max: string }> = []
  const seenColl = new Set<string>()

  for (const sfx of [suffix, '_v2', '']) {
    const name = `bork_business_days${sfx}`
    if (seenColl.has(name)) continue
    seenColl.add(name)
    const mm = await minMaxOnCollection(db, name, 'business_date')
    if (mm) candidates.push({ label: name, ...mm })
  }

  const inboxMm = await minMaxOnCollection(db, 'inbox-bork-basis-report', 'business_date')
  if (inboxMm) candidates.push({ label: 'inbox-bork-basis-report', ...inboxMm })

  const inboxDateMm = await minMaxOnCollection(db, 'inbox-bork-basis-report', 'date')
  if (inboxDateMm) candidates.push({ label: 'inbox-bork-basis-report (date)', ...inboxDateMm })

  if (candidates.length === 0) {
    throw new Error(
      'No business dates found in bork_business_days* or inbox-bork-basis-report. Run Bork sync / inbox first.',
    )
  }

  let startDate = candidates[0]!.min
  let endDate = candidates[0]!.max
  for (const c of candidates) {
    startDate = minYmd(startDate, c.min)
    endDate = maxYmd(endDate, c.max)
  }

  const openToday = amsterdamOpenRegisterBusinessDateYmd()
  endDate = minYmd(endDate, openToday)

  return {
    startDate,
    endDate,
    sources: candidates.map((c) => `${c.label}: ${c.min} → ${c.max}`),
  }
}

async function main() {
  const dryRun = hasFlag('dry-run')
  const locationId = arg('location')
  const db = await getDb()

  const discovered = await discoverBusinessDateRange(db)
  let startDate = arg('start') ?? discovered.startDate
  let endDate = arg('end') ?? discovered.endDate

  if (startDate > endDate) {
    throw new Error(`Invalid range: start ${startDate} > end ${endDate}`)
  }

  const dates = listDatesInclusive(startDate, endDate).reverse()

  process.stdout.write(
    [
      '[snapshot:backfill-revenue]',
      `range=${startDate}..${endDate} (${dates.length} days)`,
      `order=newest-first`,
      `location=${locationId ?? 'all with Bork/Eitje on that day'}`,
      '',
      'Sources:',
      ...discovered.sources.map((s) => `  - ${s}`),
      '',
    ].join('\n'),
  )

  if (dryRun) {
    process.stdout.write('Dry run — first 5 dates: ' + dates.slice(0, 5).join(', ') + '\n')
    process.exit(0)
  }

  const t0 = Date.now()
  let built = 0
  let errors = 0
  let dayIndex = 0

  for (const businessDate of dates) {
    dayIndex++
    const r = await buildDailyOpsSnapshot({ businessDate, locationId })
    built += r.built.length
    errors += r.errors.length
    if (r.errors.length > 0) {
      for (const e of r.errors) {
        process.stderr.write(`  ERROR ${businessDate} ${e.locationId}: ${e.error}\n`)
      }
    }
    const pct = Math.round((dayIndex / dates.length) * 100)
    process.stdout.write(
      `\r[snapshot:backfill-revenue] ${businessDate} (${dayIndex}/${dates.length} ${pct}%) built+${r.built.length} err+${r.errors.length}`,
    )
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  process.stdout.write(
    `\nDone in ${sec}s | location-days built=${built} errors=${errors}\n`,
  )
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
