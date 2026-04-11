/**
 * One-time Bork backfill: wipe Bork raw + derived sales collections, re-fetch from API
 * from 2024-01-01 through today for every api_credentials row (provider bork), with
 * batched throttling, then rebuild bork_sales_* from bork_raw_data.
 *
 * Does not touch the UI. Run manually (ideally in background):
 *
 *   BORK_BACKFILL_CONFIRM=1 nohup node --experimental-strip-types scripts/bork-full-raw-backfill.ts >> /tmp/bork-backfill.log 2>&1 &
 *
 * Env:
 *   MONGODB_URI, MONGODB_DB_NAME — same as app (.env / .env.local)
 *   BORK_BACKFILL_CONFIRM=1       — required to delete + write
 *   BORK_BACKFILL_START=2024-01-01 — optional ISO date (default 2024-01-01)
 *   BORK_BACKFILL_END              — optional ISO date (default today UTC)
 *   BORK_DAY_DELAY_MS=120 — pause between day fetches (same location)
 *   BORK_BATCH_DAYS=31             — after this many days, extra BORK_BATCH_PAUSE_MS
 *   BORK_BATCH_PAUSE_MS=250        — pause between day batches
 *   BORK_LOCATION_PAUSE_MS=500 — pause when switching location (after ticket days)
 *   BORK_MASTER_DELAY_MS=200       — pause between master JSON calls
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, type Db, type Document } from 'mongodb'
import { rebuildBorkSalesAggregation } from '../server/services/borkRebuildAggregationService.ts'

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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Bork/Trivec JSON routes we store (see .cursor/plans/BORK_API_INTEGRATION_INTO_LAYERS.md). */
const BORK_MASTER_PATHS = [
  { endpoint: 'bork_master_productgrouplist', path: '/catalog/productgrouplist.json' },
  { endpoint: 'bork_master_paymodegrouplist', path: '/catalog/paymodegrouplist.json' },
  { endpoint: 'bork_master_centers', path: '/centers.json' },
  { endpoint: 'bork_master_users', path: '/users.json' },
] as const

