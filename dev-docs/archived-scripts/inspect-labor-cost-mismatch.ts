/**
 * Diagnose labor cost discrepancy for Kinsbergen 2026-05-12.
 * Compares: Eitje row fields (hourly_rate, total_cost, total_hours, cost_per_hour-if-any)
 *          vs members.cost_per_hour coverage
 *          vs snapshot loaded calculation.
 */
import { MongoClient } from 'mongodb'

const BD = '2026-05-12'
const LOC = '69d6cfa63d2adf93b79d1ae7' // Van Kinsbergen unifiedLocationId

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  // 1. Pull Eitje rows
  const rows = await db
    .collection('eitje_time_registration_aggregation')
    .find({ period: BD, locationId: LOC })
    .toArray()
  console.log(`\nEitje rows for ${BD} @ ${LOC}: ${rows.length}`)
  if (rows[0]) console.log(`Sample row keys: ${Object.keys(rows[0]).join(', ')}`)

  // 2. Inspect each row + member cost coverage
  const userIds = Array.from(new Set(rows.map((r) => String(r.userId ?? '')))).filter(Boolean)
  const members = await db
    .collection('members')
    .find({ $or: [{ eitje_id: { $in: userIds } }, { eitje_ids: { $in: userIds } }] })
    .project({ eitje_id: 1, eitje_ids: 1, cost_per_hour: 1, hourly_wage: 1, first_name: 1, last_name: 1, name: 1 })
    .toArray()
  console.log(`\nMembers matched: ${members.length}/${userIds.length} userIds`)

  const memberByEitje = new Map<string, any>()
  for (const m of members) {
    const ids = [m.eitje_id, ...((m.eitje_ids as string[] | undefined) ?? [])].filter(Boolean).map(String)
    for (const id of ids) memberByEitje.set(id, m)
  }

  console.log('\nPer-row breakdown:')
  console.log(
    'team'.padEnd(15),
    'user'.padEnd(28),
    'hours'.padStart(7),
    'rate'.padStart(7),
    'eitje_cost'.padStart(11),
    'cph(member)'.padStart(12),
    'loaded(cph*h)'.padStart(14),
    'loaded(1.36)'.padStart(13)
  )
  let totWage = 0
  let totLoaded = 0
  let totHours = 0
  let withCph = 0
  let withoutCph = 0
  const teamWage: Record<string, number> = {}
  const teamLoaded: Record<string, number> = {}
  const teamHours: Record<string, number> = {}
  for (const r of rows) {
    const hours = Number(r.total_hours ?? 0)
    const rate = Number(r.hourly_rate ?? 0)
    const cost = Number(r.total_cost ?? 0)
    const uid = String(r.userId ?? '')
    const m = memberByEitje.get(uid)
    const cph = m?.cost_per_hour ?? null
    const team = String(r.team_name ?? '')
    const userLabel = m ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || (m.name ?? uid) : (r.user_name ?? uid)
    const loadedTrue = cph != null ? cph * hours : 0
    const loadedFallback = rate * 1.36 * hours
    console.log(
      team.padEnd(15),
      String(userLabel).slice(0, 28).padEnd(28),
      hours.toFixed(2).padStart(7),
      rate.toFixed(2).padStart(7),
      cost.toFixed(2).padStart(11),
      (cph?.toFixed(2) ?? '—').padStart(12),
      loadedTrue.toFixed(2).padStart(14),
      loadedFallback.toFixed(2).padStart(13)
    )
    totWage += cost
    totLoaded += cph != null ? loadedTrue : loadedFallback
    totHours += hours
    if (cph != null) withCph++
    else withoutCph++
    teamWage[team] = (teamWage[team] ?? 0) + cost
    teamLoaded[team] = (teamLoaded[team] ?? 0) + (cph != null ? loadedTrue : loadedFallback)
    teamHours[team] = (teamHours[team] ?? 0) + hours
  }

  console.log('\nTotals:')
  console.log(`  hours: ${totHours.toFixed(2)}`)
  console.log(`  wage (Σ total_cost): ${totWage.toFixed(2)}`)
  console.log(`  loaded (cph or 1.36): ${totLoaded.toFixed(2)}`)
  console.log(`  members WITH cost_per_hour: ${withCph}`)
  console.log(`  members WITHOUT cost_per_hour: ${withoutCph}`)

  console.log('\nPer team:')
  for (const team of Object.keys(teamHours)) {
    console.log(
      `  ${team.padEnd(15)} hours=${teamHours[team]!.toFixed(2).padStart(6)} wage=${teamWage[team]!.toFixed(2).padStart(9)} loaded=${teamLoaded[team]!.toFixed(2).padStart(9)}`
    )
  }

  // 3. Compare to Eitje user-reported totals from user message
  console.log('\nUser-reported (Eitje UI) for 2026-05-12 Van Kinsbergen:')
  console.log('  Total:      hours=51.17  labor=1129.00')
  console.log('  Bediening:  hours=25.42  labor= 531.00')
  console.log('  Keuken:     hours=25.00  labor= 598.00')

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
