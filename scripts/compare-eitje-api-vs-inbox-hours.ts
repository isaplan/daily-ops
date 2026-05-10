/**
 * Compare labor hours for one calendar day (Amsterdam report date):
 * 1) Live Eitje API time_registration_shifts (legacy GET + JSON body)
 * 2) Mongo eitje_raw_data (last synced shifts for that Amsterdam day)
 * 3) Mongo inbox-eitje-hours (mapped inbox rows for reportDate)
 *
 * Usage:
 *   npx tsx scripts/compare-eitje-api-vs-inbox-hours.ts 2026-05-09
 *
 * Env: MONGODB_URI, MONGODB_DB_NAME, api_credentials with Eitje
 */
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import https from 'node:https'
import { URL } from 'node:url'
import { MongoClient } from 'mongodb'
import {
  loadActiveEitjeCredentials,
  eitjeCredentialsHintMessage,
} from '../server/services/eitjeSyncService.ts'
import { normalizeEitjeBaseUrl, legacyEitjeV2Headers } from '../server/services/eitjeOpenApiFetch.ts'

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

function num (v: unknown): number | undefined {
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Hours from a live API shift record */
function hoursLive (raw: Record<string, unknown>): number {
  let h = num(raw.hours) ?? num(raw.hours_worked) ?? num(raw.hoursWorked)
  if (h != null) return h
  const start = raw.start ?? raw.start_time
  const end = raw.end ?? raw.end_time
  const br = num(raw.break_minutes) ?? 0
  if (start != null && end != null) {
    const ms = new Date(String(end)).getTime() - new Date(String(start)).getTime()
    if (Number.isFinite(ms) && ms > 0) return ms / 3600000 - br / 60
  }
  return 0
}

/** Hours from eitje_raw_data doc shape */
function hoursRawDoc (doc: Record<string, unknown>): number {
  const ext = doc.extracted as Record<string, unknown> | undefined
  const r = doc.rawApiResponse as Record<string, unknown> | undefined
  let h =
    num(ext?.hours) ??
    num(ext?.hoursWorked) ??
    num(r?.hours) ??
    num(r?.hours_worked)
  if (h != null) return h
  const start = r?.start ?? r?.start_time
  const end = r?.end ?? r?.end_time
  const br = num(r?.break_minutes) ?? 0
  if (start != null && end != null) {
    const ms = new Date(String(end)).getTime() - new Date(String(start)).getTime()
    if (Number.isFinite(ms) && ms > 0) return ms / 3600000 - br / 60
  }
  return 0
}

/** Decimal hours from inbox row (mapped `hours` or parse uren string) */
function hoursInboxRow (row: Record<string, unknown>): number {
  const h = num(row.hours)
  if (h != null && h > 0) return h
  const uren = row.uren ?? row.Uren ?? row.UREN
  if (typeof uren === 'string' && /\d+:\d{2}/.test(uren)) {
    const m = /^(\d+):(\d{2})$/.exec(uren.trim())
    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  }
  return num(row.total_worked_hours) ?? 0
}

async function fetchLiveShiftsDay (
  baseUrl: string,
  headers: Record<string, string>,
  ymd: string
): Promise<{ records: Record<string, unknown>[]; status: number; error?: string }> {
  const base = normalizeEitjeBaseUrl(baseUrl).replace(/\/$/, '')
  const rawUrl = `${base}/time_registration_shifts`
  const body = JSON.stringify({
    filters: {
      start_date: ymd,
      end_date: ymd,
      date_filter_type: 'resource_date',
    },
  })

  return new Promise((resolvePromise) => {
    try {
      const url = new URL(rawUrl)
      const opts = {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Length': String(Buffer.byteLength(body, 'utf8')),
        },
        timeout: 45000,
      }
      const req = https.request(url, opts, (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          text += chunk
        })
        res.on('end', () => {
          let parsed: unknown = null
          try {
            parsed = text ? JSON.parse(text) : null
          } catch {
            parsed = text
          }
          const status = res.statusCode ?? 0
          if (status >= 200 && status < 300) {
            resolvePromise({ records: extractRecords(parsed), status })
          } else {
            resolvePromise({
              records: [],
              status,
              error: typeof parsed === 'string' ? parsed : JSON.stringify(parsed).slice(0, 400),
            })
          }
        })
      })
      req.on('timeout', () => req.destroy(new Error('timeout')))
      req.on('error', (e) =>
        resolvePromise({ records: [], status: 0, error: e instanceof Error ? e.message : String(e) })
      )
      req.write(body)
      req.end()
    } catch (e) {
      resolvePromise({ records: [], status: 0, error: e instanceof Error ? e.message : String(e) })
    }
  })
}

