/**
 * scripts/verify-kins-may12-labor.ts
 * Pull the labor snapshot for Van Kinsbergen 2026-05-12 and print team totals + workers.
 */
import { MongoClient } from 'mongodb'

const BD = '2026-05-12'
const LOC = '69d6cfa63d2adf93b79d1ae7'

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  const doc = await db.collection('daily_ops_snapshot_section_labor').findOne({ businessDate: BD, locationId: LOC })
  if (!doc) {
    console.log('No labor section found for ' + BD + ' Kinsbergen')
    await c.close()
    return
  }

  console.log(`\nLocation: ${doc.locationName}  Date: ${doc.businessDate}`)
  console.log(`Totals: hours=${doc.totals.hours.toFixed(2)} wage=${doc.totals.wage_cost.toFixed(2)} loaded=${doc.totals.loaded_cost.toFixed(2)}`)

  console.log(`\nTeams (sorted by loaded_cost):`)
  for (const t of doc.teams) {
    console.log(`  ${String(t.teamName).padEnd(15)} h=${t.hours.toFixed(2).padStart(6)} wage=${t.wage_cost.toFixed(2).padStart(8)} loaded=${t.loaded_cost.toFixed(2).padStart(8)}`)
  }

  console.log(`\nWorkers (top by loaded_cost):`)
  for (const w of doc.workers.slice(0, 12)) {
    console.log(`  ${String(w.userName).padEnd(28)} team=${String(w.teamName).padEnd(12)} h=${w.hours.toFixed(2).padStart(6)} rate=${String(w.hourly_rate ?? '—').padStart(6)} cph=${String(w.cost_per_hour ?? '—').padStart(7)} wage=${w.wage_cost.toFixed(2).padStart(7)} loaded=${w.loaded_cost.toFixed(2).padStart(7)} ${w.loaded_cost_fallback ? '(fb)' : ''}`)
  }

  console.log(`\nEitje UI target:`)
  console.log(`  Bediening + Keuken: hours=51.17 loaded=1129.00`)
  console.log(`  Bediening:          hours=25.42 loaded= 531.00`)
  console.log(`  Keuken:             hours=25.00 loaded= 598.00`)

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
