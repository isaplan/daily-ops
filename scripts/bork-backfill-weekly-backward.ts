/**
 * Bork historical sync: IMPROVED weekly backward sync
 *
 * Syncs backwards from TODAY to Jan 1, 2025 in weekly batches.
 * After each week completes, triggers aggregation for that week's data.
 *
 * Usage:
 *   BORK_BACKFILL_CONFIRM=1 nohup node --experimental-strip-types scripts/bork-backfill-weekly-backward.ts >> /tmp/bork-backfill.log 2>&1 &
 *
 * Features:
 * - Starts from TODAY and syncs BACKWARDS to 2025-01-01
 * - Groups data into WEEKLY batches (Monday-Sunday)
 * - After each week syncs successfully, triggers aggregation immediately
 * - Incremental by default (skips days already in DB)
 * - Safe to restart: re-run to continue from where it left off
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, type Db, type Document } from 'mongodb'
import { rebuildBorkSalesAggregation } from '../server/services/borkRebuildAggregationService.ts'

function loadDotEnv() {
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

// Existing helper functions from original script
function toYyyymmdd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function dateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Generate weeks BACKWARDS from end to start
 * Each week is [weekStart, weekEnd] in ISO format
 */
function generateWeeksBackwards(startDate: Date, endDate: Date): Array<[string, string]> {
  const weeks: Array<[string, string]> = []
  const curr = new Date(endDate)
  curr.setHours(0, 0, 0, 0)
  
  while (curr >= startDate) {
    // Find end of this week (current date or today if today is earlier)
    const weekEnd = new Date(curr)
    
    // Find start of week (7 days back, but not before startDate)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() - 6)
    
    if (weekStart < startDate) {
      weekStart.setTime(startDate.getTime())
    }
    
    weeks.push([dateToIso(weekStart), dateToIso(weekEnd)])
    
    // Move to start of previous week
    curr.setDate(curr.getDate() - 7)
  }
  
  return weeks
}

