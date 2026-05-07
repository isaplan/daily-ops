/**
 * Bork historical sync: ticket days + master JSON per location, then rebuild sales aggregates.
 *
 * IMPROVED VERSION: Syncs backwards from today to Jan 1, 2025 in weekly batches.
 * After each week completes, triggers aggregation for that week's data.
 *
 *   BORK_BACKFILL_CONFIRM=1 nohup node --experimental-strip-types scripts/bork-full-raw-backfill.ts >> /tmp/bork-backfill.log 2>&1 &
 *
 * Full wipe + refetch (dangerous):
 *   BORK_BACKFILL_CONFIRM=1 BORK_BACKFILL_FULL_RESET=1 ... (deletes bork_raw_data and aggregates)
 *
 * Env:
 *   MONGODB_URI, MONGODB_DB_NAME
 *   BORK_BACKFILL_CONFIRM=1       — required
 *   BORK_BACKFILL_FULL_RESET=1     — delete bork_raw_data + all Bork aggregate collections, then refetch all
 *   BORK_DAY_DELAY_MS=75, BORK_BATCH_PAUSE_MS=200, BORK_LOCATION_PAUSE_MS=400,
 *   BORK_MASTER_DELAY_MS=150, BORK_PROGRESS_EVERY=50
 *
 * Behavior:
 * - Starts from TODAY and syncs BACKWARDS to 2025-01-01
 * - Groups data into WEEKLY batches (Sunday-Saturday)
 * - After each week syncs successfully, triggers aggregation immediately
 * - Aggregation runs only on newly synced data for that week
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, type Db, type Document } from 'mongodb'
import { rebuildBorkSalesAggregationV2 } from '../server/services/borkRebuildAggregationV2Service.ts'
import { resolveV2RebuildCollectionSuffix } from '../server/utils/borkV2RebuildSuffix.ts'

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

function borkV2AggregateCollections (): string[] {
  const sfx = resolveV2RebuildCollectionSuffix()
  return [
    `bork_business_days${sfx}`,
    `bork_sales_by_day${sfx}`,
    `bork_sales_by_hour${sfx}`,
    `bork_sales_by_table${sfx}`,
    `bork_sales_by_worker${sfx}`,
    `bork_sales_by_guest_account${sfx}`,
    `bork_sales_by_product${sfx}`,
    'bork_products_master',
  ]
}

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

async function withTransientRetry<T> (label: string, fn: () => Promise<T>, retries = 8): Promise<T> {
  let last: unknown
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      const msg = e instanceof Error ? e.message : String(e)
      const retryable =
        /MongoNetworkError|MongoServerSelectionError|ENOTFOUND|ECONNRESET|ReplicaSetNoPrimary|PoolCleared|ServerSelectionError|SSL|timed out|EAI_AGAIN/i.test(
          msg
        )
      if (!retryable || i === retries - 1) throw e
      const wait = Math.min(60_000, 5000 * (i + 1))
      console.warn(`[bork-backfill] ${label}: ${msg} — retry ${i + 1}/${retries} in ${wait}ms`)
      await sleep(wait)
    }
  }
  throw last
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
  return withTransientRetry('loadBorkCredentials', () =>
    db
      .collection('api_credentials')
      .find({
        provider: { $in: ['bork', 'Bork'] },
        $nor: [{ isActive: false }],
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .toArray()
  )
}

async function clearBorkRawAndAggregates (db: Db): Promise<void> {
  const cols = ['bork_raw_data', ...borkV2AggregateCollections()]
  for (const name of cols) {
    const r = await withTransientRetry(`clear ${name}`, () => db.collection(name).deleteMany({}))
    console.log(`[bork-backfill] cleared ${name}: ${r.deletedCount} document(s)`)
  }
}

async function clearBorkAggregateCollectionsOnly (db: Db): Promise<void> {
  for (const name of borkV2AggregateCollections()) {
    const r = await withTransientRetry(`clear aggregates ${name}`, () => db.collection(name).deleteMany({}))
    console.log(`[bork-backfill] cleared aggregates ${name}: ${r.deletedCount} document(s)`)
  }
}

async function loadExistingTicketKeySet (db: Db, lid: string, days: string[]): Promise<Set<string>> {
  if (days.length === 0) return new Set()
  const keys = days.map(d => `${lid}:bork_daily:${d}`)
  const CHUNK = 400
  const out = new Set<string>()
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK)
    const found = await withTransientRetry('loadExistingTicketKeys', () =>
      db
        .collection('bork_raw_data')
        .find({ syncDedupKey: { $in: slice } }, { projection: { syncDedupKey: 1 } })
        .toArray()
    )
    for (const d of found) {
      if (d.syncDedupKey) out.add(String(d.syncDedupKey))
    }
  }
  return out
}

async function loadExistingMasterKeySet (db: Db, lid: string): Promise<Set<string>> {
  const keys = BORK_MASTER_PATHS.map(
    spec => `${lid}:bork_master:${spec.endpoint.replace('bork_master_', '')}`
  )
  const found = await withTransientRetry('loadExistingMasterKeys', () =>
    db
      .collection('bork_raw_data')
      .find({ syncDedupKey: { $in: keys } }, { projection: { syncDedupKey: 1 } })
      .toArray()
  )
  return new Set(found.map(d => String(d.syncDedupKey)))
}

async function upsertTicketDay (
  db: Db,
  cred: Document,
  lid: string,
  dateStr: string,
  records: unknown[],
  extra: { isEmptyDay?: boolean } = {}
): Promise<void> {
  const syncDedupKey = `${lid}:bork_daily:${dateStr}`
  const upsertDate = new Date()
  const setDoc: Record<string, unknown> = {
    endpoint: 'bork_daily',
    locationId: cred.locationId,
    date: upsertDate,
    rawApiResponse: records,
    syncDedupKey,
    recordCount: records.length,
    updatedAt: upsertDate,
  }
  if (extra.isEmptyDay) setDoc.isEmptyDay = true

  const update: Record<string, unknown> = {
    $set: setDoc,
    $setOnInsert: { createdAt: upsertDate },
  }
  if (!extra.isEmptyDay) update.$unset = { isEmptyDay: '' }

  await withTransientRetry('upsertTicketDay', () =>
    db.collection('bork_raw_data').updateOne({ syncDedupKey }, update as never, { upsert: true })
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
  await withTransientRetry('upsertMaster', () =>
    db.collection('bork_raw_data').updateOne(
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
    console.error('[bork-backfill] Set BORK_BACKFILL_CONFIRM=1 to run.')
    process.exit(1)
  }

  const fullReset =
    process.env.BORK_BACKFILL_FULL_RESET === '1' || process.env.BORK_BACKFILL_FULL_RESET === 'yes'
  const incremental = !fullReset
  const forceRebuild =
    process.env.BORK_FORCE_REBUILD === '1' || process.env.BORK_FORCE_REBUILD === 'yes'

  const startIso = process.env.BORK_BACKFILL_START || '2024-01-01'
  const endIso = process.env.BORK_BACKFILL_END || new Date().toISOString().split('T')[0]
  const dayDelay = Number(process.env.BORK_DAY_DELAY_MS ?? 75)
  const batchDays = Math.max(1, Number(process.env.BORK_BATCH_DAYS ?? 31))
  const batchPause = Number(process.env.BORK_BATCH_PAUSE_MS ?? 200)
  const locPause = Number(process.env.BORK_LOCATION_PAUSE_MS ?? 400)
  const masterDelay = Number(process.env.BORK_MASTER_DELAY_MS ?? 150)
  const progressEvery = Math.max(1, Number(process.env.BORK_PROGRESS_EVERY ?? 50))

  const startDate = parseIsoDate(startIso)
  const endDate = parseIsoDate(endIso)
  const allDays = eachCalendarDay(startDate, endDate)

  console.log(
    `[bork-backfill] ${startIso} .. ${endIso} (${allDays.length} day(s)); db=${dbName}; incremental=${incremental}; fullReset=${fullReset}`
  )

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 120_000,
    connectTimeoutMS: 120_000,
    socketTimeoutMS: 0,
    retryWrites: true,
    retryReads: true,
  })
  await withTransientRetry('mongoConnect', () => client.connect())
  const db = client.db(dbName)

  try {
    const creds = await loadBorkCredentials(db)
    if (creds.length === 0) {
      console.error('[bork-backfill] No Bork api_credentials rows.')
      process.exit(1)
    }

    console.log(`[bork-backfill] ${creds.length} Bork location credential(s)`)

    if (fullReset) {
      await clearBorkRawAndAggregates(db)
    } else {
      console.log('[bork-backfill] incremental: keeping bork_raw_data; skipping keys already present')
    }

    let totalTicketWrites = 0
    let totalEmptyDays = 0
    let totalTicketSkipped = 0
    let totalMasterSkipped = 0
    let mutatedRaw = false
    let dayIndex = 0

    for (const cred of creds) {
      const lid = cred.locationId != null ? String(cred.locationId) : 'unknown'
      const apiKey = typeof cred.apiKey === 'string' ? cred.apiKey : ''
      const baseUrl = typeof cred.baseUrl === 'string' ? cred.baseUrl : ''
      if (!apiKey || !baseUrl) {
        console.warn(`[bork-backfill] skip ${lid}: missing baseUrl or apiKey`)
        continue
      }

      const existingTicketKeys = incremental
        ? await loadExistingTicketKeySet(db, lid, allDays)
        : new Set<string>()
      const existingMasterKeys = incremental ? await loadExistingMasterKeySet(db, lid) : new Set<string>()

      console.log(`[bork-backfill] tickets: location ${lid} (${allDays.length} days)`)

      dayIndex = 0
      for (const dateStr of allDays) {
        dayIndex++
        const ticketKey = `${lid}:bork_daily:${dateStr}`
        if (incremental && existingTicketKeys.has(ticketKey)) {
          totalTicketSkipped++
          if (dayIndex % progressEvery === 0 || dayIndex === allDays.length) {
            console.log(
              `[bork-backfill] ${lid} ticket days ${dayIndex}/${allDays.length} (at ${dateStr}, skip — in DB)`
            )
          }
          if (dayIndex % batchDays === 0) await sleep(batchPause)
          else await sleep(dayDelay)
          continue
        }

        const r = await fetchBorkJson(baseUrl, apiKey, `/ticket/day.json/${dateStr}`, {
          IncOpen: 'True',
          IncInternal: 'True',
        })
        if (!r.ok) {
          console.warn(`[bork-backfill] ${lid} ${dateStr}: ${r.error ?? r.status}`)
        } else {
          const records = extractRecords(r.data)
          if (records.length > 0) {
            await upsertTicketDay(db, cred, lid, dateStr, records, {})
            totalTicketWrites++
            mutatedRaw = true
            existingTicketKeys.add(ticketKey)
          } else {
            await upsertTicketDay(db, cred, lid, dateStr, [], { isEmptyDay: true })
            totalEmptyDays++
            mutatedRaw = true
            existingTicketKeys.add(ticketKey)
          }
        }

        if (dayIndex % progressEvery === 0 || dayIndex === allDays.length) {
          console.log(`[bork-backfill] ${lid} ticket days ${dayIndex}/${allDays.length} (at ${dateStr})`)
        }

        if (dayIndex % batchDays === 0) await sleep(batchPause)
        else await sleep(dayDelay)
      }

      console.log(`[bork-backfill] master JSON: location ${lid}`)
      for (const spec of BORK_MASTER_PATHS) {
        const suffix = `bork_master:${spec.endpoint.replace('bork_master_', '')}`
        const masterKey = `${lid}:${suffix}`
        if (incremental && existingMasterKeys.has(masterKey)) {
          totalMasterSkipped++
          console.log(`[bork-backfill] skip master ${spec.path} (${lid}) — in DB`)
          await sleep(masterDelay)
          continue
        }
        const mr = await fetchBorkJson(baseUrl, apiKey, spec.path)
        if (!mr.ok) {
          console.warn(`[bork-backfill] ${lid} ${spec.path}: ${mr.error ?? mr.status}`)
        } else {
          await upsertMaster(db, cred, lid, spec.endpoint, suffix, mr.data)
          mutatedRaw = true
          existingMasterKeys.add(masterKey)
        }
        await sleep(masterDelay)
      }

      await sleep(locPause)
    }

    console.log(
      `[bork-backfill] ticket writes: ${totalTicketWrites} (non-empty), empty-day markers: ${totalEmptyDays}; skipped ticket days: ${totalTicketSkipped}; skipped master: ${totalMasterSkipped}; mutatedRaw=${mutatedRaw}`
    )

    const aggStart = startIso
    // NOTE: Extend end date by 1 day because business day logic (08:00-08:00) means
    // hours 0-7 on the day after belong to the current business day
    const aggEndDate = new Date(endIso)
    aggEndDate.setDate(aggEndDate.getDate() + 1)
    const aggEnd = aggEndDate.toISOString().split('T')[0]

    let needsRebuild = true
    if (!fullReset && !forceRebuild && !mutatedRaw) {
      const sfx = resolveV2RebuildCollectionSuffix()
      const daysN = await withTransientRetry('countBusinessDays', () =>
        db.collection(`bork_business_days${sfx}`).countDocuments()
      )
      if (daysN > 0) {
        needsRebuild = false
        console.log(
          `[bork-backfill] skip aggregation (${daysN} bork_business_days${sfx} doc(s) already; no new raw this run). Set BORK_FORCE_REBUILD=1 to rebuild anyway.`
        )
      }
    }

    if (needsRebuild) {
      console.log('[bork-backfill] clearing aggregate collections before rebuild')
      await clearBorkAggregateCollectionsOnly(db)
      console.log(`[bork-backfill] rebuilding V2 aggregations ${aggStart} .. ${aggEnd}`)
      const sfx = resolveV2RebuildCollectionSuffix()
      const agg = await withTransientRetry('rebuildBorkSalesAggregationV2', () =>
        rebuildBorkSalesAggregationV2(db, aggStart, aggEnd, sfx)
      )
      console.log('[bork-backfill] aggregation result:', agg)
    }

    console.log('[bork-backfill] done.')
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error('[bork-backfill] fatal:', e)
  process.exit(1)
})
