/**
 * @registry-id: borkSyncService
 * @created: 2026-04-06T12:00:00.000Z
 * @last-modified: 2026-05-20T12:00:00.000Z
 * @description: Bork/Trivec gateway fetch + bork_raw_data upserts; drives Bork cron/sync; calls V2 aggregation after sync
 * @last-fix: [2026-05-20] Master-data job refreshes unified product_catalog from Bork catalog API.
 *   Prior: [2026-05-19] Clearer V2 line: calendar rebuild window vs register-day rollup counts.
 *   Prior: [2026-05-19] Daily pulls yesterday+today tickets; per-day ticket counts in sync message.
 *   Prior: [2026-05-19] Ticket + V2 rebuild windows use Europe/Amsterdam calendar days (not toISOString UTC).
 *   Prior: [2026-05-11] Master/historical exclude today (ticket dates); V2 rebuild after master + historical jobs
 *
 * @exports-to:
 * ✓ server/api/bork/v2/cron.post.ts
 * ✓ server/api/bork/v2/sync.post.ts
 * ✓ server/services/borkRebuildAggregationV2Service.ts
 * ✓ server/services/integrationCronRunner.ts
 * ✓ server/services/productCatalogService.ts
 */

import { ObjectId, type Db, type Document } from 'mongodb'
import { rebuildBorkSalesAggregationV2 } from './borkRebuildAggregationV2Service'
import { syncProductCatalogFromBorkApi } from './productCatalogService'
import { resolveBorkAggRebuildSuffix } from '../utils/borkAggVersionSuffix'
import { addCalendarDaysYmd, calendarYmdInAmsterdam } from '~/utils/dailyOpsBusinessDate'

export type BorkLocationSyncResult = {
  locationId: string
  ok: boolean
  path?: string
  error?: string
  /** Amsterdam calendar day (YYYY-MM-DD) → ticket rows stored this run */
  ticketsByDate?: Record<string, number>
}

export type BorkSyncJobResult = {
  ok: boolean
  jobType: string
  message: string
  locations?: BorkLocationSyncResult[]
}

const BORK_HISTORICAL_TICKET_DAYS = 30
const PER_DAY_TICKET_BREAKDOWN_MAX_DAYS = 7

function getDateRangeForJobType (jobType: string): { days: number } {
  if (jobType === 'historical-data') return { days: BORK_HISTORICAL_TICKET_DAYS }
  if (jobType === 'daily-data') return { days: 2 }
  return { days: 1 } // master-data: yesterday only (see startDayOffset below)
}

function borkCompactToYmd (compact: string): string {
  const s = compact.padStart(8, '0')
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function formatOpsDayLabel (ymd: string): string {
  const parts = ymd.split('-').map((x) => Number(x))
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)))
}

function daySpanInclusive (startYmd: string, endYmd: string): number {
  let n = 0
  let cur = startYmd
  while (cur <= endYmd) {
    n++
    if (cur === endYmd) break
    cur = addCalendarDaysYmd(cur, 1)
  }
  return n
}

function formatPerDayTicketBreakdown (
  byDate: Record<string, number>,
  startYmd: string,
  endYmd: string,
): string {
  const parts: string[] = []
  let cur = startYmd
  while (cur <= endYmd) {
    const n = byDate[cur] ?? 0
    parts.push(`${n} on ${formatOpsDayLabel(cur)}`)
    if (cur === endYmd) break
    cur = addCalendarDaysYmd(cur, 1)
  }
  return parts.join(', ')
}

function mergeTicketsByDate (locations: BorkLocationSyncResult[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const loc of locations) {
    if (!loc.ticketsByDate) continue
    for (const [ymd, n] of Object.entries(loc.ticketsByDate)) {
      out[ymd] = (out[ymd] ?? 0) + n
    }
  }
  return out
}

function ticketWindowForJob (jobType: string, now = new Date()): { startYmd: string; endYmd: string } {
  const todayYmd = calendarYmdInAmsterdam(now)
  if (jobType === 'daily-data') {
    return { startYmd: addCalendarDaysYmd(todayYmd, -1), endYmd: todayYmd }
  }
  if (jobType === 'master-data') {
    const y = addCalendarDaysYmd(todayYmd, -1)
    return { startYmd: y, endYmd: y }
  }
  if (jobType === 'historical-data') {
    const endYmd = addCalendarDaysYmd(todayYmd, -1)
    return {
      startYmd: addCalendarDaysYmd(endYmd, -(BORK_HISTORICAL_TICKET_DAYS - 1)),
      endYmd,
    }
  }
  return { startYmd: todayYmd, endYmd: todayYmd }
}

function formatBorkRawSyncMessage (input: {
  okCount: number
  totalCreds: number
  syncOk: boolean
  jobType: string
  ticketsByDate: Record<string, number>
  startYmd: string
  endYmd: string
}): string {
  const { okCount, totalCreds, syncOk, jobType, ticketsByDate, startYmd, endYmd } = input
  if (!syncOk) {
    return `0/${totalCreds} locations succeeded — check Bork API credentials and network access`
  }
  const span = daySpanInclusive(startYmd, endYmd)
  let msg = `Synced ${okCount}/${totalCreds} location(s) into bork_raw_data`
  const totalTickets = Object.values(ticketsByDate).reduce((a, b) => a + b, 0)
  if (span <= PER_DAY_TICKET_BREAKDOWN_MAX_DAYS) {
    msg += `; tickets: ${formatPerDayTicketBreakdown(ticketsByDate, startYmd, endYmd)}`
  } else if (totalTickets > 0) {
    msg += `; tickets: ${totalTickets} (${startYmd}…${endYmd})`
  } else if (jobType === 'historical-data') {
    msg += ` (${startYmd}…${endYmd})`
  }
  return msg
}

