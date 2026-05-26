/**
 * Compare Eitje hours sources for one business_date (default: open register today).
 * Usage: npx tsx scripts/check-sunday-eitje-hours.ts [YYYY-MM-DD]
 */
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { MongoClient, ObjectId } from 'mongodb'
import { amsterdamOpenRegisterBusinessDateYmd } from '../utils/dailyOpsBusinessDate'

function loadDotEnv () {
  for (const file of ['.env.local', '.env', '.env.digitalocean.local']) {
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

const LOCS = [
  { id: '69d6cfa63d2adf93b79d1ae7', name: 'Van Kinsbergen' },
  { id: '69d6cfa63d2adf93b79d1ae6', name: 'Bar Bea' },
  { id: '69d6cfa73d2adf93b79d1ae8', name: "l'Amour Toujours" },
]

async function main () {
  loadDotEnv()
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) throw new Error('MONGODB_URI not set')
  const date = process.argv[2] ?? amsterdamOpenRegisterBusinessDateYmd()

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME ?? 'daily-ops-db')

  console.log(`\n=== Eitje hours audit: business_date=${date} ===\n`)

  console.log('inbox-eitje-hours (ISO date field — often empty; use audit-inbox script for Datum DD/MM):')
  for (const loc of LOCS) {
    const rows = await db.collection('inbox-eitje-hours').find({ date, location_id: loc.id }).toArray()
    const sum = rows.reduce((s, r) => s + Number(r.hours ?? 0), 0)
    console.log(`  ${loc.name}: ${rows.length} rows, ${sum.toFixed(2)} h`)
  }

  console.log('\neitje_time_registration_aggregation (period_type=day):')
  let aggTotal = 0
  for (const loc of LOCS) {
    const oid = new ObjectId(loc.id)
    const rows = await db
      .collection('eitje_time_registration_aggregation')
      .find({ period_type: 'day', period: date, locationId: { $in: [loc.id, oid] } })
      .toArray()
    const sumH = rows.reduce((s, r) => s + Number(r.hours ?? r.total_hours ?? 0), 0)
    aggTotal += sumH
    const updated = rows.map((r) => r.updatedAt ?? r.builtAt).filter(Boolean)
    const maxUp = updated.length ? new Date(Math.max(...updated.map((d) => new Date(d as Date).getTime()))).toISOString() : '—'
    console.log(`  ${loc.name}: ${rows.length} docs, ${sumH.toFixed(2)} h (last updated ${maxUp})`)
  }
  console.log(`  TOTAL agg: ${aggTotal.toFixed(2)} h`)

  console.log('\ndaily_ops_snapshot_section_labor:')
  for (const loc of LOCS) {
    const doc = await db.collection('daily_ops_snapshot_section_labor').findOne({
      businessDate: date,
      locationId: loc.id,
    })
    const hours = Number(doc?.totals?.hours ?? 0)
    const gew = Number(doc?.totals_gewerkt?.hours ?? 0)
    const workers = (doc?.workers as unknown[] | undefined)?.length ?? 0
    console.log(
      `  ${loc.name}: hours=${hours.toFixed(2)} gewerkt=${gew.toFixed(2)} workers=${workers}`,
    )
  }

  const raw24 = await db.collection('eitje_raw_data').countDocuments({
    dataType: 'time_registration_shifts',
    date,
  })
  const raw23 = await db.collection('eitje_raw_data').countDocuments({
    dataType: 'time_registration_shifts',
    date: '2026-05-23',
  })
  console.log(`\neitje_raw_data shifts (date=${date}): ${raw24} docs (Sat 2026-05-23: ${raw23})`)

  await client.close()
  console.log('\nTip: full inbox CSV rows use Datum DD/MM — run:')
  console.log(`  npx tsx scripts/audit-inbox-eitje-hours-by-location-team.ts ${date}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
