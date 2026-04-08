/**
 * @registry-id: borkSyncService
 * @created: 2026-04-06T12:00:00.000Z
 * @last-modified: 2026-04-05T18:00:00.000Z
 * @description: Bork/Trivec gateway fetch + bork_raw_data upserts; drives Bork cron/sync
 * @last-fix: [2026-04-05] Ping mode paths (BORK_PING_PATHS); cron/sync API wiring
 *
 * @exports-to:
 * ✓ server/api/bork/v2/cron.post.ts
 * ✓ server/api/bork/v2/sync.post.ts
 */

import { ObjectId, type Db, type Document } from 'mongodb'

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

function pathList (envKey: string, fallback: string): string[] {
  const raw = process.env[envKey] || fallback
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

async function tryFetchGateway (
  baseUrl: string,
  apiKey: string,
  relPath: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const base = baseUrl.replace(/\/$/, '')
  const url = `${base}/${relPath.replace(/^\//, '')}`
  const headerAttempts: Record<string, string>[] = [
    { 'X-API-Key': apiKey, Accept: 'application/json' },
    { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    { ApiKey: apiKey, Accept: 'application/json' },
    { 'App-Id': apiKey, Accept: 'application/json' },
    { 'app-id': apiKey, Accept: 'application/json' },
  ]
  let lastStatus = 0
  for (const headers of headerAttempts) {
    const res = await fetch(url, { method: 'GET', headers })
    lastStatus = res.status
    const text = await res.text()
    let data: unknown = text
    try {
      data = text ? (JSON.parse(text) as unknown) : null
    } catch {
      // keep text
    }
    if (res.ok) return { ok: true, status: res.status, data }
  }
  return { ok: false, status: lastStatus, data: null }
}

async function syncLocationPaths (
  db: Db,
  cred: Document,
  endpointLabel: string,
  paths: string[]
): Promise<BorkLocationSyncResult> {
  const locationId = cred.locationId
  const lid = locationId != null ? String(locationId) : 'unknown'
  const apiKey = typeof cred.apiKey === 'string' ? cred.apiKey : ''
  const baseUrl = typeof cred.baseUrl === 'string' ? cred.baseUrl : ''
  if (!apiKey || !baseUrl) {
    return { locationId: lid, ok: false, error: 'missing baseUrl or apiKey on credential row' }
  }

  let lastStatus = 0
  for (const p of paths) {
    const r = await tryFetchGateway(baseUrl, apiKey, p)
    lastStatus = r.status
    if (!r.ok) continue

    const syncDedupKey = `${lid}:${endpointLabel}:${p}`
    const now = new Date()
    await db.collection('bork_raw_data').updateOne(
      { syncDedupKey },
      {
        $set: {
          endpoint: endpointLabel,
          locationId: cred.locationId,
          date: now,
          rawApiResponse: r.data,
          syncDedupKey,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    )
    return { locationId: lid, ok: true, path: p }
  }

  return { locationId: lid, ok: false, error: `no path succeeded (last HTTP ${lastStatus || '—'})` }
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

  const isMaster = jobType === 'master-data'
  const paths = isMaster
    ? pathList('BORK_MASTER_PATHS', 'api/v1/product_groups,product_groups,v1/product_groups,api/status')
    : pathList('BORK_DAILY_PATHS', 'api/v1/sales,sales,api/v1/transactions,api/status,health')

  const endpointLabel = isMaster ? 'bork_master' : 'bork_daily'

  const locations: BorkLocationSyncResult[] = []
  for (const c of creds) {
    const r = await syncLocationPaths(db, c, endpointLabel, paths)
    locations.push(r)
  }

  const okCount = locations.filter((x) => x.ok).length
  return {
    ok: okCount > 0,
    jobType,
    message: okCount > 0
      ? `Synced ${okCount}/${creds.length} location(s) into bork_raw_data`
      : `0/${creds.length} locations succeeded — check BORK_*_PATHS env or gateway URLs`,
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
  const paths =
    mode === 'master'
      ? pathList('BORK_MASTER_PATHS', 'api/v1/product_groups,product_groups,api/status')
      : mode === 'ping'
        ? pathList('BORK_PING_PATHS', 'api/status,health,api/v1/status')
        : pathList('BORK_DAILY_PATHS', 'api/v1/sales,sales,api/status,health')
  const label = mode === 'master' ? 'bork_master' : mode === 'ping' ? 'bork_ping' : 'bork_daily'
  const r = await syncLocationPaths(db, cred, label, paths)
  return {
    ok: r.ok,
    jobType: mode,
    message: r.ok ? `OK via ${r.path ?? '?'}` : (r.error ?? 'failed'),
    locations: [r],
  }
}
