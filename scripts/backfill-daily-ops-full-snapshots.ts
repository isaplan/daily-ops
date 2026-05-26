/**
 * Backfill full daily_ops snapshots (master + ALL sections: revenue, labor/Eitje operational, hourly, products, …).
 *
 * Default range: entire history found in Mongo (Bork + Inbox + Eitje agg) — NOT one month.
 * Use --days N only when you want a short window.
 *
 * Usage:
 *   pnpm snapshots:backfill:daily-ops              # full history, 3 Daily Ops venues
 *   pnpm snapshots:backfill:daily-ops -- --all-locations   # full history, every venue with data
 *   pnpm snapshots:backfill:daily-ops -- --start 2024-01-01 --end 2026-05-24
 *   pnpm snapshots:backfill:daily-ops -- --days 30         # optional shortcut only
 *   pnpm snapshots:backfill:daily-ops -- --dry-run
 *   pnpm snapshots:backfill:daily-ops -- --force   # rebuild even if labor already v3
 *
 * Skips venue-days where labor section already has laborBuildVersion=3 and hourly Eitje buckets.
 *
 * All locations (same labor fix, every venue):
 *   pnpm snapshots:backfill
 *
 * Requires: MONGODB_URI (or DATABASE_URL) in .env / .env.local
 */

import { getDb } from '../server/utils/db'
import { buildDailyOpsSnapshot } from '../server/services/dailyOpsSnapshotService'
import { VENUE_STRIP_LOCATIONS } from '../server/utils/dailyOpsVenueStrip'
import {
  addCalendarDaysYmd,
  amsterdamOpenRegisterBusinessDateYmd,
} from '../utils/dailyOpsBusinessDate'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotLaborSection,
} from '../types/daily-ops-snapshot'

const DAILY_OPS_LOCATION_IDS = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
const LABOR_BUILD_VERSION_COMPLETE = 3

/** Already rebuilt with operational/gewerkt + hourly Eitje at write time. */
function laborSectionIsComplete(doc: DailyOpsSnapshotLaborSection | null): boolean {
  if (!doc) return false
  return (
    doc.laborBuildVersion === LABOR_BUILD_VERSION_COMPLETE &&
    Array.isArray(doc.hourly)
  )
}

async function loadLaborCompletionMap(
  db: Awaited<ReturnType<typeof getDb>>,
  dates: string[],
  locationIds: string[],
): Promise<Map<string, DailyOpsSnapshotLaborSection>> {
  const coll = db.collection<DailyOpsSnapshotLaborSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection)
  const docs = await coll
    .find(
      { businessDate: { $in: dates }, locationId: { $in: locationIds } },
      { projection: { businessDate: 1, locationId: 1, laborBuildVersion: 1, hourly: 1, 'operational.gewerkt.hours': 1, 'totals.hours': 1 } },
    )
    .toArray()
  const map = new Map<string, DailyOpsSnapshotLaborSection>()
  for (const d of docs) {
    map.set(`${d.businessDate}|${d.locationId}`, d)
  }
  return map
}

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function minYmd(a: string, b: string): string {
  return a <= b ? a : b
}

function maxYmd(a: string, b: string): string {
  return a >= b ? a : b
}

function listDatesInclusive(start: string, end: string): string[] {
  const out: string[] = []
  let cursor = start
  while (cursor <= end) {
    out.push(cursor)
    cursor = addCalendarDaysYmd(cursor, 1)
  }
  return out
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
  if (typeof min !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(min)) return null
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

  const eitjeMm = await minMaxOnCollection(db, 'eitje_time_registration_aggregation', 'period')
  if (eitjeMm) candidates.push({ label: 'eitje_time_registration_aggregation', ...eitjeMm })

  if (candidates.length === 0) {
    throw new Error(
      'No business dates in bork_business_days*, inbox-bork-basis-report, or eitje_time_registration_aggregation.',
    )
  }

  let startDate = candidates[0]!.min
  let endDate = candidates[0]!.max
  for (const c of candidates) {
    startDate = minYmd(startDate, c.min)
    endDate = maxYmd(endDate, c.max)
  }

  endDate = minYmd(endDate, amsterdamOpenRegisterBusinessDateYmd())

  return {
    startDate,
    endDate,
    sources: candidates.map((c) => `  - ${c.label}: ${c.min} → ${c.max}`),
  }
}

