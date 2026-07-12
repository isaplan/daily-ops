/**
 * @deprecated Use scripts/backfill-snapshot-gaps.ts (pnpm snapshots:backfill:gaps) for dashboard gaps.
 * Staff CSV validation pipeline — only when compare-staff-dagelijkse-uren-csv-vs-snapshot report exists.
 *
 * Backfill staff labor gaps found by compare-staff-dagelijkse-uren-csv-vs-snapshot.ts.
 *
 * Pipeline per gap window:
 *   1. Eitje time_registration_shifts refetch → eitje_raw_data
 *   2. eitje_time_registration_aggregation rebuild (via syncEitjeByRequest)
 *   3. daily_ops_snapshot labor sections (buildDailyOpsSnapshot)
 *
 * Usage:
 *   npx tsx scripts/compare-staff-dagelijkse-uren-csv-vs-snapshot.ts --all
 *   npx tsx scripts/backfill-staff-snapshot-gaps.ts --dry-run
 *   STAFF_BACKFILL_CONFIRM=1 npx tsx scripts/backfill-staff-snapshot-gaps.ts
 *   STAFF_BACKFILL_CONFIRM=1 npx tsx scripts/backfill-staff-snapshot-gaps.ts --start 2025-12-25 --end 2026-01-01
 *
 * Env: MONGODB_URI / DATABASE_URL, MONGODB_DB_NAME
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { syncEitjeByRequest } from '../server/services/eitjeSyncService.ts'
import { buildDailyOpsSnapshot } from '../server/services/dailyOpsSnapshotService.ts'
import { amsterdamOpenRegisterBusinessDateYmd } from '../utils/dailyOpsBusinessDate.ts'

const GAP_REPORT = resolve(
  'dev-docs/validation-data-eitje-bork/eitje/staff-data/snapshot-gaps-report.json',
)

type GapRow = {
  date: string
  venue: string
  locationId: string | null
  issue: 'missing_snapshot' | 'hours_mismatch' | 'zero_snapshot'
}

type GapReport = {
  gaps: GapRow[]
  uniqueMissingDates?: string[]
}

function loadDotEnv() {
  for (const file of ['.env.local', '.env', '.env.digitalocean.local']) {
    const p = resolve(file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function loadTargetGaps(): { dates: string[]; venueDays: Array<{ date: string; locationId: string }> } {
  const today = amsterdamOpenRegisterBusinessDateYmd()
  const manualStart = arg('start')
  const manualEnd = arg('end')

  const onlyZero = hasFlag('zero-only')
  const locationFilter = arg('location')

  if (manualStart && manualEnd) {
    const dates: string[] = []
    let cur = manualStart
    while (cur <= manualEnd) {
      if (cur <= today) dates.push(cur)
      const d = new Date(`${cur}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() + 1)
      cur = d.toISOString().slice(0, 10)
    }
    return { dates, venueDays: [] }
  }

  if (!existsSync(GAP_REPORT)) {
    throw new Error(
      `Gap report not found: ${GAP_REPORT}\nRun: npx tsx scripts/compare-staff-dagelijkse-uren-csv-vs-snapshot.ts --all`,
    )
  }

  const report = JSON.parse(readFileSync(GAP_REPORT, 'utf8')) as GapReport
  let actionable = report.gaps.filter(
    (g) =>
      g.date <= today &&
      (g.issue === 'missing_snapshot' || g.issue === 'zero_snapshot') &&
      g.locationId,
  )
  if (onlyZero) actionable = actionable.filter((g) => g.issue === 'zero_snapshot')
  if (locationFilter) actionable = actionable.filter((g) => g.locationId === locationFilter)

  const dates = [...new Set(actionable.map((g) => g.date))].sort()
  const venueDays = actionable.map((g) => ({
    date: g.date,
    locationId: g.locationId!,
  }))

  return { dates, venueDays }
}

/** Merge sorted YYYY-MM-DD list into contiguous [start,end] windows. */
function mergeDateWindows(sortedDates: string[]): Array<{ start: string; end: string }> {
  if (!sortedDates.length) return []
  const windows: Array<{ start: string; end: string }> = []
  let start = sortedDates[0]!
  let end = start
  for (let i = 1; i < sortedDates.length; i++) {
    const d = sortedDates[i]!
    const prev = new Date(`${end}T12:00:00Z`)
    prev.setUTCDate(prev.getUTCDate() + 1)
    const nextDay = prev.toISOString().slice(0, 10)
    if (d === nextDay) {
      end = d
    } else {
      windows.push({ start, end })
      start = d
      end = d
    }
  }
  windows.push({ start, end })
  return windows
}