function toYyyymmdd (d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function parseIsoDate (s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function eachCalendarDay (start: Date, end: Date): string[] {
  const out: string[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cur <= last) {
    out.push(toYyyymmdd(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

async function fetchBorkJson (
  baseUrl: string,
  apiKey: string,
  pathWithLeadingSlash: string,
  extraParams?: Record<string, string>
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const base = baseUrl.replace(/\/$/, '')
  const path = pathWithLeadingSlash.startsWith('/') ? pathWithLeadingSlash : `/${pathWithLeadingSlash}`
  const q = new URLSearchParams({ appid: apiKey, ...extraParams })
  const url = `${base}${path}?${q.toString()}`
  try {
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
    const text = await res.text()
    let data: unknown = text
    try {
      data = text ? (JSON.parse(text) as unknown) : null
    } catch {
      // keep as text
    }
    if (res.ok) return { ok: true, status: res.status, data }
    return { ok: false, status: res.status, data: null, error: `HTTP ${res.status}` }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, data: null, error }
  }
}

function extractRecords (data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) return v
    }
  }
  return []
}

async function loadBorkCredentials (db: Db): Promise<Document[]> {
  return db
    .collection('api_credentials')
    .find({
      provider: { $in: ['bork', 'Bork'] },
      $nor: [{ isActive: false }],
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray()
}

async function clearBorkDerivedCollections (db: Db): Promise<void> {
  const cols = [
    'bork_raw_data',
    'bork_sales_by_cron',
    'bork_sales_by_hour',
    'bork_sales_by_table',
    'bork_sales_by_worker',
    'bork_sales_by_guest_account',
    'bork_products_master',
  ]
  for (const name of cols) {
    const r = await db.collection(name).deleteMany({})
    console.log(`[bork-backfill] cleared ${name}: ${r.deletedCount} document(s)`)
  }
}

async function upsertTicketDay (
  db: Db,
  cred: Document,
  lid: string,
  dateStr: string,
  records: unknown[]
): Promise<void> {
  const syncDedupKey = `${lid}:bork_daily:${dateStr}`
  const upsertDate = new Date()
  await db.collection('bork_raw_data').updateOne(
    { syncDedupKey },
    {
      $set: {
        endpoint: 'bork_daily',
        locationId: cred.locationId,
        date: upsertDate,
        rawApiResponse: records,
        syncDedupKey,
        recordCount: records.length,
        updatedAt: upsertDate,
      },
      $setOnInsert: { createdAt: upsertDate },
    },
    { upsert: true }
  )
}

async function upsertMaster (
  db: Db,
  cred: Document,
  lid: string,
  endpoint: string,
  syncSuffix: string,
  payload: unknown
): Promise<void> {
  const syncDedupKey = `${lid}:${syncSuffix}`
  const upsertDate = new Date()
  const records = extractRecords(payload)
  const toStore = records.length > 0 ? records : payload
  await db.collection('bork_raw_data').updateOne(
    { syncDedupKey },
    {
      $set: {
        endpoint,
        locationId: cred.locationId,
        date: upsertDate,
        rawApiResponse: toStore,
        syncDedupKey,
        recordCount: Array.isArray(toStore) ? toStore.length : 1,
        updatedAt: upsertDate,
      },
      $setOnInsert: { createdAt: upsertDate },
    },
    { upsert: true }
  )
}

async function main (): Promise<void> {
  loadDotEnv()

  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  const confirmed =
    process.env.BORK_BACKFILL_CONFIRM === '1' || process.env.BORK_BACKFILL_CONFIRM === 'yes'

  if (!uri) {
    console.error('[bork-backfill] Missing MONGODB_URI')
    process.exit(1)
  }
  if (!confirmed) {
    console.error('[bork-backfill] Set BORK_BACKFILL_CONFIRM=1 to run (destructive).')
    process.exit(1)
  }

  const startIso = process.env.BORK_BACKFILL_START || '2024-01-01'
  const endIso = process.env.BORK_BACKFILL_END || new Date().toISOString().split('T')[0]
  const dayDelay = Number(process.env.BORK_DAY_DELAY_MS ?? 120)
  const batchDays = Math.max(1, Number(process.env.BORK_BATCH_DAYS ?? 31))
  const batchPause = Number(process.env.BORK_BATCH_PAUSE_MS ?? 250)
  const locPause = Number(process.env.BORK_LOCATION_PAUSE_MS ?? 500)
  const masterDelay = Number(process.env.BORK_MASTER_DELAY_MS ?? 200)

  const startDate = parseIsoDate(startIso)
  const endDate = parseIsoDate(endIso)
  const allDays = eachCalendarDay(startDate, endDate)

  console.log(
    `[bork-backfill] Date range ${startIso} .. ${endIso} (${allDays.length} day(s)); db=${dbName}`
  )

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  try {
    const creds = await loadBorkCredentials(db)
    if (creds.length === 0) {
      console.error('[bork-backfill] No Bork api_credentials rows.')
      process.exit(1)
    }

    console.log(`[bork-backfill] ${creds.length} Bork location credential(s)`)

    await clearBorkDerivedCollections(db)

    let totalTicketWrites = 0
    let dayIndex = 0

    for (const cred of creds) {
      const lid = cred.locationId != null ? String(cred.locationId) : 'unknown'
      const apiKey = typeof cred.apiKey === 'string' ? cred.apiKey : ''
      const baseUrl = typeof cred.baseUrl === 'string' ? cred.baseUrl : ''
      if (!apiKey || !baseUrl) {
        console.warn(`[bork-backfill] skip ${lid}: missing baseUrl or apiKey`)
        continue
      }

      console.log(`[bork-backfill] tickets: location ${lid} (${allDays.length} days)`)

      dayIndex = 0
      for (const dateStr of allDays) {
        dayIndex++
        const r = await fetchBorkJson(baseUrl, apiKey, `/ticket/day.json/${dateStr}`, {
          IncOpen: 'True',
          IncInternal: 'True',
        })
        if (!r.ok) {
          console.warn(`[bork-backfill] ${lid} ${dateStr}: ${r.error ?? r.status}`)
        } else {
          const records = extractRecords(r.data)
          if (records.length > 0) {
            await upsertTicketDay(db, cred, lid, dateStr, records)
            totalTicketWrites++
          }
        }

        if (dayIndex % batchDays === 0) await sleep(batchPause)
        else await sleep(dayDelay)
      }

      console.log(`[bork-backfill] master JSON: location ${lid}`)
      for (const spec of BORK_MASTER_PATHS) {
        const mr = await fetchBorkJson(baseUrl, apiKey, spec.path)
        if (!mr.ok) {
          console.warn(`[bork-backfill] ${lid} ${spec.path}: ${mr.error ?? mr.status}`)
        } else {
          const suffix = `bork_master:${spec.endpoint.replace('bork_master_', '')}`
          await upsertMaster(db, cred, lid, spec.endpoint, suffix, mr.data)
        }
        await sleep(masterDelay)
      }

      await sleep(locPause)
    }

    console.log(`[bork-backfill] ticket day documents written (non-empty days): ${totalTicketWrites}`)

    const aggStart = startIso
    const aggEnd = endIso
    console.log(`[bork-backfill] rebuilding aggregations ${aggStart} .. ${aggEnd}`)
    const agg = await rebuildBorkSalesAggregation(db, aggStart, aggEnd, new Date())
    console.log('[bork-backfill] aggregation result:', agg)

    console.log('[bork-backfill] done.')
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error('[bork-backfill] fatal:', e)
  process.exit(1)
})