async function run() {
  const dryRun = hasFlag('dry-run')
  const force = hasFlag('force')
  const allLocations = hasFlag('all-locations')
  const db = await getDb()

  const discovered = await discoverBusinessDateRange(db)
  const today = amsterdamOpenRegisterBusinessDateYmd()
  const daysArg = arg('days')

  let startDate = arg('start')
  let endDate = arg('end')

  if (!startDate && !endDate && daysArg) {
    const daysBack = Math.max(1, Math.floor(Number(daysArg)))
    endDate = today
    startDate = addCalendarDaysYmd(today, -daysBack)
  } else {
    startDate = startDate ?? discovered.startDate
    endDate = endDate ?? discovered.endDate
  }

  if (startDate > endDate) {
    throw new Error(`Invalid range: ${startDate} > ${endDate}`)
  }

  const dates = listDatesInclusive(startDate, endDate).reverse()
  const locations = allLocations ? undefined : DAILY_OPS_LOCATION_IDS

  const venueLabel = allLocations
    ? 'all locations (Bork/Eitje per day)'
    : VENUE_STRIP_LOCATIONS.map((v) => v.locationName).join(', ')

  console.log(
    [
      `[daily-ops:snapshot:backfill] ${dryRun ? 'DRY RUN — ' : ''}range=${startDate}..${endDate} (${dates.length} days, newest first)`,
      `venues=${venueLabel}`,
      'Date sources:',
      ...discovered.sources,
      '',
    ].join('\n'),
  )

  const locIdsForScan = allLocations
    ? await db.collection('eitje_time_registration_aggregation').distinct('locationId', {
        period: { $in: dates },
      }).then((ids) => ids.map(String))
    : locations!

  const laborMap =
    force || allLocations
      ? new Map<string, DailyOpsSnapshotLaborSection>()
      : await loadLaborCompletionMap(db, dates, locIdsForScan)

  let wouldSkip = 0
  if (!allLocations && !force) {
    for (const businessDate of dates) {
      for (const locationId of locations!) {
        if (laborSectionIsComplete(laborMap.get(`${businessDate}|${locationId}`) ?? null)) wouldSkip += 1
      }
    }
  }

  if (dryRun) {
    const total = dates.length * (allLocations ? locIdsForScan.length : locations!.length)
    console.log(
      `Would process ${total} venue-days | skip=${wouldSkip} rebuild=${total - wouldSkip}${force ? ' (--force)' : ''}`,
    )
    console.log(`First dates (newest): ${dates.slice(0, 5).join(', ')}`)
    process.exit(0)
  }

  let built = 0
  let skipped = 0
  let errors = 0
  let done = 0
  const total = dates.length * (allLocations ? 1 : locations!.length)
  const t0 = Date.now()

  if (!force && !allLocations) {
    console.log(`[daily-ops:snapshot:backfill] skip=${wouldSkip} already labor v3 hourly | rebuild rest`)
  }

  for (let i = 0; i < dates.length; i++) {
    const businessDate = dates[i]!

    if (allLocations) {
      const r = await buildDailyOpsSnapshot({ businessDate })
      built += r.built.length
      errors += r.errors.length
      for (const e of r.errors) {
        console.error(`[daily-ops:snapshot:backfill] FAIL ${businessDate} ${e.locationId}: ${e.error}`)
      }
      done += 1
      if ((i + 1) % 5 === 0 || i === dates.length - 1) {
        const pct = Math.round(((i + 1) / dates.length) * 100)
        console.log(`[daily-ops:snapshot:backfill] ${pct}% | ${businessDate} | built=${built} errors=${errors}`)
      }
      continue
    }

    for (const locationId of locations!) {
      const label = `${businessDate} ${locationId}`
      const key = `${businessDate}|${locationId}`

      if (!force && laborSectionIsComplete(laborMap.get(key) ?? null)) {
        skipped += 1
        done += 1
        continue
      }

      try {
        const r = await buildDailyOpsSnapshot({ businessDate, locationId })
        if (r.errors.length > 0) {
          errors += r.errors.length
          console.error(`[daily-ops:snapshot:backfill] FAIL ${label}: ${r.errors[0]!.error}`)
          continue
        }
        built += r.built.length

        const labor = await db
          .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection)
          .findOne(
            { businessDate, locationId },
            { projection: { 'totals.hours': 1, 'operational.gewerkt.hours': 1 } },
          )
        const allH = Number(labor?.totals?.hours ?? 0)
        const gewH = Number(labor?.operational?.gewerkt?.hours ?? 0)
        console.log(
          `[daily-ops:snapshot:backfill] ok ${label} | all=${allH.toFixed(1)}h gewerkt=${gewH.toFixed(1)}h`,
        )
      } catch (e) {
        errors += 1
        console.error(`[daily-ops:snapshot:backfill] FAIL ${label}:`, e instanceof Error ? e.message : e)
      }
      done += 1
    }

    if ((i + 1) % 7 === 0 || i === dates.length - 1) {
      const pct = Math.round(((i + 1) / dates.length) * 100)
      console.log(
        `[daily-ops:snapshot:backfill] ${pct}% days | built=${built} skipped=${skipped} errors=${errors} (${done}/${total})`,
      )
    }
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(
    `[daily-ops:snapshot:backfill] done in ${sec}s | built=${built} skipped=${skipped} errors=${errors}`,
  )
  process.exit(errors > 0 ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