async function main(): Promise<void> {
  loadDotEnv()
  const dryRun = hasFlag('dry-run')
  const confirmed =
    process.env.STAFF_BACKFILL_CONFIRM === '1' || process.env.STAFF_BACKFILL_CONFIRM === 'yes'

  if (!dryRun && !confirmed) {
    console.error('[staff-backfill] Set STAFF_BACKFILL_CONFIRM=1 or use --dry-run')
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops-db'
  if (!uri) {
    console.error('[staff-backfill] Missing MONGODB_URI or DATABASE_URL')
    process.exit(1)
  }

  const { dates, venueDays } = loadTargetGaps()
  if (!dates.length) {
    console.log('[staff-backfill] No actionable missing/zero snapshot dates (past only).')
    process.exit(0)
  }

  const start = dates[0]!
  const end = dates[dates.length - 1]!
  console.log(
    `[staff-backfill] ${dryRun ? 'DRY RUN — ' : ''}${dates.length} dates (${start}..${end}), ${venueDays.length} venue-days`,
  )
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const targets =
    venueDays.length > 0
      ? venueDays
      : dates.map((date) => ({ date, locationId: undefined as string | undefined }))

  const needsEitje: typeof targets = []
  const snapshotOnly: typeof targets = []

  for (const t of targets) {
    if (!t.locationId) {
      needsEitje.push(t)
      continue
    }
    const aggRows = await db.collection('eitje_time_registration_aggregation').countDocuments({
      period: t.date,
      locationId: t.locationId,
    })
    if (aggRows === 0) needsEitje.push(t)
    else snapshotOnly.push(t)
  }

  const refetchDates = [...new Set(needsEitje.map((t) => t.date))].sort()
  const refetchWindows = mergeDateWindows(refetchDates)

  console.log(
    `[staff-backfill] eitje-refetch=${needsEitje.length} venue-days (${refetchWindows.length} windows) | snapshot-only=${snapshotOnly.length}`,
  )
  for (const w of refetchWindows) {
    console.log(`  eitje window: ${w.start}..${w.end}`)
  }

  if (dryRun) {
    await client.close()
    console.log('\nWould: refetch Eitje for windows above, rebuild snapshots for all gap venue-days.')
    process.exit(0)
  }

  try {
    for (const w of refetchWindows) {
      console.log(`[staff-backfill] Eitje refetch ${w.start}..${w.end}…`)
      const sync = await syncEitjeByRequest(db, {
        endpoint: 'time_registration_shifts',
        startDate: w.start,
        endDate: w.end,
      })
      console.log('[staff-backfill] sync:', sync.ok ? 'ok' : 'fail', sync.message ?? '')
      if (!sync.ok) {
        console.error('[staff-backfill] Eitje sync failed — continuing with snapshot rebuilds')
      }
    }

    let built = 0
    let errors = 0

    for (const t of [...needsEitje, ...snapshotOnly]) {
      try {
        const r = await buildDailyOpsSnapshot({
          businessDate: t.date,
          locationId: t.locationId,
          forceReopenSealed: true,
        })
        if (r.errors.length) {
          errors += r.errors.length
          console.error(`[staff-backfill] FAIL ${t.date} ${t.locationId ?? 'all'}: ${r.errors[0]!.error}`)
        } else {
          built += r.built.length
          console.log(`[staff-backfill] ok ${t.date} ${t.locationId ?? 'all venues'}`)
        }
      } catch (e) {
        errors += 1
        console.error(
          `[staff-backfill] FAIL ${t.date}:`,
          e instanceof Error ? e.message : e,
        )
      }
    }

    console.log(`[staff-backfill] done | snapshots built=${built} errors=${errors}`)
    console.log('[staff-backfill] Re-run compare script to verify gaps closed.')
  } finally {
    await client.close()
  }

  process.exit(0)
}

main().catch((e) => {
  console.error('[staff-backfill] fatal:', e)
  process.exit(1)
})
