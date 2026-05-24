/**
 * Rebuild `eitje_time_registration_aggregation` for [startDate, endDate] after pipeline fixes
 * (Amsterdam business day + normalized worker/team/location keys).
 *
 * Usage:
 *   npx tsx scripts/rebuild-eitje-labor-aggregation.ts 2026-05-01 2026-05-10
 *   npx tsx scripts/rebuild-eitje-labor-aggregation.ts all
 *   npx tsx scripts/rebuild-eitje-labor-aggregation.ts all --snapshots
 *
 * `all` — scans `eitje_raw_data` (time_registration_shifts) for min/max `date`, then rebuilds
 * in chunks (default 31 days) so large histories complete without OOM.
 *
 * `--snapshots` — after each agg chunk, rebuild daily_ops snapshots (required outside Nuxt;
 *   in-app enqueueSnapshotBuild is a no-op in tsx).
 *
 * Env:
 *   MONGODB_URI, MONGODB_DB_NAME
 *   EITJE_REBUILD_CHUNK_DAYS — days per chunk (default 31)
 */
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { MongoClient, type Db } from 'mongodb'
import { rebuildEitjeTimeRegistrationAggregation } from '../server/services/eitjeRebuildAggregationService.ts'
import { buildDailyOpsSnapshotRange } from '../server/services/dailyOpsSnapshotService.ts'

function loadDotEnv () {
  for (const file of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m && process.env[m[1].trim()] === undefined) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}

function utcYmd (d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseUtcYmd (ymd: string): Date {
  const [y, mo, da] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (mo ?? 1) - 1, da ?? 1))
}

function addUtcDays (d: Date, delta: number): Date {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + delta)
  return x
}

async function rawShiftDateBounds (db: Db): Promise<{ start: string; end: string } | null> {
  const [row] = (await db
    .collection('eitje_raw_data')
    .aggregate([
      {
        $match: {
          endpoint: 'time_registration_shifts',
          date: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          minD: { $min: '$date' },
          maxD: { $max: '$date' },
        },
      },
    ])
    .toArray()) as { minD?: Date; maxD?: Date }[]

  if (!row?.minD || !row?.maxD) return null
  return {
    start: utcYmd(row.minD),
    end: utcYmd(row.maxD),
  }
}

function hasFlag (name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function rebuildRangeChunked (
  db: Db,
  startYmd: string,
  endYmd: string,
  chunkDays: number,
  withSnapshots: boolean
): Promise<{ deletedPeriods: number; inserted: number; chunks: number; snapshotsBuilt: number; snapshotErrors: number }> {
  let start = parseUtcYmd(startYmd)
  const end = parseUtcYmd(endYmd)
  let deletedPeriods = 0
  let inserted = 0
  let chunks = 0
  let snapshotsBuilt = 0
  let snapshotErrors = 0

  while (start.getTime() <= end.getTime()) {
    const chunkEnd = addUtcDays(start, chunkDays - 1)
    const chunkEndClamped = chunkEnd.getTime() > end.getTime() ? end : chunkEnd
    const s = utcYmd(start)
    const e = utcYmd(chunkEndClamped)
    chunks++
    console.log(`  Chunk ${chunks}: ${s} .. ${e}`)
    const r = await rebuildEitjeTimeRegistrationAggregation(db, s, e)
    deletedPeriods += r.deletedPeriods
    inserted += r.inserted
    console.log(`    agg: deleted ${r.deletedPeriods}, inserted ${r.inserted}, deduped ${r.aggDeduped}`)
    if (withSnapshots) {
      console.log(`    snapshots: rebuilding ${s} .. ${e} ...`)
      const snap = await buildDailyOpsSnapshotRange({ startDate: s, endDate: e })
      snapshotsBuilt += snap.built
      snapshotErrors += snap.errors
      console.log(`    snapshots: built=${snap.built} errors=${snap.errors}`)
    }
    start = addUtcDays(chunkEndClamped, 1)
  }

  return { deletedPeriods, inserted, chunks, snapshotsBuilt, snapshotErrors }
}

async function main () {
  loadDotEnv()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI or MONGODB_DB_NAME')
    process.exit(1)
  }

  const rawChunk = process.env.EITJE_REBUILD_CHUNK_DAYS
  const chunkDays = Math.max(1, parseInt(rawChunk ?? '31', 10) || 31)
  const withSnapshots = hasFlag('snapshots') || process.env.EITJE_REBUILD_SNAPSHOTS === '1'

  const dateArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  let start = dateArgs[0] ?? process.env.EITJE_REBUILD_START
  let end = dateArgs[1] ?? process.env.EITJE_REBUILD_END

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const db = client.db(dbName)

    if (start === 'all' || start === '--all') {
      console.log('Discovering date bounds from eitje_raw_data (time_registration_shifts)...')
      const bounds = await rawShiftDateBounds(db)
      if (!bounds) {
        console.error('No time_registration_shifts rows with date found.')
        process.exit(1)
      }
      start = bounds.start
      end = bounds.end
      console.log(`Full raw range: ${start} .. ${end} (UTC calendar days from min/max shift timestamps)`)
      console.log(`Rebuilding in chunks of ${chunkDays} days (snapshots=${withSnapshots})...`)
      const sum = await rebuildRangeChunked(db, start, end, chunkDays, withSnapshots)
      console.log('Done (all chunks):', sum)
      return
    }

    if (!start || !end) {
      console.error('Usage: npx tsx scripts/rebuild-eitje-labor-aggregation.ts <startDate> <endDate> [--snapshots]')
      console.error('   or: npx tsx scripts/rebuild-eitje-labor-aggregation.ts all [--snapshots]')
      process.exit(1)
    }

    const useChunk =
      process.env.EITJE_REBUILD_CHUNKED === '1' ||
      (parseUtcYmd(end).getTime() - parseUtcYmd(start).getTime()) / 86400000 > chunkDays

    if (useChunk) {
      console.log(`Rebuilding ${start} .. ${end} in chunks of ${chunkDays} days (snapshots=${withSnapshots})...`)
      const sum = await rebuildRangeChunked(db, start, end, chunkDays, withSnapshots)
      console.log('Done:', sum)
    } else {
      console.log(`Rebuilding Eitje labor aggregation ${start} .. ${end} (snapshots=${withSnapshots})...`)
      const r = await rebuildEitjeTimeRegistrationAggregation(db, start, end)
      console.log('Done agg:', r)
      if (withSnapshots) {
        const snap = await buildDailyOpsSnapshotRange({ startDate: start, endDate: end })
        console.log('Done snapshots:', snap)
      }
    }
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
