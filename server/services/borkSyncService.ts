/**
 * @registry-id: borkSyncService
 * @created: 2026-04-06T12:00:00.000Z
 * @last-modified: 2026-04-09T15:00:00.000Z
 * @description: Bork/Trivec gateway fetch + bork_raw_data upserts; drives Bork cron/sync; calls borkRebuildAggregationService after sync
 * @last-fix: [2026-04-09] Integrated aggregation trigger on daily-data sync completion
 *
 * @exports-to:
 * ✓ server/api/bork/v2/cron.post.ts
 * ✓ server/api/bork/v2/sync.post.ts
 * ✓ server/services/borkRebuildAggregationService.ts
 */

import { ObjectId, type Db, type Document } from 'mongodb'
import { rebuildBorkSalesAggregation } from './borkRebuildAggregationService'

export type BorkLocationSyncResult = {
  locationId: string
  ok: boolean
  path?: string
  error?: string
}

export type BorkSyncJobResult = {
  ok: boolean
  jobType: string
  message: string
  locations?: BorkLocationSyncResult[]
}

function getDateRangeForJobType (jobType: string): { days: number } {
  if (jobType === 'historical-data') return { days: 30 }
  return { days: 1 } // daily-data and master-data just get today
}

async function tryFetchBorkTicketData (
  baseUrl: string,
  apiKey: string,
  dateStr: string // YYYYMMDD format
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const base = baseUrl.replace(/\/$/, '')
  // Bork endpoint: {baseUrl}/ticket/day.json/{YYYYMMDD}?appid={apiKey}&IncOpen=True&IncInternal=True
  const url = `${base}/ticket/day.json/${dateStr}?appid=${apiKey}&IncOpen=True&IncInternal=True`

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

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

async function syncLocationDates (
  db: Db,
  cred: Document,
  jobType: string
): Promise<BorkLocationSyncResult> {
  const locationId = cred.locationId
  const lid = locationId != null ? String(locationId) : 'unknown'
  const apiKey = typeof cred.apiKey === 'string' ? cred.apiKey : ''
  const baseUrl = typeof cred.baseUrl === 'string' ? cred.baseUrl : ''

  if (!apiKey || !baseUrl) {
    return { locationId: lid, ok: false, error: 'missing baseUrl or apiKey on credential row' }
  }

  // Determine date range to sync
  const config = getDateRangeForJobType(jobType)
  const now = new Date()
  const dates: string[] = []

  for (let i = 0; i < config.days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dates.push(`${year}${month}${day}`)
  }

  let lastError = ''
  let successCount = 0

  for (const dateStr of dates) {
    const r = await tryFetchBorkTicketData(baseUrl, apiKey, dateStr)

    if (!r.ok) {
      lastError = r.error || `HTTP ${r.status || '?'}`
      continue
    }

    // Extract array of records from response
    let records: unknown[] = []
    if (Array.isArray(r.data)) {
      records = r.data
    } else if (r.data && typeof r.data === 'object') {
      const obj = r.data as Record<string, unknown>
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) {
          records = v
          break
        }
      }
    }

    if (records.length === 0) {
      continue
    }

    // Upsert into bork_raw_data
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

    successCount++
  }

  if (successCount > 0) {
    return { locationId: lid, ok: true, path: `/ticket/day.json/{date}` }
  }

  return { locationId: lid, ok: false, error: lastError || 'no data returned for any date' }
}

/** Load Bork credentials: active or legacy rows without isActive:false */
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

export async function executeBorkJob (db: Db, jobType: string): Promise<BorkSyncJobResult> {
  const creds = await loadBorkCredentials(db)
  if (creds.length === 0) {
    return {
      ok: false,
      jobType,
      message: 'No Bork rows in api_credentials (provider bork, with apiKey).',
    }
  }

  const locations: BorkLocationSyncResult[] = []
  for (const c of creds) {
    const r = await syncLocationDates(db, c, jobType)
    locations.push(r)
  }

  const okCount = locations.filter((x) => x.ok).length
  const syncOk = okCount > 0
  const message = syncOk
    ? `Synced ${okCount}/${creds.length} location(s) into bork_raw_data`
    : `0/${creds.length} locations succeeded — check Bork API credentials and network access`

  // After sync completes, trigger aggregation for daily data
  let aggregationResult: Partial<{ byCron: number; byHour: number; byTable: number; byWorker: number }> = {}
  if (syncOk && jobType === 'daily-data') {
    try {
      const today = new Date().toISOString().split('T')[0]
      aggregationResult = await rebuildBorkSalesAggregation(db, today, today)
    } catch (e) {
      console.error('[borkSyncService] Aggregation error:', e)
      // Don't fail the sync if aggregation fails
    }
  }

  const finalMessage = aggregationResult.byCron 
    ? `${message}; Aggregated: ${aggregationResult.byCron} cron snapshots, ${aggregationResult.byHour} hours, ${aggregationResult.byTable} tables, ${aggregationResult.byWorker} workers`
    : message

  return {
    ok: syncOk,
    jobType,
    message: finalMessage,
    locations,
  }
}

export async function syncBorkSingleLocation (
  db: Db,
  locationId: string,
  mode: 'ping' | 'daily' | 'master'
): Promise<BorkSyncJobResult> {
  const orLoc: Record<string, unknown>[] = [{ locationId }]
  try {
    orLoc.push({ locationId: new ObjectId(locationId) })
  } catch {
    // ignore invalid ObjectId
  }
  const cred = await db.collection('api_credentials').findOne({
    provider: { $in: ['bork', 'Bork'] },
    $or: orLoc,
    $nor: [{ isActive: false }],
  })
  if (!cred) {
    return { ok: false, jobType: mode, message: 'No Bork credential for this locationId' }
  }

  const r = await syncLocationDates(db, cred, mode === 'ping' ? 'daily-data' : mode === 'master' ? 'master-data' : 'daily-data')
  return {
    ok: r.ok,
    jobType: mode,
    message: r.ok ? `OK via ${r.path ?? '?'}` : (r.error ?? 'failed'),
    locations: [r],
  }
}
