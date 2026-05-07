/**
 * @registry-id: eitjeSyncService
 * @created: 2026-04-05T12:00:00.000Z
 * @last-modified: 2026-05-08T00:47:00.000Z
 * @description: Fetches Eitje Open API resources and upserts eitje_raw_data; drives cron/sync handlers
 * @last-fix: [2026-05-08] Remove V3 aggregation trigger
 *
 * @exports-to:
 * ✓ server/api/eitje/v2/cron.post.ts
 * ✓ server/api/eitje/v2/sync.post.ts
 * ✓ server/services/integrationCronRunner.ts
 */

import { createHash } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { Db } from 'mongodb'
import { getMongoDatabaseName } from '../utils/db'
import { documentToEitjeStoredCredentials, findEitjeCredentialDocument } from '../utils/eitjeApiCredentials'
import { eitjeFetchJson, legacyEitjeV2Headers, normalizeEitjeBaseUrl, type EitjeStoredCredentials } from './eitjeOpenApiFetch'
import { rebuildEitjeTimeRegistrationAggregation } from './eitjeRebuildAggregationService'

function envInt (name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export type EitjeSyncJobResult = {
  ok: boolean
  jobType: string
  message: string
  timeRegistration?: { upserted: number; fetched: number; error?: string }
  master?: { endpoints: Array<{ name: string; upserted: number; fetched: number; error?: string }> }
  aggregation?: { deletedPeriods: number; inserted: number; error?: string }
}

export async function loadActiveEitjeCredentials (db: Db): Promise<EitjeStoredCredentials | null> {
  const row = await findEitjeCredentialDocument(db)
  if (!row) return null
  return documentToEitjeStoredCredentials(row)
}

export function eitjeCredentialsHintMessage (): string {
  const dbn = getMongoDatabaseName()
  return `No usable Eitje row in api_credentials (database "${dbn}"). Open Settings → Eitje API → save all four fields, or align MONGODB_DB_NAME / MONGODB_URI in .env.local with the DB where you store credentials.`
}

function extractRecords (data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    for (const v of Object.values(o)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
        return v as Record<string, unknown>[]
      }
    }
  }
  return []
}

function nextPageUrl (data: unknown, currentUrl: string): string | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const links = o.links ?? o._links
  if (links && typeof links === 'object') {
    const l = links as Record<string, unknown>
    const n = l.next ?? l.Next
    if (typeof n === 'string' && n.startsWith('http')) return n
  }
  const meta = o.meta
  if (meta && typeof meta === 'object') {
    const m = meta as Record<string, unknown>
    const n = m.next_page_url ?? m.next
    if (typeof n === 'string' && n.startsWith('http')) return n
  }
  return null
}

function stableDedupKey (endpoint: string, raw: Record<string, unknown>): string {
  const id = raw.id ?? raw.shift_id ?? raw.uuid
  if (id != null && String(id).length > 0) return `${endpoint}:${String(id)}`
  const h = createHash('sha256')
    .update(
      JSON.stringify([
        raw.user_id,
        raw.userId,
        raw.date,
        raw.start,
        raw.start_time,
        raw.end,
        raw.end_time,
        raw.environment_id,
        raw.environmentId,
      ])
    )
    .digest('hex')
  return `${endpoint}:h:${h.slice(0, 32)}`
}

