/**
 * Compare inbox-eitje-hours to Mongo eitje_raw_data time_registration_shifts
 * by report date + location name. Lists each inbox row with no matching raw shift.
 *
 * Match: (1) Eitje shift id `rawApiResponse.id` vs inbox `support_id`;
 *        (2) else worker name + team + shift type on remaining raw rows.
 *
 * Raw filter: `rawApiResponse.date` (resource date) + environment / location name.
 *
 * Usage: npx tsx scripts/diff-inbox-eitje-hours-vs-raw.ts [.env.digitalocean.local]
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

function loadEnv (p: string) {
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

function num (v: unknown): number | undefined {
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

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

function escapeRegex (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Amsterdam report-day match on inbox rows (same as audit-inbox-eitje-hours-by-location-team). */
const reportDateExpr = (ymd: string) => ({
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
})

function inboxLocationMatch (locDisplayName: string) {
  const esc = escapeRegex(locDisplayName.trim())
  return { location_name: { $regex: `^\\s*${esc}\\s*$`, $options: 'i' } }
}

function rawLocationMatch (locDisplayName: string) {
  const esc = escapeRegex(locDisplayName.trim())
  const rx = { $regex: `^\\s*${esc}\\s*$`, $options: 'i' }
  return {
    $or: [
      { 'rawApiResponse.environment.name': rx },
      { 'rawApiResponse.location_name': rx },
      { 'rawApiResponse.environment_name': rx },
    ],
  }
}

