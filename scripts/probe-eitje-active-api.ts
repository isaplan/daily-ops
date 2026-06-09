/**
 * One-off probe: Eitje time_registration_shifts (wage_cost flag) + check-in endpoints.
 * Run: npx --yes tsx scripts/probe-eitje-active-api.ts
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { request as httpsRequest } from 'node:https'
import { MongoClient } from 'mongodb'
import { documentToEitjeStoredCredentials, findEitjeCredentialDocument } from '../server/utils/eitjeApiCredentials'
import { legacyEitjeV2Headers, normalizeEitjeBaseUrl } from '../server/services/eitjeOpenApiFetch'

for (const file of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), file)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

function extractRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    for (const v of Object.values(data as object)) {
      if (Array.isArray(v)) return v as Record<string, unknown>[]
    }
  }
  return []
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI || process.env.DATABASE_URL || '')
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || 'daily-ops-db')
  const row = await findEitjeCredentialDocument(db)
  if (!row) throw new Error('No Eitje credentials')
  const creds = documentToEitjeStoredCredentials(row)
  const base = normalizeEitjeBaseUrl(creds.baseUrl).replace(/\/$/, '')

  function fetchGetWithBody(path: string, body: Record<string, unknown>) {
    const url = new URL(`${base}/${path.replace(/^\//, '')}`)
    const payload = JSON.stringify(body)
    const headers = { ...legacyEitjeV2Headers(creds), 'Content-Length': String(Buffer.byteLength(payload)) }
    return new Promise<{ status: number; text: string }>((resolvePromise, reject) => {
      const req = httpsRequest(url, { method: 'GET', headers, timeout: 45000 }, (res) => {
        let text = ''
        res.on('data', (c) => { text += c })
        res.on('end', () => resolvePromise({ status: res.statusCode ?? 0, text }))
      })
      req.on('error', reject)
      req.on('timeout', () => req.destroy(new Error('timeout')))
      req.write(payload)
      req.end()
    })
  }

  function fetchGet(path: string) {
    const url = new URL(`${base}/${path.replace(/^\//, '')}`)
    return new Promise<{ status: number; text: string }>((resolvePromise, reject) => {
      const req = httpsRequest(url, { method: 'GET', headers: legacyEitjeV2Headers(creds), timeout: 45000 }, (res) => {
        let text = ''
        res.on('data', (c) => { text += c })
        res.on('end', () => resolvePromise({ status: res.statusCode ?? 0, text }))
      })
      req.on('error', reject)
      req.on('timeout', () => req.destroy(new Error('timeout')))
      req.end()
    })
  }

  const today = '2026-06-09'
  const yesterday = '2026-06-08'
  const now = Date.now()

  async function probeTimeReg(label: string, extra: Record<string, unknown> = {}) {
    const body = { filters: { start_date: yesterday, end_date: today, date_filter_type: 'resource_date', ...extra } }
    const res = await fetchGetWithBody('time_registration_shifts', body)
    const parsed = JSON.parse(res.text)
    const records = extractRecords(parsed)
    const todayRows = records.filter((r) => String(r.date) === today || String(r.start || '').startsWith(today))
    const summarize = (rows: Record<string, unknown>[]) => ({
      endNull: rows.filter((r) => r.end == null).length,
      endFuture: rows.filter((r) => r.end && new Date(String(r.end)).getTime() > now).length,
      endPast: rows.filter((r) => r.end && new Date(String(r.end)).getTime() <= now).length,
      withCheckInIds: rows.filter((r) => Array.isArray(r.check_in_ids) && (r.check_in_ids as unknown[]).length > 0).length,
      withWageCostField: rows.filter((r) => r.wage_cost != null || r.loaded_cost != null).length,
      names: rows.map((r) => (r.user as { name?: string })?.name),
    })
    console.log(`\n=== ${label} (HTTP ${res.status}) ===`)
    console.log(JSON.stringify({
      total: records.length,
      today: todayRows.length,
      ...summarize(todayRows),
      sampleToday: todayRows.map((r) => ({
        user: (r.user as { name?: string })?.name,
        team: (r.team as { name?: string })?.name,
        type: (r.type as { name?: string })?.name,
        start: r.start,
        end: r.end,
        check_in_ids: r.check_in_ids,
        wage_cost: r.wage_cost,
        loaded_cost: r.loaded_cost,
      })),
    }, null, 2))
  }

  await probeTimeReg('default (current sync body)')
  await probeTimeReg('wage_cost: true', { wage_cost: true })

  console.log('\n=== Check-in related endpoints (not in our sync) ===')
  for (const path of ['check_ins', 'checkins', 'time_registration_check_ins', 'clock_ins']) {
    for (const q of [`?start_date=${today}&end_date=${today}`, '']) {
      const res = await fetchGet(`${path}${q}`)
      let n = 0
      let snippet = ''
      try {
        const recs = extractRecords(JSON.parse(res.text))
        n = recs.length
        if (n > 0) snippet = JSON.stringify(recs[0], null, 2).slice(0, 500)
        else snippet = String(res.text).slice(0, 200)
      } catch {
        snippet = String(res.text).slice(0, 200)
      }
      console.log(`GET ${path}${q} -> ${res.status} records=${n}`)
      if (snippet) console.log(snippet)
    }
  }

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