function formatV2CalendarRangeLabel (startYmd: string, endYmd: string): string {
  if (startYmd === endYmd) return formatOpsDayLabel(startYmd)
  return `${formatOpsDayLabel(startYmd)}–${formatOpsDayLabel(endYmd)}`
}

function formatV2RebuildMessage (
  v2: {
    businessDays: number
    salesHours: number
    tables: number
    workers: number
    guestAccounts: number
    productLines: number
  },
  suffix: string,
  calendarStartYmd: string,
  calendarEndYmd: string,
): string {
  const hasStats =
    v2.businessDays > 0 ||
    v2.salesHours > 0 ||
    v2.tables > 0 ||
    v2.workers > 0 ||
    v2.productLines > 0
  if (!hasStats) return ''
  const cal = formatV2CalendarRangeLabel(calendarStartYmd, calendarEndYmd)
  const tag = suffix ? `, ${suffix}` : ''
  return (
    ` · V2 rebuild (${cal} calendar${tag}): ${v2.businessDays} register days, ` +
    `${v2.salesHours} hour buckets, ${v2.tables} tables, ${v2.workers} workers, ` +
    `${v2.guestAccounts} guest slices, ${v2.productLines} product lines`
  )
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
  /** Historical + master skip today; daily-data: i=0 today, i=1 yesterday (Amsterdam). */
  const startDayOffset = jobType === 'historical-data' || jobType === 'master-data' ? 1 : 0

  const todayYmd = calendarYmdInAmsterdam(now)
  for (let i = startDayOffset; i < startDayOffset + config.days; i++) {
    dates.push(addCalendarDaysYmd(todayYmd, -i).replace(/-/g, ''))
  }

  let lastError = ''
  let successCount = 0
  const ticketsByDate: Record<string, number> = {}

  for (const dateStr of dates) {
    const ymd = borkCompactToYmd(dateStr)
    ticketsByDate[ymd] = ticketsByDate[ymd] ?? 0

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

    ticketsByDate[ymd] += records.length

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
    return { locationId: lid, ok: true, path: `/ticket/day.json/{date}`, ticketsByDate }
  }

  return {
    locationId: lid,
    ok: false,
    error: lastError || 'no data returned for any date',
    ticketsByDate,
  }
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
  const { startYmd, endYmd } = ticketWindowForJob(jobType)
  const message = formatBorkRawSyncMessage({
    okCount,
    totalCreds: creds.length,
    syncOk,
    jobType,
    ticketsByDate: mergeTicketsByDate(locations),
    startYmd,
    endYmd,
  })

  // After sync completes, trigger V2 aggregation (register-day rollups from raw tickets)
  let v2AggregationResult: Awaited<ReturnType<typeof rebuildBorkSalesAggregationV2>> | null = null
  let v2RebuildSuffix = ''
  let v2CalendarStartYmd: string | null = null
  let v2CalendarEndYmd: string | null = null

  if (syncOk && jobType === 'daily-data') {
    try {
      const todayYmd = calendarYmdInAmsterdam(new Date())
      const yesterdayYmd = addCalendarDaysYmd(todayYmd, -1)
      v2RebuildSuffix = resolveBorkAggRebuildSuffix() ?? '_v2'
      v2CalendarStartYmd = yesterdayYmd
      v2CalendarEndYmd = todayYmd

      // For today (realtime): include open/unsettled tickets; for yesterday: closed/settled only
      v2AggregationResult = await rebuildBorkSalesAggregationV2(db, yesterdayYmd, todayYmd, v2RebuildSuffix, true)
    } catch (e) {
      console.error('[borkSyncService] Aggregation error:', e)
    }
  }

  let catalogSyncMessage = ''
  if (syncOk && jobType === 'master-data') {
    try {
      const yesterdayYmd = addCalendarDaysYmd(calendarYmdInAmsterdam(new Date()), -1)
      v2RebuildSuffix = resolveBorkAggRebuildSuffix() ?? '_v2'
      v2CalendarStartYmd = yesterdayYmd
      v2CalendarEndYmd = yesterdayYmd
      v2AggregationResult = await rebuildBorkSalesAggregationV2(db, yesterdayYmd, yesterdayYmd, v2RebuildSuffix)
    } catch (e) {
      console.error('[borkSyncService] Master V2 aggregation error:', e)
    }
    try {
      const catalog = await syncProductCatalogFromBorkApi(db)
      if (catalog.message) catalogSyncMessage = ` · ${catalog.message}`
    } catch (e) {
      console.error('[borkSyncService] product_catalog sync error:', e)
    }
  }

  if (syncOk && jobType === 'historical-data') {
    try {
      const todayYmd = calendarYmdInAmsterdam(new Date())
      const endStr = addCalendarDaysYmd(todayYmd, -1)
      const startStr = addCalendarDaysYmd(endStr, -(BORK_HISTORICAL_TICKET_DAYS - 1))
      v2RebuildSuffix = resolveBorkAggRebuildSuffix() ?? '_v2'
      v2CalendarStartYmd = startStr
      v2CalendarEndYmd = endStr
      v2AggregationResult = await rebuildBorkSalesAggregationV2(db, startStr, endStr, v2RebuildSuffix)
    } catch (e) {
      console.error('[borkSyncService] Historical V2 aggregation error:', e)
    }
  }

  const v2Message =
    v2AggregationResult && v2CalendarStartYmd && v2CalendarEndYmd
      ? formatV2RebuildMessage(
          v2AggregationResult,
          v2RebuildSuffix,
          v2CalendarStartYmd,
          v2CalendarEndYmd,
        )
      : ''

  const finalMessage = `${message}${v2Message}${catalogSyncMessage}`

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
