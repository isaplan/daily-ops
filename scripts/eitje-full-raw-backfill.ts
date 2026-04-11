/**
 * Eitje raw backfill: fetch time_registration_shifts into eitje_raw_data for a fixed date range
 * (default 2024-01-01 .. today UTC), then rebuild eitje_time_registration_aggregation and map
 * unified_user / unified_team — same flow as POST /api/eitje/v2/sync with a wide range.
 *
 * API windows are chunked by EITJE_TIME_REGISTRATION_MAX_DAYS (default 7), matching Eitje limits.
 *
 * Run in background (example):
 *
 *   EITJE_BACKFILL_CONFIRM=1 EITJE_BACKFILL_CHUNK_DELAY_MS=200 \
 *     nohup npx --yes tsx scripts/eitje-full-raw-backfill.ts >> /tmp/eitje-backfill.log 2>&1 &
 *
 * Env:
 *   MONGODB_URI, MONGODB_DB_NAME — same as app (.env / .env.local)
 *   EITJE_BACKFILL_CONFIRM=1     — required to run
 *   EITJE_BACKFILL_START=2024-01-01 — optional ISO date
 *   EITJE_BACKFILL_END           — optional ISO date (default today UTC)
 *   EITJE_BACKFILL_SKIP_MASTER=1 — skip master-data sync (environments, teams, users)
 *   EITJE_BACKFILL_CLEAR_TR_RAW=1 — delete eitje_raw_data time_registration_shifts in range before fetch
 *   EITJE_TIME_REGISTRATION_MAX_DAYS — override chunk size (default 7)
 *   EITJE_BACKFILL_CHUNK_DELAY_MS — pause between API windows (default 0; set e.g. 150–300 for rate limits)
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { executeEitjeJob, syncEitjeByRequest } from '../server/services/eitjeSyncService.ts'

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

function dayStartUtc (dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEndUtc (dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

async function main (): Promise<void> {
  loadDotEnv()

  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  const confirmed =
    process.env.EITJE_BACKFILL_CONFIRM === '1' || process.env.EITJE_BACKFILL_CONFIRM === 'yes'

  if (!uri) {
    console.error('[eitje-backfill] Missing MONGODB_URI')
    process.exit(1)
  }
  if (!confirmed) {
    console.error('[eitje-backfill] Set EITJE_BACKFILL_CONFIRM=1 to run.')
    process.exit(1)
  }

  const startIso = process.env.EITJE_BACKFILL_START || '2024-01-01'
  const endIso = process.env.EITJE_BACKFILL_END || new Date().toISOString().split('T')[0]
  const maxDaysEnv = process.env.EITJE_TIME_REGISTRATION_MAX_DAYS
  const skipMaster = process.env.EITJE_BACKFILL_SKIP_MASTER === '1'
  const clearRaw = process.env.EITJE_BACKFILL_CLEAR_TR_RAW === '1'

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  try {
    console.log(
      `[eitje-backfill] Range ${startIso} .. ${endIso} UTC; db=${dbName}; EITJE_TIME_REGISTRATION_MAX_DAYS=${maxDaysEnv ?? '7 (default)'}; clearTrRaw=${clearRaw}`
    )

    if (!skipMaster) {
      console.log('[eitje-backfill] master-data sync (environments, teams, users)…')
      const master = await executeEitjeJob(db, 'master-data')
      console.log('[eitje-backfill] master-data:', master.ok, master.message)
    }

    if (clearRaw) {
      const startD = dayStartUtc(startIso)
      const endD = dayEndUtc(endIso)
      const del = await db.collection('eitje_raw_data').deleteMany({
        endpoint: 'time_registration_shifts',
        date: { $gte: startD, $lte: endD },
      })
      console.log(`[eitje-backfill] cleared time_registration_shifts raw in range: ${del.deletedCount} doc(s)`)
    }

    console.log('[eitje-backfill] time_registration_shifts + aggregation…')
    const sync = await syncEitjeByRequest(db, {
      endpoint: 'time_registration_shifts',
      startDate: startIso,
      endDate: endIso,
    })
    console.log('[eitje-backfill] sync result:', JSON.stringify(sync, null, 2))
    console.log('[eitje-backfill] done.')
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error('[eitje-backfill] fatal:', e)
  process.exit(1)
})
