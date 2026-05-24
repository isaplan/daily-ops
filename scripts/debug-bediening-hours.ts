/**
 * Inspect eitje agg team names vs gewerkt keuken/bediening split for a business date.
 * Usage: npx tsx scripts/debug-bediening-hours.ts [YYYY-MM-DD]
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

function loadEnvFile(p: string) {
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

async function run() {
  loadEnvFile(resolve(process.cwd(), '.env'))
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  if (!uri) throw new Error('MONGODB_URI missing')
  const date = process.argv[2] ?? '2026-05-18'

  const c = new MongoClient(uri)
  await c.connect()
  const db = c.db(dbName)

  const locs = [
    { id: '69d6cfa63d2adf93b79d1ae7', name: 'Van Kinsbergen' },
    { id: '69d6cfa63d2adf93b79d1ae6', name: 'Bar Bea' },
    { id: '69d6cfa73d2adf93b79d1ae8', name: "l'Amour Toujours" },
  ]

  for (const loc of locs) {
    const rows = await db
      .collection('eitje_time_registration_aggregation')
      .find({ period_type: 'day', period: date, locationId: loc.id })
      .toArray()

    const teams = new Map<string, { hours: number; count: number; hasGewerkt: boolean }>()
    for (const r of rows) {
      const tn = String(r.team_name ?? '')
      const t = teams.get(tn) ?? { hours: 0, count: 0, hasGewerkt: false }
      t.hours += Number(r.total_hours ?? 0)
      t.count++
      if (typeof r.gewerkt_hours === 'number') t.hasGewerkt = true
      teams.set(tn, t)
    }

    console.log(`\n=== ${loc.name} · ${date} · ${rows.length} agg rows ===`)
    for (const [name, v] of [...teams.entries()].sort((a, b) => b[1].hours - a[1].hours)) {
      const n = name.trim().toLowerCase()
      const bucket =
        n === 'keuken' ? 'keuken' : n === 'bediening' ? 'bediening' : n === 'afwas' ? 'afwas' : 'OTHER→ignored'
      console.log(
        `  ${JSON.stringify(name).padEnd(28)} h=${v.hours.toFixed(2).padStart(7)} bucket=${bucket}`,
      )
    }

    const snap = await db.collection('daily_ops_snapshot_section_labor').findOne({
      businessDate: date,
      locationId: loc.id,
    })
    if (snap) {
      console.log('  snapshot teams:')
      for (const t of snap.teams ?? []) {
        console.log(`    ${JSON.stringify(t.teamName)} h=${Number(t.hours).toFixed(2)}`)
      }
      console.log(`  snapshot operational?: ${snap.operational ? 'yes' : 'no'}`)
    }
  }

  await c.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
