/**
 * scripts/test-eitje-rebuild-day.ts
 *
 * Test the updated rebuildEitjeTimeRegistrationAggregation for a single day,
 * then dump the resulting rows for Van Kinsbergen so we can compare cost_per_hour /
 * total_cost_loaded vs the Eitje UI numbers.
 */

import { MongoClient } from 'mongodb'
import { rebuildEitjeTimeRegistrationAggregation } from '../server/services/eitjeRebuildAggregationService'

const BD = '2026-05-12'
const LOC = '69d6cfa63d2adf93b79d1ae7'

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  console.log(`Rebuilding eitje aggregation for ${BD}…`)
  const t0 = Date.now()
  const r = await rebuildEitjeTimeRegistrationAggregation(db, BD, BD)
  console.log(`Done in ${Date.now() - t0}ms — deletedPeriods=${r.deletedPeriods} inserted=${r.inserted}`)

  const rows = await db
    .collection('eitje_time_registration_aggregation')
    .find({ period: BD, locationId: LOC })
    .toArray()

  console.log(`\nKinsbergen ${BD} rows: ${rows.length}`)
  console.log(
    'team'.padEnd(15),
    'user'.padEnd(28),
    'hours'.padStart(7),
    'rate'.padStart(7),
    'cph'.padStart(7),
    'total_cost'.padStart(11),
    'total_loaded'.padStart(13),
    'source'
  )
  let totHours = 0
  let totWage = 0
  let totLoaded = 0
  const teams: Record<string, { h: number; wage: number; loaded: number }> = {}
  for (const r of rows) {
    const h = Number(r.total_hours ?? 0)
    const rate = r.hourly_rate
    const cph = r.cost_per_hour
    const wage = Number(r.total_cost ?? 0)
    const loaded = Number(r.total_cost_loaded ?? 0)
    const team = String(r.team_name ?? '—')
    console.log(
      team.padEnd(15),
      String(r.user_name).slice(0, 28).padEnd(28),
      h.toFixed(2).padStart(7),
      (rate == null ? '—' : Number(rate).toFixed(2)).padStart(7),
      (cph == null ? '—' : Number(cph).toFixed(2)).padStart(7),
      wage.toFixed(2).padStart(11),
      loaded.toFixed(2).padStart(13),
      String(r.loaded_cost_source ?? '')
    )
    totHours += h
    totWage += wage
    totLoaded += loaded
    if (!teams[team]) teams[team] = { h: 0, wage: 0, loaded: 0 }
    teams[team]!.h += h
    teams[team]!.wage += wage
    teams[team]!.loaded += loaded
  }

  console.log(`\nTotals: hours=${totHours.toFixed(2)} wage=${totWage.toFixed(2)} loaded=${totLoaded.toFixed(2)}`)
  console.log('Per team:')
  for (const t of Object.keys(teams)) {
    const x = teams[t]!
    console.log(`  ${t.padEnd(15)} h=${x.h.toFixed(2).padStart(6)} wage=${x.wage.toFixed(2).padStart(9)} loaded=${x.loaded.toFixed(2).padStart(9)}`)
  }

  console.log('\nEitje UI target (per user):')
  console.log('  Total:     hours=51.17 loaded=1129.00')
  console.log('  Bediening: hours=25.42 loaded= 531.00')
  console.log('  Keuken:    hours=25.00 loaded= 598.00')

  await c.close()
}

run().catch((e) => { console.error(e); process.exit(1) })