async function main () {
  loadDotEnv()
  const ymd = process.argv[2] ?? '2026-05-09'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    console.error('Usage: npx tsx scripts/compare-eitje-api-vs-inbox-hours.ts YYYY-MM-DD')
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI or MONGODB_DB_NAME')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const db = client.db(dbName)
    const creds = await loadActiveEitjeCredentials(db)
    if (!creds) {
      console.error(eitjeCredentialsHintMessage())
      process.exit(1)
    }

    console.log(`=== Eitje hours comparison for Amsterdam report date ${ymd} ===\n`)

    // --- 1) Live API ---
    const headers = legacyEitjeV2Headers(creds)
    const live = await fetchLiveShiftsDay(creds.baseUrl, headers, ymd)
    let apiSum = 0
    for (const r of live.records) apiSum += hoursLive(r)
    console.log('1) LIVE Eitje API (time_registration_shifts, resource_date window)')
    console.log(`   HTTP ${live.status}${live.error ? ` — ${live.error}` : ''}`)
    console.log(`   Shifts: ${live.records.length}  Total hours (sum): ${apiSum.toFixed(2)}\n`)

    // --- 2) Mongo raw (Amsterdam calendar day of stored shift date) ---
    const rawDocs = await db
      .collection('eitje_raw_data')
      .find({
        endpoint: 'time_registration_shifts',
        $expr: {
          $eq: [
            {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date',
                timezone: 'Europe/Amsterdam',
              },
            },
            ymd,
          ],
        },
      })
      .toArray()

    let rawSum = 0
    for (const d of rawDocs) rawSum += hoursRawDoc(d as Record<string, unknown>)
    console.log('2) Mongo eitje_raw_data (same Amsterdam calendar day on `date`)')
    console.log(`   Rows: ${rawDocs.length}  Total hours (sum): ${rawSum.toFixed(2)}\n`)

    // --- 3) inbox-eitje-hours (same filter as /api/inbox/eitje/hours?reportDate=) ---
    const inboxAgg = await db
      .collection('inbox-eitje-hours')
      .aggregate([
        {
          $match: {
            $expr: {
              $let: {
                vars: {
                  effectiveDate: {
                    $switch: {
                      branches: [
                        {
                          case: { $eq: [{ $type: '$date' }, 'date'] },
                          then: '$date',
                        },
                        {
                          case: { $eq: [{ $type: '$date' }, 'string'] },
                          then: {
                            $dateFromString: {
                              dateString: '$date',
                              format: '%d/%m/%Y',
                              timezone: 'Europe/Amsterdam',
                              onError: null,
                              onNull: null,
                            },
                          },
                        },
                      ],
                      default: {
                        $dateFromString: {
                          dateString: {
                            $trim: {
                              input: {
                                $toString: {
                                  $ifNull: ['$Date', { $ifNull: ['$Datum', ''] }],
                                },
                              },
                            },
                          },
                          format: '%d/%m/%Y',
                          timezone: 'Europe/Amsterdam',
                          onError: null,
                          onNull: null,
                        },
                      },
                    },
                  },
                },
                in: {
                  $and: [
                    { $ne: ['$$effectiveDate', null] },
                    {
                      $eq: [
                        {
                          $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$$effectiveDate',
                            timezone: 'Europe/Amsterdam',
                          },
                        },
                        ymd,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            n: { $sum: 1 },
            sumMappedHours: { $sum: { $ifNull: ['$hours', 0] } },
          },
        },
      ])
      .toArray()

    const inboxRow = inboxAgg[0] as { n?: number; sumMappedHours?: number } | undefined
    const inboxDocs = await db
      .collection('inbox-eitje-hours')
      .find({
        $expr: {
          $let: {
            vars: {
              effectiveDate: {
                $switch: {
                  branches: [
                    { case: { $eq: [{ $type: '$date' }, 'date'] }, then: '$date' },
                    {
                      case: { $eq: [{ $type: '$date' }, 'string'] },
                      then: {
                        $dateFromString: {
                          dateString: '$date',
                          format: '%d/%m/%Y',
                          timezone: 'Europe/Amsterdam',
                          onError: null,
                          onNull: null,
                        },
                      },
                    },
                  ],
                  default: {
                    $dateFromString: {
                      dateString: { $trim: { input: { $toString: { $ifNull: ['$Date', { $ifNull: ['$Datum', ''] }] } } } },
                      format: '%d/%m/%Y',
                      timezone: 'Europe/Amsterdam',
                      onError: null,
                      onNull: null,
                    },
                  },
                },
              },
            },
            in: {
              $and: [
                { $ne: ['$$effectiveDate', null] },
                {
                  $eq: [
                    { $dateToString: { format: '%Y-%m-%d', date: '$$effectiveDate', timezone: 'Europe/Amsterdam' } },
                    ymd,
                  ],
                },
              ],
            },
          },
        },
      })
      .toArray()

    let inboxSumJs = 0
    for (const d of inboxDocs) inboxSumJs += hoursInboxRow(d as Record<string, unknown>)

    console.log('3) Mongo inbox-eitje-hours (reportDate filter = Amsterdam YMD)')
    console.log(`   Rows: ${inboxDocs.length}  Sum $hours (aggregation): ${(inboxRow?.sumMappedHours ?? 0).toFixed(2)}`)
    console.log(`   Sum hours (row parser incl. uren fallback): ${inboxSumJs.toFixed(2)}\n`)

    console.log('--- Summary ---')
    console.log(
      `API ${apiSum.toFixed(2)} vs raw ${rawSum.toFixed(2)} vs inbox ${inboxSumJs.toFixed(2)} (mapped hours field: ${(inboxRow?.sumMappedHours ?? 0).toFixed(2)})`
    )
    const d1 = Math.abs(apiSum - rawSum)
    const d2 = Math.abs(apiSum - inboxSumJs)
    if (d1 > 0.5 || d2 > 0.5) {
      console.log(
        '\nNote: Differences are normal if inbox email is a different cut/export than API, or sync has not run for this day. Run Eitje sync for this date then re-check raw.'
      )
    }
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
