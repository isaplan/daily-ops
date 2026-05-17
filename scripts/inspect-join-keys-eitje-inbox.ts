/**
 * Live inspection of join keys between:
 *  - eitje_time_registration_aggregation (.user_name, .team_name, .period, .total_hours)
 *  - inbox-eitje-hours (.employee_name, .team_name, .date, .hours, .cost_per_hour, .realized_labor_costs, .cron_priority, .cron_hour)
 *  - inbox-eitje-contracts (.employee_name, .support_id, .cost_per_hour, .hourly_rate)
 *  - members (.name / .support_id / .eitje_id / .eitje_ids)
 *  - eitje_raw_data (rawApiResponse.employee_name | .user.name)
 *
 * Goal: confirm the canonical join is by normalized employee_name (lowercase, trim, collapse spaces).
 */
import { MongoClient } from 'mongodb'

const BD = '2026-05-12'

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  // 1) cron_priority distribution in inbox-eitje-hours
  const cronAgg = await db.collection('inbox-eitje-hours').aggregate([
    { $group: { _id: { cron_priority: '$cron_priority', cron_hour: '$cron_hour' }, n: { $sum: 1 } } },
    { $sort: { '_id.cron_priority': 1, '_id.cron_hour': 1 } },
  ]).toArray()
  console.log('cron_priority x cron_hour distribution:')
  for (const r of cronAgg) console.log(`  prio=${r._id.cron_priority} hour=${r._id.cron_hour} → ${r.n}`)

  // 2) For Kinsbergen 2026-05-12 — show every inbox-eitje-hours row
  const start = new Date('2026-05-11T22:00:00Z')
  const end = new Date('2026-05-12T22:00:00Z')
  const kinsHours = await db.collection('inbox-eitje-hours').find({
    location_name: 'Van Kinsbergen',
    date: { $gte: start, $lt: end },
  }).toArray()
  console.log(`\nKinsbergen 2026-05-12 inbox-eitje-hours: ${kinsHours.length} rows`)
  for (const r of kinsHours) {
    console.log(`  cron=${r.cron_hour} prio=${r.cron_priority ?? '-'} | ${String(r.team_name).padEnd(12)} | ${String(r.employee_name).padEnd(28)} h=${String(r.hours).padStart(5)} cph=${String(r.cost_per_hour).padStart(6)} rate=${String(r.hourly_rate).padStart(6)} realized=${String(r.realized_labor_costs).padStart(7)}`)
  }

  // 3) Eitje aggregation rows for same key
  const aggRows = await db.collection('eitje_time_registration_aggregation').find({
    period: BD, locationId: '69d6cfa63d2adf93b79d1ae7',
  }).toArray()
  console.log(`\neitje_time_registration_aggregation Kinsbergen ${BD}: ${aggRows.length}`)
  for (const r of aggRows) {
    console.log(`  ${String(r.team_name).padEnd(12)} | ${String(r.user_name).padEnd(28)} h=${String(r.total_hours).padStart(5)} rate=${String(r.hourly_rate).padStart(6)} total_cost=${String(r.total_cost).padStart(7)}`)
  }

  // 4) Cross-join by normalized employee_name (lower) ↔ user_name to verify match rate
  const aggNames = new Set(aggRows.map((r) => norm(r.user_name)))
  const inboxNames = new Set(kinsHours.map((r) => norm(r.employee_name)))
  const onlyAgg = [...aggNames].filter((n) => !inboxNames.has(n))
  const onlyInbox = [...inboxNames].filter((n) => !aggNames.has(n))
  const both = [...aggNames].filter((n) => inboxNames.has(n))
  console.log(`\nName overlap (normalized):`)
  console.log(`  in both: ${both.length} — ${both.join(' | ')}`)
  console.log(`  only in agg: ${onlyAgg.length} — ${onlyAgg.join(' | ')}`)
  console.log(`  only in inbox: ${onlyInbox.length} — ${onlyInbox.join(' | ')}`)

  // 5) inbox-eitje-contracts: scan all Kinsbergen workers
  const contracts = await db.collection('inbox-eitje-contracts').find({
    employee_name: { $in: aggRows.map((r) => r.user_name as string).filter(Boolean) },
  }).toArray()
  console.log(`\ninbox-eitje-contracts matches for these workers: ${contracts.length}`)
  for (const c2 of contracts) {
    console.log(`  ${String(c2.employee_name).padEnd(28)} cph=${c2.cost_per_hour} rate=${c2.hourly_rate} contract=${c2.contract_type}`)
  }

  // Try case-insensitive lookup for any non-matches
  const missing = aggRows.filter((r) => !contracts.find((cc) => cc.employee_name === r.user_name))
  if (missing.length) {
    console.log(`\nWorkers with no exact-name contract match (${missing.length}):`)
    for (const m of missing) console.log(`  ${m.user_name}`)
    // case-insensitive try
    for (const m of missing) {
      const hit = await db.collection('inbox-eitje-contracts').findOne({ employee_name: { $regex: `^${(m.user_name as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })
      console.log(`  case-insensitive ${m.user_name}: ${hit ? `cph=${hit.cost_per_hour}` : 'NOT FOUND'}`)
    }
  }

  // 6) check eitje_raw_data: what does employee_name actually look like in shifts (this determines the agg's user_name)
  const sampleShift = await db.collection('eitje_raw_data').findOne({ endpoint: 'time_registration_shifts' })
  if (sampleShift) {
    const employee = (sampleShift as any).rawApiResponse?.employee_name ?? (sampleShift as any).rawApiResponse?.user?.name
    console.log(`\nSample shift employee_name in raw_data: "${employee}"`)
  }

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
