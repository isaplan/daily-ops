import { MongoClient } from 'mongodb'

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  // List all distinct date string prefixes (handle 274 vs 9166 mystery)
  const allDates = await db.collection('inbox-eitje-hours').distinct('date')
  console.log(`distinct date values: ${allDates.length}`)
  console.log('first 5:', allDates.slice(0, 5))
  console.log('last 5:', allDates.slice(-5))

  // Field types distribution
  const sampleNoDate = await db.collection('inbox-eitje-hours').findOne({ date: { $exists: false } })
  console.log('\nDoc with no date field (if any):', sampleNoDate ? JSON.stringify(sampleNoDate, null, 2).slice(0, 600) : 'NONE')

  // Try May 12 in different storage formats
  const tries = [
    { label: 'date=2026-05-12', q: { date: '2026-05-12' } },
    { label: 'date prefix regex', q: { date: { $regex: /^2026-05-1[12]/ } } },
    { label: 'date as Date object range', q: { date: { $gte: new Date('2026-05-11T22:00:00Z'), $lt: new Date('2026-05-12T22:00:00Z') } } },
    { label: 'date string T22:00 Z', q: { date: '2026-05-11T22:00:00.000Z' } },
    { label: 'date string starts 2026-05-11', q: { date: { $regex: '^2026-05-11' } } },
  ]
  for (const t of tries) {
    const cnt = await db.collection('inbox-eitje-hours').countDocuments(t.q as any).catch((e) => `ERR: ${e.message}`)
    console.log(`${t.label}: ${cnt}`)
  }

  // Show ALL Kinsbergen rows with date around may 11/12
  const kins = await db.collection('inbox-eitje-hours').find({
    location_name: 'Van Kinsbergen',
  }).limit(60).toArray()
  console.log(`\nVan Kinsbergen rows (all): ${kins.length}`)
  for (const r of kins.slice(0, 25)) {
    console.log(`  date=${String(r.date)} team=${r.team_name} emp=${r.employee_name} h=${r.hours} cph=${r.cost_per_hour} rate=${r.hourly_rate} realized=${r.realized_labor_costs} cron=${r.cron_hour}`)
  }

  // Total kins count
  const kinsTotal = await db.collection('inbox-eitje-hours').countDocuments({ location_name: 'Van Kinsbergen' })
  console.log(`Total Van Kinsbergen rows in inbox-eitje-hours: ${kinsTotal}`)

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
