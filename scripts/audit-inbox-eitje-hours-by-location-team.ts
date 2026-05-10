/**
 * Aggregate inbox-eitje-hours for one Amsterdam report day by location + team.
 *
 * Usage: npx tsx scripts/audit-inbox-eitje-hours-by-location-team.ts 2026-05-08
 */
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { MongoClient } from 'mongodb'

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

function toHhMm (decimalHours: number): string {
  const sign = decimalHours < 0 ? '-' : ''
  const h = Math.abs(decimalHours)
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  const m = mins === 60 ? 0 : mins
  const w = mins === 60 ? whole + 1 : whole
  return `${sign}${w}:${String(m).padStart(2, '0')}`
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

async function main () {
  loadDotEnv()
  const ymd = process.argv[2] || '2026-05-08'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    console.error('Usage: npx tsx scripts/audit-inbox-eitje-hours-by-location-team.ts YYYY-MM-DD')
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const baseMatch = reportDateExpr(ymd)

  const byLocTeam = await db
    .collection('inbox-eitje-hours')
    .aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: {
            loc: { $ifNull: ['$location_name', ''] },
            team: { $ifNull: ['$team_name', ''] },
            type: { $ifNull: ['$shift_type', ''] },
          },
          hours: { $sum: { $ifNull: ['$hours', 0] } },
          rows: { $sum: 1 },
        },
      },
      { $sort: { '_id.loc': 1, '_id.team': 1 } },
    ])
    .toArray()

  const byLoc = await db
    .collection('inbox-eitje-hours')
    .aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: { $ifNull: ['$location_name', ''] },
          hours: { $sum: { $ifNull: ['$hours', 0] } },
          rows: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  console.log(`\n=== inbox-eitje-hours  reportDate=${ymd} (Europe/Amsterdam) ===\n`)
  console.log('By location (all teams / types):')
  for (const r of byLoc) {
    const h = r.hours as number
    console.log(`  ${String(r._id || '(empty)')}: ${h.toFixed(2)} h  (${toHhMm(h)})  rows=${r.rows}`)
  }

  console.log('\nBy location + team + shift_type:')
  for (const r of byLocTeam) {
    const id = r._id as { loc?: string; team?: string; type?: string }
    const h = r.hours as number
    console.log(
      `  ${id.loc} | team=${id.team} | type=${id.type} → ${h.toFixed(2)} h (${toHhMm(h)}) rows=${r.rows}`,
    )
  }

  // Bediening + Keuken only (case-insensitive contains)
  const bedKeuk = await db
    .collection('inbox-eitje-hours')
    .aggregate([
      { $match: baseMatch },
      {
        $match: {
          $or: [
            { team_name: { $regex: /^bediening$/i } },
            { team_name: { $regex: /^keuken$/i } },
          ],
        },
      },
      {
        $group: {
          _id: {
            loc: { $ifNull: ['$location_name', ''] },
            team: { $ifNull: ['$team_name', ''] },
          },
          hours: { $sum: { $ifNull: ['$hours', 0] } },
        },
      },
      { $sort: { '_id.loc': 1, '_id.team': 1 } },
    ])
    .toArray()

  console.log('\nSubset: team_name is exactly Bediening or Keuken (regex ^...$):')
  for (const r of bedKeuk) {
    const id = r._id as { loc?: string; team?: string }
    const h = r.hours as number
    console.log(`  ${id.loc} | ${id.team} → ${h.toFixed(2)} h (${toHhMm(h)})`)
  }

  // Parsed email that contains this business date in rows (datum DD/MM/YYYY)
  const [dd, mm, yyyy] = ymd.split('-').reverse()
  const dutchDatum = `${dd}/${mm}/${yyyy}`
  const parsedForDay = await db
    .collection('parseddatas')
    .find({
      documentType: 'hours',
      'data.rows': {
        $elemMatch: {
          $or: [
            { datum: dutchDatum },
            { Datum: dutchDatum },
            { datum: { $regex: `^0?${parseInt(dd, 10)}/0?${parseInt(mm, 10)}/${yyyy}$` } },
          ],
        },
      },
    })
    .project({ _id: 1, emailId: 1, attachmentId: 1, created_at: 1, extractedAt: 1 })
    .sort({ created_at: -1 })
    .limit(5)
    .toArray()

  console.log(`\nRecent parseddatas (hours) mentioning datum ${dutchDatum} (up to 5):`)
  for (const p of parsedForDay) {
    console.log(
      `  parsedId=${p._id} emailId=${p.emailId} attachmentId=${p.attachmentId} created_at=${p.created_at}`,
    )
  }

  const totalRows = await db.collection('inbox-eitje-hours').countDocuments(baseMatch)
  console.log(`\nTotal matching rows in inbox-eitje-hours: ${totalRows}\n`)

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