async function withTransientRetry<T>(
  label: string,
  fn: () => Promise<T>,
  retries = 8
): Promise<T> {
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

async function loadBorkCredentials(db: Db): Promise<Document[]> {
  return db.collection('api_credentials').find({ apiKey: { $exists: true } }).toArray()
}

async function loadExistingTicketKeys(
  db: Db,
  locationId: string,
  days: string[]
): Promise<Set<string>> {
  const found = await db
    .collection('bork_raw_data')
    .find({
      syncDedupKey: {
        $in: days.map((d) => `${locationId}:bork_daily:${d}`),
      },
    })
    .project({ syncDedupKey: 1 })
    .toArray()
  return new Set(found.map((d) => String(d.syncDedupKey)))
}

async function upsertTicketDay(
  db: Db,
  cred: Document,
  locationId: string,
  dateStr: string,
  records: unknown[],
  extra: { isEmptyDay?: boolean } = {}
): Promise<void> {
  const syncDedupKey = `${locationId}:bork_daily:${dateStr}`
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

async function fetchBorkJson(
  baseUrl: string,
  apiKey: string,
  path: string,
  params: Record<string, string> = {}
): Promise<{ ok: boolean; status?: number; error?: string; data?: any }> {
  try {
    const base = baseUrl.replace(/\/$/, '')
    const url = new URL(`${base}${path}`)
    
    // Add API key as appid query parameter (Bork/Trivec requires this)
    url.searchParams.set('appid', apiKey)
    
    // Add other params
    Object.entries(params).forEach(([k, v]) => {
      url.searchParams.set(k, v)
    })

    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })

    if (!resp.ok) {
      return { ok: false, status: resp.status }
    }

    const text = await resp.text()
    let data: unknown = text
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      // keep as text
    }

    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function main(): Promise<void> {
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

  const dayDelay = Number(process.env.BORK_DAY_DELAY_MS ?? 75)
  const batchPause = Number(process.env.BORK_BATCH_PAUSE_MS ?? 200)
  const progressEvery = Math.max(1, Number(process.env.BORK_PROGRESS_EVERY ?? 50))

  // Generate date range: TODAY backwards to Jan 1, 2025
  const todayIso = new Date().toISOString().split('T')[0]
  const startIso = '2025-01-01'
  const startDate = isoToDate(startIso)
  const endDate = isoToDate(todayIso)

  const weeks = generateWeeksBackwards(startDate, endDate)

  console.log(
    `[bork-backfill-weekly] Syncing BACKWARDS: ${todayIso} → ${startIso} (${weeks.length} weeks); db=${dbName}; fullReset=${fullReset}`
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

    console.log(`[bork-backfill] ${creds.length} Bork location(s)`)

    let totalWeeksSynced = 0
    let totalRecordsSynced = 0

    // Process each week
    for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
      const [weekStart, weekEnd] = weeks[weekIdx]
      console.log(
        `\n📅 Week ${weekIdx + 1}/${weeks.length}: ${weekStart} to ${weekEnd}`
      )

      let weekHasNewData = false

      // Sync all days in this week for all locations
      for (const cred of creds) {
        const locationId = cred.locationId != null ? String(cred.locationId) : 'unknown'
        const apiKey = typeof cred.apiKey === 'string' ? cred.apiKey : ''
        const baseUrl = typeof cred.baseUrl === 'string' ? cred.baseUrl : ''

        if (!apiKey || !baseUrl) {
          console.warn(`  ⏭️  ${locationId}: missing apiKey or baseUrl`)
          continue
        }

        // Generate all days in this week
        const weekStartDate = isoToDate(weekStart)
        const weekEndDate = isoToDate(weekEnd)
        const daysInWeek: string[] = []
        const curr = new Date(weekStartDate)
        while (curr <= weekEndDate) {
          daysInWeek.push(dateToIso(curr))
          curr.setDate(curr.getDate() + 1)
        }

        // Load existing keys to skip already-synced days
        const existingKeys = !fullReset ? await loadExistingTicketKeys(db, locationId, daysInWeek) : new Set()

        let locationRecords = 0
        for (const dayIso of daysInWeek) {
          const dayYyyymmdd = dayIso.replace(/-/g, '')
          const ticketKey = `${locationId}:bork_daily:${dayYyyymmdd}`

          if (!fullReset && existingKeys.has(ticketKey)) {
            continue
          }

          // Fetch day data
          const res = await fetchBorkJson(baseUrl, apiKey, `/ticket/day.json/${dayYyyymmdd}`, {
            IncOpen: 'True',
            IncInternal: 'True',
          })

          if (!res.ok) {
            console.warn(`    ${locationId} ${dayIso}: ${res.error ?? res.status}`)
          } else {
            const records = Array.isArray(res.data) ? res.data : res.data?.Tickets || []
            await upsertTicketDay(db, cred, locationId, dayYyyymmdd, records, {
              isEmptyDay: records.length === 0,
            })
            locationRecords += records.length
            weekHasNewData = true
          }

          await sleep(dayDelay)
        }

        if (locationRecords > 0) {
          console.log(`    ✅ ${locationId}: ${locationRecords} records`)
          totalRecordsSynced += locationRecords
        }

        await sleep(batchPause)
      }

      // After week completes, rebuild aggregations for that week
      if (weekHasNewData) {
        console.log(`🏗️  Rebuilding aggregations for week ${weekStart}..${weekEnd}`)
        try {
          const aggStart = weekStart
          const aggEndDate = new Date(isoToDate(weekEnd))
          aggEndDate.setDate(aggEndDate.getDate() + 1)
          const aggEnd = dateToIso(aggEndDate)

          const result = await rebuildBorkSalesAggregation(db, aggStart, aggEnd)
          console.log(
            `    ✅ Aggregation complete: ${result.byCron} cron, ${result.byHour} hour, ${result.byTable} table, ${result.byWorker} worker`
          )
          totalWeeksSynced++
        } catch (e) {
          console.warn(`    ⚠️  Aggregation failed: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }

    console.log(
      `\n✅ Done! Synced ${totalWeeksSynced} weeks with ${totalRecordsSynced} total records`
    )
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('[bork-backfill] Fatal error:', err)
  process.exit(1)
})