function normWorker (s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\s*\|[^|]*$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normToken (s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim()
}

function rawApi (doc: Record<string, unknown>): Record<string, unknown> {
  return (doc.rawApiResponse as Record<string, unknown> | undefined) ?? {}
}

function rawShiftId (r: Record<string, unknown>): string {
  const id = r.id ?? r.support_id
  return id != null && String(id).trim() !== '' ? String(id) : ''
}

function rawWorkerFromApi (r: Record<string, unknown>): string {
  const u = r.user
  if (u && typeof u === 'object' && u !== null && 'name' in u) return normWorker((u as { name: unknown }).name)
  return ''
}

function rawTeamFromApi (r: Record<string, unknown>): string {
  const t = r.team
  if (t && typeof t === 'object' && t !== null && 'name' in t) return normToken((t as { name: unknown }).name)
  return ''
}

function rawTypeFromApi (r: Record<string, unknown>): string {
  const ty = r.type
  if (ty && typeof ty === 'object' && ty !== null && 'name' in ty) return normToken((ty as { name: unknown }).name)
  return ''
}

type InboxDoc = {
  employee_name?: unknown
  team_name?: unknown
  shift_type?: unknown
  hours?: unknown
  support_id?: unknown
}

function inboxHours (row: InboxDoc): number {
  const h = num(row.hours)
  return h ?? 0
}

/** Returns inbox rows that have no counterpart in raw (after id match, then name+team+type). */
function inboxRowsMissingFromRaw (
  inboxRows: InboxDoc[],
  rawDocs: Record<string, unknown>[],
): InboxDoc[] {
  type Pool = { doc: Record<string, unknown>; r: Record<string, unknown> }
  const pool: Pool[] = rawDocs.map((doc) => ({ doc, r: rawApi(doc) }))

  const takeByIndex = (idx: number) => pool.splice(idx, 1)[0]

  const missing: InboxDoc[] = []

  for (const row of inboxRows) {
    const sid = String(row.support_id ?? '').trim()
    let idx = -1
    if (sid && sid !== '__none__') {
      idx = pool.findIndex((p) => rawShiftId(p.r) === sid)
    }
    if (idx >= 0) {
      takeByIndex(idx)
      continue
    }
    const w = normWorker(row.employee_name)
    const t = normToken(row.team_name)
    const ty = normToken(row.shift_type)
    idx = pool.findIndex(
      (p) =>
        rawWorkerFromApi(p.r) === w &&
        rawTeamFromApi(p.r) === t &&
        rawTypeFromApi(p.r) === ty,
    )
    if (idx >= 0) {
      takeByIndex(idx)
      continue
    }
    missing.push(row)
  }

  return missing
}

void (async () => {
  const envPath = resolve(process.argv[2] ?? '.env.digitalocean.local')
  loadEnv(envPath)
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI
  if (!uri) throw new Error('Set DATABASE_URL or MONGODB_URI in env file')

  const blocks: { label: string; ymd: string; location: string }[] = [
    { label: '2026-05-07 Bar Bea', ymd: '2026-05-07', location: 'Bar Bea' },
    { label: "2026-05-07 L'amour Toujours", ymd: '2026-05-07', location: "L'amour Toujours" },
    { label: '2026-05-08 Bar Bea', ymd: '2026-05-08', location: 'Bar Bea' },
    { label: "2026-05-08 L'amour Toujours", ymd: '2026-05-08', location: "L'amour Toujours" },
  ]

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')
  const inboxCol = db.collection('inbox-eitje-hours')
  const rawCol = db.collection('eitje_raw_data')

  const rows: {
    label: string
    inboxHours: number
    inboxRows: number
    rawHours: number
    rawRows: number
    deltaHours: number
  }[] = []

  const missingTable: {
    reportYmd: string
    location: string
    worker: string
    team: string
    shiftType: string
    hoursInbox: number
    shiftIdInbox: string
  }[] = []

  for (const b of blocks) {
    const inboxMatch = { $and: [reportDateExpr(b.ymd), inboxLocationMatch(b.location)] }
    const inboxRows = (await inboxCol
      .find(inboxMatch)
      .project({
        employee_name: 1,
        team_name: 1,
        shift_type: 1,
        hours: 1,
        support_id: 1,
      })
      .sort({ employee_name: 1, team_name: 1, shift_type: 1 })
      .toArray()) as InboxDoc[]

    const inboxAgg = await inboxCol
      .aggregate([
        { $match: inboxMatch },
        { $group: { _id: null, sum: { $sum: { $ifNull: ['$hours', 0] } }, n: { $sum: 1 } } },
      ])
      .toArray()
    const inboxSum = (inboxAgg[0]?.sum as number | undefined) ?? 0
    const inboxN = (inboxAgg[0]?.n as number | undefined) ?? 0

    const rawFilter = {
      endpoint: 'time_registration_shifts',
      'rawApiResponse.date': b.ymd,
      ...rawLocationMatch(b.location),
    }
    const rawDocs = (await rawCol.find(rawFilter).toArray()) as Record<string, unknown>[]
    let rawSum = 0
    for (const d of rawDocs) rawSum += hoursRawDoc(d)

    rows.push({
      label: b.label,
      inboxHours: Math.round(inboxSum * 100) / 100,
      inboxRows: inboxN,
      rawHours: Math.round(rawSum * 100) / 100,
      rawRows: rawDocs.length,
      deltaHours: Math.round((inboxSum - rawSum) * 100) / 100,
    })

    const missing = inboxRowsMissingFromRaw(inboxRows, rawDocs)
    for (const m of missing) {
      const sid = String(m.support_id ?? '').trim()
      missingTable.push({
        reportYmd: b.ymd,
        location: b.location,
        worker: String(m.employee_name ?? ''),
        team: String(m.team_name ?? ''),
        shiftType: String(m.shift_type ?? ''),
        hoursInbox: Math.round(inboxHours(m) * 100) / 100,
        shiftIdInbox: sid && sid !== '__none__' ? sid : '—',
      })
    }
  }

  await client.close()

  console.log(JSON.stringify({ source: 'inbox-eitje-hours vs eitje_raw_data', rows }, null, 2))
  console.log('\n| Report day + location | Inbox rows | Inbox h | Raw rows | Raw h | Inbox − raw (h) |')
  console.log('|---|---:|---:|---:|---:|---:|')
  for (const r of rows) {
    console.log(
      `| ${r.label} | ${r.inboxRows} | ${r.inboxHours} | ${r.rawRows} | ${r.rawHours} | ${r.deltaHours} |`,
    )
  }

  const sumMissingH = missingTable.reduce((a, r) => a + r.hoursInbox, 0)
  console.log(
    `\n### Inbox rows with no matching time_registration in Mongo (${missingTable.length} rows, ${Math.round(sumMissingH * 100) / 100} h)\n`,
  )
  console.log('| Report date | Location | Worker | Team | Shift type | Hours (inbox) | Shift id (inbox) |')
  console.log('|---|---|---|---|---:|---:|---|')
  for (const r of missingTable) {
    console.log(
      `| ${r.reportYmd} | ${r.location} | ${r.worker} | ${r.team} | ${r.shiftType} | ${r.hoursInbox} | ${r.shiftIdInbox} |`,
    )
  }
})()