function toDate (v: unknown): Date | null {
  if (v == null) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

function num (v: unknown): number | undefined {
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

type RawUpsertBody = {
  syncDedupKey: string
  endpoint: string
  date: Date
  environmentId?: number
  extracted: Record<string, unknown>
  rawApiResponse: Record<string, unknown>
  updatedAt: Date
  createdAt: Date
}

function buildRawShiftDoc (raw: Record<string, unknown>, endpoint: string): RawUpsertBody {
  const start = raw.start ?? raw.start_time ?? raw.started_at ?? raw.from
  const dateRaw =
    raw.date ?? raw.work_date ?? raw.day ?? raw.worked_on ??
    (typeof start === 'string' ? start.slice(0, 10) : null)
  let date = toDate(dateRaw)
  if (!date && start != null) date = toDate(start)
  if (!date) date = new Date()

  const userObj = raw.user && typeof raw.user === 'object' ? (raw.user as Record<string, unknown>) : null
  const teamObj = raw.team && typeof raw.team === 'object' ? (raw.team as Record<string, unknown>) : null

  const userId = raw.user_id ?? raw.userId ?? userObj?.id
  const supportId = raw.support_id ?? raw.supportId ?? userObj?.support_id
  const teamId = raw.team_id ?? raw.teamId ?? teamObj?.id
  const environmentId =
    num(raw.environment_id) ?? num(raw.environmentId) ?? num(raw.location_id) ?? num(raw.venue_id)

  const hoursPre =
    num(raw.hours) ?? num(raw.hours_worked) ?? num(raw.hoursWorked) ?? undefined

  const extracted: Record<string, unknown> = {
    userId,
    supportId,
    teamId,
    environmentId,
    locationName: raw.location_name ?? raw.environment_name,
    environmentName: raw.environment_name ?? raw.location_name,
    hours: hoursPre,
    amountInCents: num(raw.amt_in_cents) ?? num(raw.amount_in_cents),
  }

  const syncDedupKey = stableDedupKey(endpoint, raw)
  const now = new Date()

  return {
    endpoint,
    date,
    environmentId: environmentId ?? undefined,
    extracted,
    rawApiResponse: raw,
    syncDedupKey,
    updatedAt: now,
    createdAt: now,
  }
}

function buildListEntityDoc (raw: Record<string, unknown>, endpoint: string): RawUpsertBody {
  const id = raw.id ?? raw.uuid ?? raw.slug
  const syncDedupKey = id != null ? `${endpoint}:${String(id)}` : stableDedupKey(endpoint, raw)
  const now = new Date()
  return {
    endpoint,
    date: now,
    extracted: { id: raw.id, name: raw.name ?? raw.title },
    rawApiResponse: raw,
    syncDedupKey,
    updatedAt: now,
    createdAt: now,
  }
}

async function fetchAllList (
  creds: EitjeStoredCredentials,
  path: string,
  query: Record<string, string | undefined>
): Promise<{ records: Record<string, unknown>[]; lastError?: string; lastStatus: number }> {
  const out: Record<string, unknown>[] = []
  let url: string | null = path
  let lastStatus = 0
  let lastError = ''
  const maxPages = envInt('EITJE_SYNC_MAX_PAGES', 200)
  for (let page = 0; page < maxPages && url; page++) {
    const res = await eitjeFetchJson(creds, url, page === 0 ? { query } : undefined)
    lastStatus = res.status
    if (!res.ok) {
      lastError = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      return { records: out, lastError, lastStatus }
    }
    const batch = extractRecords(res.data)
    out.push(...batch)
    const next = nextPageUrl(res.data, res.url)
    url = next
    if (!next) break
  }
  return { records: out, lastStatus }
}

const TR_PATH = process.env.EITJE_PATH_TIME_REGISTRATION_SHIFTS ?? 'time_registration_shifts'

/** Same chunking as legacy `legacy/app/lib/cron/v2-cron-manager.ts` + `EITJE_DATE_LIMITS.time_registration_shifts` (7). */
function splitDateRangeForEitje (startDate: string, endDate: string, maxDays: number): Array<{ startDate: string; endDate: string }> {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (totalDays <= maxDays) {
    return [{ startDate, endDate }]
  }
  const chunks: Array<{ startDate: string; endDate: string }> = []
  let currentStart = new Date(start)
  while (currentStart < end) {
    const currentEnd = new Date(currentStart)
    currentEnd.setUTCDate(currentEnd.getUTCDate() + maxDays - 1)
    if (currentEnd > end) {
      currentEnd.setTime(end.getTime())
    }
    chunks.push({
      startDate: currentStart.toISOString().split('T')[0] ?? startDate,
      endDate: currentEnd.toISOString().split('T')[0] ?? endDate,
    })
    currentStart = new Date(currentEnd)
    currentStart.setUTCDate(currentStart.getUTCDate() + 1)
  }
  return chunks
}

async function persistRawTimeRegistrationShifts (db: Db, records: Record<string, unknown>[]): Promise<number> {
  if (records.length === 0) return 0
  const coll = db.collection('eitje_raw_data')
  let upserted = 0
  const chunk = 200
  for (let i = 0; i < records.length; i += chunk) {
    const slice = records.slice(i, i + chunk)
    const ops = slice.map((raw) => {
      const doc = buildRawShiftDoc(raw, 'time_registration_shifts')
      return {
        updateOne: {
          filter: { endpoint: 'time_registration_shifts', syncDedupKey: doc.syncDedupKey },
          update: {
            $set: {
              endpoint: doc.endpoint,
              date: doc.date,
              environmentId: doc.environmentId,
              extracted: doc.extracted,
              rawApiResponse: doc.rawApiResponse,
              updatedAt: doc.updatedAt,
            },
            $setOnInsert: { createdAt: doc.createdAt },
          },
          upsert: true,
        },
      }
    })
    const res = await coll.bulkWrite(ops, { ordered: false })
    upserted += res.upsertedCount + res.modifiedCount
  }
  return upserted
}

/** One API window only (max `maxDaysPerRequest` enforced by caller). Legacy GET+JSON body first. */
async function syncTimeRegistrationShiftsWindow (
  db: Db,
  creds: EitjeStoredCredentials,
  startDate: string,
  endDate: string
): Promise<{ upserted: number; fetched: number; error?: string }> {
  // Legacy Next.js integration used GET with JSON body filters for this endpoint.
  const tryLegacyGetWithBody = async (): Promise<{ records: Record<string, unknown>[]; lastError?: string; lastStatus: number }> => {
    const base = normalizeEitjeBaseUrl(creds.baseUrl).replace(/\/$/, '')
    const rawUrl = `${base}/time_registration_shifts`
    const body = JSON.stringify({
      filters: {
        start_date: startDate,
        end_date: endDate,
        date_filter_type: 'resource_date',
      },
    })
    try {
      const url = new URL(rawUrl)
      const transport = url.protocol === 'https:' ? httpsRequest : httpRequest
      const headers = {
        ...legacyEitjeV2Headers(creds),
        'Content-Length': String(Buffer.byteLength(body, 'utf8')),
      }
      const response = await new Promise<{ status: number; text: string }>((resolve, reject) => {
        const req = transport(
          url,
          {
            method: 'GET',
            headers,
            timeout: 30000,
          },
          (res) => {
            let text = ''
            res.setEncoding('utf8')
            res.on('data', (chunk) => { text += chunk })
            res.on('end', () => resolve({ status: res.statusCode ?? 0, text }))
          }
        )
        req.on('timeout', () => req.destroy(new Error('request timeout')))
        req.on('error', reject)
        req.write(body)
        req.end()
      })
      let parsed: unknown = response.text
      try {
        parsed = response.text ? JSON.parse(response.text) as unknown : null
      } catch {
        // keep raw string
      }
      if (response.status >= 200 && response.status < 300) {
        return { records: extractRecords(parsed), lastStatus: response.status }
      }
      const err = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
      return { records: [], lastStatus: response.status, lastError: err }
    } catch (e) {
      return { records: [], lastStatus: 0, lastError: e instanceof Error ? e.message : String(e) }
    }
  }

  const legacyBodyResult = await tryLegacyGetWithBody()
  if (legacyBodyResult.records.length > 0) {
    const upserted = await persistRawTimeRegistrationShifts(db, legacyBodyResult.records)
    return { upserted, fetched: legacyBodyResult.records.length }
  }

  const queryAttempts: Record<string, string | undefined>[] = [
    { from: startDate, to: endDate },
    { start_date: startDate, end_date: endDate },
    { date_from: startDate, date_to: endDate },
  ]

  let records: Record<string, unknown>[] = []
  let err = ''
  let status = 0

  const pathCandidates = [
    TR_PATH,
    `v1/${TR_PATH}`,
    'time-registrations',
    'time_registrations',
  ]

  outer: for (const path of pathCandidates) {
    for (const q of queryAttempts) {
      const r = await fetchAllList(creds, path, q)
      status = r.lastStatus
      if (r.records.length > 0) {
        records = r.records
        err = ''
        break outer
      }
      if (r.lastError) err = r.lastError
    }
  }

  if (records.length === 0 && err) {
    const legacyErr = legacyBodyResult.lastError ? `; legacy-body: ${legacyBodyResult.lastError.slice(0, 200)}` : ''
    return { upserted: 0, fetched: 0, error: `HTTP ${status}: ${err.slice(0, 400)}${legacyErr}` }
  }

  const upserted = await persistRawTimeRegistrationShifts(db, records)
  return { upserted, fetched: records.length }
}

const sleepMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function syncTimeRegistrationShifts (
  db: Db,
  creds: EitjeStoredCredentials,
  startDate: string,
  endDate: string
): Promise<{ upserted: number; fetched: number; error?: string }> {
  const maxDays = envInt('EITJE_TIME_REGISTRATION_MAX_DAYS', 7)
  const chunkDelayMs = envInt('EITJE_BACKFILL_CHUNK_DELAY_MS', 0)
  const chunks = splitDateRangeForEitje(startDate, endDate, maxDays)
  let upserted = 0
  let fetched = 0
  let i = 0
  for (const ch of chunks) {
    i++
    const r = await syncTimeRegistrationShiftsWindow(db, creds, ch.startDate, ch.endDate)
    if (r.error) {
      return {
        upserted,
        fetched,
        error: `${r.error} (window ${ch.startDate}–${ch.endDate})`,
      }
    }
    upserted += r.upserted
    fetched += r.fetched
    if (chunkDelayMs > 0 && i < chunks.length) await sleepMs(chunkDelayMs)
  }
  return { upserted, fetched }
}

async function syncListEndpoint (
  db: Db,
  creds: EitjeStoredCredentials,
  endpoint: string,
  pathCandidates: string[]
): Promise<{ upserted: number; fetched: number; error?: string }> {
  let records: Record<string, unknown>[] = []
  let err = ''
  let status = 0
  for (const path of pathCandidates) {
    const r = await fetchAllList(creds, path, {})
    status = r.lastStatus
    if (r.records.length > 0) {
      records = r.records
      err = ''
      break
    }
    if (r.lastError) err = r.lastError
  }
  if (records.length === 0) {
    return { upserted: 0, fetched: 0, error: err ? `HTTP ${status}: ${err.slice(0, 200)}` : 'empty response' }
  }
  const coll = db.collection('eitje_raw_data')
  let upserted = 0
  const chunk = 200
  for (let i = 0; i < records.length; i += chunk) {
    const slice = records.slice(i, i + chunk)
    const ops = slice.map((raw) => {
      const doc = buildListEntityDoc(raw, endpoint)
      return {
        updateOne: {
          filter: { endpoint, syncDedupKey: doc.syncDedupKey },
          update: {
            $set: {
              endpoint: doc.endpoint,
              date: doc.date,
              extracted: doc.extracted,
              rawApiResponse: doc.rawApiResponse,
              updatedAt: doc.updatedAt,
            },
            $setOnInsert: { createdAt: doc.createdAt },
          },
          upsert: true,
        },
      }
    })
    const res = await coll.bulkWrite(ops, { ordered: false })
    upserted += res.upsertedCount + res.modifiedCount
  }
  return { upserted, fetched: records.length }
}

function dateRangeDays (days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - days)
  const fmt = (d: Date) => d.toISOString().split('T')[0] ?? ''
  return { start: fmt(start), end: fmt(end) }
}

export async function pingEitjeApi (creds: EitjeStoredCredentials): Promise<{ ok: boolean; message: string }> {
  const paths = ['environments', 'v1/environments', 'locations', 'v1/locations']
  for (const p of paths) {
    const res = await eitjeFetchJson(creds, p, {})
    if (res.ok) {
      const n = extractRecords(res.data).length
      return { ok: true, message: `OK (${p}${n ? `, ${n} rows` : ''})` }
    }
  }
  const last = await eitjeFetchJson(creds, paths[0] ?? 'environments', {})
  const msg = typeof last.data === 'string' ? last.data : JSON.stringify(last.data)
  const base = `HTTP ${last.status} ${msg.slice(0, 240)} (last auth: ${last.authAttempt})`
  if (msg.includes('not all required auth keys present')) {
    return {
      ok: false,
      message:
        `${base} — Eitje returns this for missing and for rejected credentials. Confirm base URL (often .../open_api), Partner vs API username/password are the ones from Eitje Open API (not your web login), and re-save in Settings.`,
    }
  }
  return { ok: false, message: base }
}

export async function executeEitjeJob (db: Db, jobType: string): Promise<EitjeSyncJobResult> {
  const creds = await loadActiveEitjeCredentials(db)
  if (!creds) {
    return {
      ok: false,
      jobType,
      message: eitjeCredentialsHintMessage(),
    }
  }

  if (jobType === 'master-data') {
    const endpoints: Array<{ name: string; paths: string[] }> = [
      { name: 'environments', paths: ['environments', 'v1/environments', 'locations'] },
      { name: 'teams', paths: ['teams', 'v1/teams'] },
      { name: 'users', paths: ['users', 'v1/users', 'employees'] },
    ]
    const master: EitjeSyncJobResult['master'] = { endpoints: [] }
    for (const e of endpoints) {
      const r = await syncListEndpoint(db, creds, e.name, e.paths)
      master.endpoints.push({ name: e.name, upserted: r.upserted, fetched: r.fetched, error: r.error })
    }
    const ok = master.endpoints.some((x) => x.fetched > 0)
    // After master data sync, map environments/teams/users to unified collections
    if (ok) {
      try {
        await syncUnifiedMasterDataFromRaw(db)
      } catch (e) {
        console.error('[syncUnifiedMasterDataFromRaw]', e)
      }
    }
    return {
      ok,
      jobType,
      message: ok ? 'Master data sync finished' : 'Master data sync returned no rows (check API paths / credentials)',
      master,
    }
  }

  if (jobType === 'daily-data') {
    // Daily incremental sync: fetch only TODAY (service runs 10:00-05:59:59 UTC)
    // Cron runs at: 06:00 (pre-service), 13:00, 16:00, 18:00, 20:00, 22:00 (all during service hours)
    // Aggregate TODAY ONLY - continuous updates throughout the business day
    const now = new Date()
    const todayUtc = now.toISOString().split('T')[0] ?? ''
    
    const tr = await syncTimeRegistrationShifts(db, creds, todayUtc, todayUtc)
    let agg: { deletedPeriods: number; inserted: number; error?: string } | undefined
    
    try {
      // Rebuild aggregation for TODAY ONLY
      // This deletes old aggregation for today and rebuilds from fresh raw data
      agg = await rebuildEitjeTimeRegistrationAggregation(db, todayUtc, todayUtc)
      
      // Map Eitje IDs to unified collections after aggregation
      await syncUnifiedCollectionsFromRawData(db)
    } catch (e) {
      agg = {
        deletedPeriods: 0,
        inserted: 0,
        error: e instanceof Error ? e.message : String(e),
      }
    }

    const ok = !tr.error && (tr.fetched > 0 || tr.upserted > 0 || (agg?.inserted ?? 0) > 0)
    
    return {
      ok,
      jobType,
      message: tr.error
        ? `Time registration: ${tr.error}`
        : `Synced ${tr.fetched} shifts (${tr.upserted} writes), aggregation +${agg?.inserted ?? 0} rows for today`,
      timeRegistration: tr,
      aggregation: agg,
    }
  }

  // Historical backfill: fetch and rebuild full range
  const histDays = envInt('EITJE_HISTORICAL_SYNC_DAYS', 30)
  const { start, end } = dateRangeDays(histDays)

  const tr = await syncTimeRegistrationShifts(db, creds, start, end)
  let agg: { deletedPeriods: number; inserted: number; error?: string } | undefined
  
  try {
    agg = await rebuildEitjeTimeRegistrationAggregation(db, start, end)
    // Map Eitje IDs to unified collections after aggregation
    await syncUnifiedCollectionsFromRawData(db)
  } catch (e) {
    agg = {
      deletedPeriods: 0,
      inserted: 0,
      error: e instanceof Error ? e.message : String(e),
    }
  }

  const ok = !tr.error && (tr.fetched > 0 || tr.upserted > 0 || (agg?.inserted ?? 0) > 0)
  
  return {
    ok,
    jobType,
    message: tr.error
      ? `Time registration: ${tr.error}`
      : `Synced ${tr.fetched} shifts (${tr.upserted} writes), aggregation +${agg?.inserted ?? 0} rows (${jobType})`,
    timeRegistration: tr,
    aggregation: agg,
  }
}

/** Map master data (environments, teams, users) from eitje_raw_data to unified collections. */
async function syncUnifiedMasterDataFromRaw (db: Db): Promise<{ locationsUpdated: number; teamsUpdated: number; usersUpdated: number; error?: string }> {
  try {
    let locationsUpdated = 0
    let teamsUpdated = 0
    let usersUpdated = 0

    // Get all environment documents and extract IDs (no aggregation, just iterate)
    const envDocs = await db.collection('eitje_raw_data').find({ endpoint: 'environments' }).toArray()
    const uniqueEnvs = new Map<number | string, string>()
    envDocs.forEach((doc: Record<string, unknown>) => {
      const extracted = doc.extracted as Record<string, unknown>
      const id = extracted?.id
      const name = extracted?.name
      if (id && name) uniqueEnvs.set(id, String(name))
    })

    for (const [id, name] of uniqueEnvs) {
      const result = await db.collection('unified_location').updateOne(
        { $or: [{ eitjeIds: id }, { allIdValues: id }] },
        {
          $set: {
            eitjeIds: [id],
            allIdValues: [id],
            primaryName: name,
            name,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      )
      locationsUpdated += result.upsertedCount + result.modifiedCount
    }

    // Get all team documents and extract IDs
    const teamDocs = await db.collection('eitje_raw_data').find({ endpoint: 'teams' }).toArray()
    const uniqueTeams = new Map<number | string, string>()
    teamDocs.forEach((doc: Record<string, unknown>) => {
      const extracted = doc.extracted as Record<string, unknown>
      const id = extracted?.id
      const name = extracted?.name
      if (id && name) uniqueTeams.set(id, String(name))
    })

    for (const [id, name] of uniqueTeams) {
      const result = await db.collection('unified_team').updateOne(
        { $or: [{ eitjeIds: id }, { allIdValues: id }] },
        {
          $set: {
            eitjeIds: [id],
            allIdValues: [id],
            primaryName: name,
            canonicalName: name,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      )
      teamsUpdated += result.upsertedCount + result.modifiedCount
    }

    // Get all user documents and extract IDs
    const userDocs = await db.collection('eitje_raw_data').find({ endpoint: 'users' }).toArray()
    const uniqueUsers = new Map<number | string, string>()
    userDocs.forEach((doc: Record<string, unknown>) => {
      const extracted = doc.extracted as Record<string, unknown>
      const id = extracted?.id
      const raw = doc.rawApiResponse as Record<string, unknown>
      const firstName = raw?.first_name ? String(raw.first_name) : ''
      const lastName = raw?.last_name ? String(raw.last_name) : ''
      const email = raw?.email ? String(raw.email) : ''
      const name = (firstName && lastName) ? `${firstName} ${lastName}` : email || String(id)
      if (id) uniqueUsers.set(id, name)
    })

    for (const [id, name] of uniqueUsers) {
      const result = await db.collection('unified_user').updateOne(
        { $or: [{ eitjeIds: id }, { allIdValues: id }] },
        {
          $set: {
            eitjeIds: [id],
            allIdValues: [id],
            primaryName: name,
            canonicalName: name,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      )
      usersUpdated += result.upsertedCount + result.modifiedCount
    }

    return { locationsUpdated, teamsUpdated, usersUpdated }
  } catch (e) {
    return {
      locationsUpdated: 0,
      teamsUpdated: 0,
      usersUpdated: 0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/** Map Eitje IDs (from eitje_raw_data) to unified_user and unified_team documents. */
async function syncUnifiedCollectionsFromRawData (db: Db): Promise<{ usersUpdated: number; teamsUpdated: number; error?: string }> {
  try {
    let usersUpdated = 0
    let teamsUpdated = 0

    // Extract all unique user IDs from raw data
    const userAgg = await db.collection('eitje_raw_data').aggregate([
      { $match: { endpoint: 'time_registration_shifts' } },
      { $addFields: { userId: { $ifNull: ['$extracted.userId', '$rawApiResponse.user_id'] } } },
      { $group: { _id: '$userId', userName: { $first: '$rawApiResponse.user.name' } } },
      { $match: { _id: { $nin: [null, ''] } } },
    ]).toArray() as Array<{ _id: number | string; userName: string }>

    // Upsert unified_user for each unique Eitje user ID
    for (const user of userAgg) {
      const result = await db.collection('unified_user').updateOne(
        { eitjeIds: user._id },
        {
          $addToSet: {
            eitjeIds: user._id,
            allIdValues: user._id,
          },
          $set: { updatedAt: new Date() },
          $setOnInsert: {
            primaryName: user.userName,
            canonicalName: user.userName,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      )
      usersUpdated += result.upsertedCount + result.modifiedCount
    }

    // Extract all unique team IDs from raw data
    const teamAgg = await db.collection('eitje_raw_data').aggregate([
      { $match: { endpoint: 'time_registration_shifts' } },
      { $addFields: { teamId: { $ifNull: ['$extracted.teamId', '$rawApiResponse.team_id'] } } },
      { $group: { _id: '$teamId', teamName: { $first: '$rawApiResponse.team.name' } } },
      { $match: { _id: { $nin: [null, ''] } } },
    ]).toArray() as Array<{ _id: number | string; teamName: string }>

    // Upsert unified_team for each unique Eitje team ID
    for (const team of teamAgg) {
      const result = await db.collection('unified_team').updateOne(
        { eitjeIds: team._id },
        {
          $addToSet: {
            eitjeIds: team._id,
            allIdValues: team._id,
          },
          $set: { updatedAt: new Date() },
          $setOnInsert: {
            primaryName: team.teamName,
            canonicalName: team.teamName,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      )
      teamsUpdated += result.upsertedCount + result.modifiedCount
    }

    return { usersUpdated, teamsUpdated }
  } catch (e) {
    return {
      usersUpdated: 0,
      teamsUpdated: 0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function syncEitjeByRequest (db: Db, body: {
  endpoint?: string
  startDate?: string
  endDate?: string
}): Promise<EitjeSyncJobResult> {
  const creds = await loadActiveEitjeCredentials(db)
  if (!creds) {
    return { ok: false, jobType: 'manual', message: eitjeCredentialsHintMessage() }
  }
  const ep = body.endpoint || 'environments'
  if (ep === 'environments' || ep === 'locations') {
    const ping = await pingEitjeApi(creds)
    return { ok: ping.ok, jobType: 'manual', message: ping.message }
  }
  if (ep === 'time_registration_shifts') {
    const dr = dateRangeDays(envInt('EITJE_DAILY_SYNC_DAYS', 14))
    const end = body.endDate ?? dr.end
    const start = body.startDate ?? dr.start
    const tr = await syncTimeRegistrationShifts(db, creds, start, end)
    let agg: { deletedPeriods: number; inserted: number; error?: string } | undefined
    try {
      agg = await rebuildEitjeTimeRegistrationAggregation(db, start, end)
      // Map Eitje IDs to unified collections after aggregation
      await syncUnifiedCollectionsFromRawData(db)
    } catch (e) {
      agg = { deletedPeriods: 0, inserted: 0, error: e instanceof Error ? e.message : String(e) }
    }
    return {
      ok: !tr.error,
      jobType: 'manual',
      message: tr.error ?? `OK: ${tr.fetched} fetched, agg +${agg?.inserted ?? 0}`,
      timeRegistration: tr,
      aggregation: agg,
    }
  }
  const r = await syncListEndpoint(db, creds, ep, [ep, `v1/${ep}`])
  return {
    ok: !r.error && r.fetched > 0,
    jobType: 'manual',
    message: r.error ?? `OK: ${r.fetched} rows`,
    master: { endpoints: [{ name: ep, ...r }] },
  }
}
