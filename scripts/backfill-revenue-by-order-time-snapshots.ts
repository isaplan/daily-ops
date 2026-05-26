/**
 * Backfill Daily Ops revenue-by-order-time snapshot section.
 *
 * Default: latest 30 business days, newest first.
 *
 * Usage:
 *   pnpm snapshots:backfill:order-time
 *   pnpm snapshots:backfill:order-time -- --dry-run
 *   pnpm snapshots:backfill:order-time -- --days 30
 *   pnpm snapshots:backfill:order-time -- --start 2026-04-26 --end 2026-05-25
 *   pnpm snapshots:backfill:order-time -- --location 6916766daf9930f74a6960bc
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../server/utils/db'
import { resolveBorkAggReadSuffix } from '../server/utils/borkAggVersionSuffix'
import { buildRevenueByOrderTimeSection } from '../server/utils/dailyOpsSnapshot/buildRevenueByOrderTimeSection'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '../types/daily-ops-snapshot'
import {
  addCalendarDaysYmd,
  amsterdamOpenRegisterBusinessDateYmd,
} from '../utils/dailyOpsBusinessDate'

declare const process: {
  argv: string[]
  stdout: { write: (message: string) => void }
  stderr: { write: (message: string) => void }
  exit: (code?: number) => never
}

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
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

function rebuildCommand(startDate: string, endDate: string): string {
  return `BORK_V2_REBUILD_CONFIRM=1 BORK_V2_START=${startDate} BORK_V2_END=${endDate} pnpm bork:rebuild:v2`
}

async function resolveLocationName(
  db: Awaited<ReturnType<typeof getDb>>,
  businessDate: string,
  locationId: string,
): Promise<string> {
  const existing = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master).findOne(
    { businessDate, locationId },
    { projection: { locationName: 1 } },
  )
  if (typeof existing?.locationName === 'string' && existing.locationName.length > 0) return existing.locationName

  if (!ObjectId.isValid(locationId)) return ''
  const oid = new ObjectId(locationId)
  const mapping = await db.collection('bork_unified_location_mapping').findOne(
    { unifiedLocationId: oid },
    { projection: { unifiedLocationName: 1 } },
  )
  if (typeof mapping?.unifiedLocationName === 'string') return mapping.unifiedLocationName

  const fallback = await db.collection('locations').findOne({ _id: oid }, { projection: { name: 1 } })
  return typeof fallback?.name === 'string' ? fallback.name : ''
}

async function locationIdsForDate(
  db: Awaited<ReturnType<typeof getDb>>,
  businessDate: string,
  explicitLocationId?: string,
): Promise<string[]> {
  if (explicitLocationId) return [explicitLocationId]

  const suffix = resolveBorkAggReadSuffix()
  const ids = await db
    .collection(`bork_sales_by_order_hour${suffix}`)
    .distinct('locationId', { business_date: businessDate })

  return ids.map((id) => String(id)).sort()
}

async function main() {
  const db = await getDb()
  const dryRun = hasFlag('dry-run')
  const explicitLocationId = arg('location')
  const days = Math.max(1, Number(arg('days') ?? 30))
  const endDate = arg('end') ?? amsterdamOpenRegisterBusinessDateYmd()
  const startDate = arg('start') ?? addCalendarDaysYmd(endDate, -(days - 1))
  const dates = listDatesInclusive(startDate, endDate).reverse()

  process.stdout.write(
    [
      '[snapshot:backfill-order-time]',
      `range=${startDate}..${endDate} (${dates.length} days)`,
      `order=newest-first`,
      `location=${explicitLocationId ?? 'all with order-time Bork hours'}`,
      `target=${DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueByOrderTimeSection}`,
      '',
    ].join('\n'),
  )

  const suffix = resolveBorkAggReadSuffix()
  const sourceRows = await db.collection(`bork_sales_by_order_hour${suffix}`).countDocuments({
    business_date: { $gte: startDate, $lte: endDate },
  })

  if (dryRun) {
    process.stdout.write(`source=bork_sales_by_order_hour${suffix} rows=${sourceRows}\n`)
    for (const businessDate of dates.slice(0, 5)) {
      const locationIds = await locationIdsForDate(db, businessDate, explicitLocationId)
      process.stdout.write(`Dry run ${businessDate}: ${locationIds.length} location(s)\n`)
    }
    process.exit(0)
  }

  if (sourceRows === 0) {
    process.stderr.write(
      [
        '',
        `No source rows found in bork_sales_by_order_hour${suffix} for ${startDate}..${endDate}.`,
        'Run the Bork V2 rebuild first to generate order-time hourly aggregates:',
        `  ${rebuildCommand(startDate, endDate)}`,
        'Then rerun:',
        '  pnpm snapshots:backfill:order-time',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }

  let built = 0
  let errors = 0
  let dayIndex = 0
  const started = Date.now()

  for (const businessDate of dates) {
    dayIndex++
    const locationIds = await locationIdsForDate(db, businessDate, explicitLocationId)
    for (const locationId of locationIds) {
      try {
        const locationName = await resolveLocationName(db, businessDate, locationId)
        const section = await buildRevenueByOrderTimeSection(db, { businessDate, locationId, locationName })
        await db
          .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueByOrderTimeSection)
          .updateOne({ businessDate, locationId }, { $set: section }, { upsert: true })
        await db
          .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master)
          .updateOne({ businessDate, locationId }, { $set: { 'sections.revenueByOrderTime': true } })
        built++
      } catch (e) {
        errors++
        const msg = e instanceof Error ? e.message : String(e)
        process.stderr.write(`\nERROR ${businessDate} ${locationId}: ${msg}\n`)
      }
    }
    const pct = Math.round((dayIndex / dates.length) * 100)
    process.stdout.write(
      `\r[snapshot:backfill-order-time] ${businessDate} (${dayIndex}/${dates.length} ${pct}%) built=${built} errors=${errors}`,
    )
  }

  const sec = ((Date.now() - started) / 1000).toFixed(1)
  process.stdout.write(`\nDone in ${sec}s | sections built=${built} errors=${errors}\n`)
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
