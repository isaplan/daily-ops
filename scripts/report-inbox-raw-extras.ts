/**
 * For a report date + location: list inbox rows, raw rows, raw-only (extra) rows, aggregation count by shift id.
 * Usage: npx tsx scripts/report-inbox-raw-extras.ts .env.digitalocean.local
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

function hoursRaw (r: Record<string, unknown>): number {
  let h = num(r.hours) ?? num(r.hours_worked)
  if (h != null) return h
  const start = r.start
  const end = r.end
  const br = num(r.break_minutes) ?? 0
  if (start != null && end != null) {
    const ms = new Date(String(end)).getTime() - new Date(String(start)).getTime()
    if (Number.isFinite(ms) && ms > 0) return ms / 3600000 - br / 60
  }
  return 0
}

function escapeRegex (s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
                    input: { $toString: { $ifNull: ['$Date', { $ifNull: ['$Datum', ''] }] } },
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
              { $dateToString: { format: '%Y-%m-%d', date: '$$effectiveDate', timezone: 'Europe/Amsterdam' } },
              ymd,
            ],
          },
        ],
      },
    },
  },
})

function inboxLoc (loc: string) {
  const esc = escapeRegex(loc.trim())
  return { location_name: { $regex: `^\\s*${esc}\\s*$`, $options: 'i' } }
}

function rawLoc (loc: string) {
  const esc = escapeRegex(loc.trim())
  const rx = { $regex: `^\\s*${esc}\\s*$`, $options: 'i' }
  return {
    $or: [
      { 'rawApiResponse.environment.name': rx },
      { 'rawApiResponse.location_name': rx },
      { 'rawApiResponse.environment_name': rx },
    ],
  }
}

void (async () => {
  const envPath = resolve(process.argv[2] ?? '.env.digitalocean.local')
  loadEnv(envPath)
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) throw new Error('no uri')
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')

  const blocks = [
    { ymd: '2026-05-07', loc: 'Bar Bea' },
    { ymd: '2026-05-07', loc: "L'amour Toujours" },
    { ymd: '2026-05-08', loc: 'Bar Bea' },
    { ymd: '2026-05-08', loc: "L'amour Toujours" },
  ]

  for (const b of blocks) {
    const inboxRows = await db
      .collection('inbox-eitje-hours')
      .find({ $and: [reportDateExpr(b.ymd), inboxLoc(b.loc)] })
      .project({ employee_name: 1, team_name: 1, shift_type: 1, hours: 1, support_id: 1 })
      .sort({ employee_name: 1, team_name: 1 })
      .toArray()

    const rawDocs = await db
      .collection('eitje_raw_data')
      .find({
        endpoint: 'time_registration_shifts',
        'rawApiResponse.date': b.ymd,
        ...rawLoc(b.loc),
      })
      .toArray()

    const inboxIds = inboxRows
      .map((r) => String((r as { support_id?: unknown }).support_id ?? '').trim())
      .filter((s) => s && s !== '__none__')

    const inboxIdSet = new Map<string, number>()
    for (const id of inboxIds) inboxIdSet.set(id, (inboxIdSet.get(id) ?? 0) + 1)

    const extras: { id: string; worker: string; team: string; type: string; h: number; start: string }[] = []
    for (const d of rawDocs) {
      const r = d.rawApiResponse as Record<string, unknown>
      const id = r.id != null ? String(r.id) : ''
      const cnt = inboxIdSet.get(id) ?? 0
      if (cnt > 0) {
        inboxIdSet.set(id, cnt - 1)
        continue
      }
      const u = r.user as { name?: string } | undefined
      const team = r.team as { name?: string } | undefined
      const ty = r.type as { name?: string } | undefined
      extras.push({
        id,
        worker: u?.name ?? '?',
        team: team?.name ?? '?',
        type: ty?.name ?? '?',
        h: Math.round(hoursRaw(r) * 100) / 100,
        start: String(r.start ?? ''),
      })
    }

    console.log(`\n=== ${b.ymd} ${b.loc} ===`)
    console.log(`inbox rows: ${inboxRows.length} | raw rows (resourceDate+loc): ${rawDocs.length} | raw-only (no inbox id match): ${extras.length}`)

    if (extras.length > 0) {
      console.log('RAW ONLY (extra vs inbox id multiset):')
      for (const e of extras) {
        console.log(`  id=${e.id} ${e.worker} | ${e.team} | ${e.type} | ${e.h}h | start=${e.start}`)
      }
    }

    const locRx =
      b.loc.toLowerCase().includes('amour') ? /l['’]?amour/i : new RegExp(`^\\s*${escapeRegex(b.loc)}\\s*$`, 'i')
    const aggByPeriod = await db.collection('eitje_time_registration_aggregation').countDocuments({
      period_type: 'day',
      period: b.ymd,
      location_name: locRx,
    })
    console.log(`aggregation day rows period=${b.ymd} location≈${b.loc}: ${aggByPeriod}`)
  }

  console.log('\n=== André Rozhok 2026-05-07 Bar Bea (inbox) ===')
  const andre = await db
    .collection('inbox-eitje-hours')
    .find({
      $and: [
        reportDateExpr('2026-05-07'),
        inboxLoc('Bar Bea'),
        { employee_name: { $regex: 'André', $options: 'i' } },
      ],
    })
    .project({ employee_name: 1, team_name: 1, shift_type: 1, support_id: 1, hours: 1 })
    .toArray()
  console.log(JSON.stringify(andre, null, 2))

  await client.close()
})()
