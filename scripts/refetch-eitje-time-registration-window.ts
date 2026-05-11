/**
 * Refetch Eitje `time_registration_shifts` into `eitje_raw_data` for an inclusive date range,
 * then rebuild `eitje_time_registration_aggregation` (same path as POST sync / full backfill).
 *
 * Default window: 2026-05-06 .. 2026-05-08 (one day before / after 2026-05-07).
 *
 * Usage:
 *   EITJE_REFETCH_CONFIRM=1 npx tsx scripts/refetch-eitje-time-registration-window.ts
 *   EITJE_REFETCH_CONFIRM=1 npx tsx scripts/refetch-eitje-time-registration-window.ts .env.digitalocean.local
 *   EITJE_REFETCH_CONFIRM=1 npx tsx scripts/refetch-eitje-time-registration-window.ts .env.local 2026-05-06 2026-05-08
 *
 * Env:
 *   MONGODB_URI or DATABASE_URL, MONGODB_DB_NAME
 *   EITJE_REFETCH_CONFIRM=1 — required
 *   EITJE_REFETCH_SKIP_MASTER=1 — skip environments/teams/users (default: skip)
 *   EITJE_BACKFILL_CHUNK_DELAY_MS — optional pause between API chunks (full backfill uses this via sync internals only for multi-chunk; 3-day range is one chunk if max days ≥ 3)
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { executeEitjeJob, syncEitjeByRequest } from '../server/services/eitjeSyncService.ts'

function applyEnvFile (p: string, override: boolean) {
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const val = m[2].trim().replace(/^["']|["']$/g, '')
    if (override || process.env[key] === undefined) process.env[key] = val
  }
}

/** Base files first; optional `overridePath` last so e.g. `.env.digitalocean.local` wins for URI but `.env.local` still fills gaps. */
function loadDotEnvFiles (overridePath?: string | null) {
  for (const file of ['.env.local', '.env', '.env.digitalocean.local']) {
    applyEnvFile(resolve(process.cwd(), file), false)
  }
  if (overridePath) {
    const abs = resolve(process.cwd(), overridePath)
    applyEnvFile(abs, true)
  }
}

function parseArgs (): { envFile: string | null; start: string; end: string } {
  const rest = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  let envFile: string | null = null
  let start = '2026-05-06'
  let end = '2026-05-08'
  if (rest.length >= 1 && rest[0]!.includes('.env')) {
    envFile = rest[0]!
    rest.shift()
  }
  if (rest.length >= 2) {
    start = rest[0]!
    end = rest[1]!
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    console.error('Invalid YYYY-MM-DD. Usage: [path/to.env] [start] [end]')
    process.exit(1)
  }
  if (start > end) {
    console.error('start must be <= end')
    process.exit(1)
  }
  return { envFile, start, end }
}

async function main (): Promise<void> {
  const { envFile, start, end } = parseArgs()
  loadDotEnvFiles(envFile)

  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops-db'
  const confirmed =
    process.env.EITJE_REFETCH_CONFIRM === '1' || process.env.EITJE_REFETCH_CONFIRM === 'yes'

  if (!uri) {
    console.error('[eitje-refetch] Missing MONGODB_URI or DATABASE_URL')
    process.exit(1)
  }
  if (!confirmed) {
    console.error('[eitje-refetch] Set EITJE_REFETCH_CONFIRM=1 to run.')
    process.exit(1)
  }

  const skipMaster = process.env.EITJE_REFETCH_SKIP_MASTER !== '0'

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  try {
    console.log(`[eitje-refetch] ${start} .. ${end} inclusive | db=${dbName}`)

    if (!skipMaster) {
      console.log('[eitje-refetch] master-data sync…')
      const master = await executeEitjeJob(db, 'master-data')
      console.log('[eitje-refetch] master-data:', master.ok, master.message)
    } else {
      console.log('[eitje-refetch] skipping master-data (EITJE_REFETCH_SKIP_MASTER default on; set =0 to run)')
    }

    console.log('[eitje-refetch] time_registration_shifts fetch + aggregation rebuild…')
    const sync = await syncEitjeByRequest(db, {
      endpoint: 'time_registration_shifts',
      startDate: start,
      endDate: end,
    })
    console.log('[eitje-refetch] result:', JSON.stringify(sync, null, 2))
    console.log('[eitje-refetch] done.')
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error('[eitje-refetch] fatal:', e)
  process.exit(1)
})
