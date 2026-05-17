import { MongoClient } from 'mongodb'
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  // inbox-eitje-contracts
  const contractsTotal = await db.collection('inbox-eitje-contracts').countDocuments({})
  const contractSample = await db.collection('inbox-eitje-contracts').findOne({})
  console.log('--- inbox-eitje-contracts ---')
  console.log(`total=${contractsTotal}`)
  console.log('keys:', contractSample ? Object.keys(contractSample).join(', ') : '—')
  if (contractSample) console.log('sample:', JSON.stringify(contractSample, null, 2).slice(0, 1200))

  // inbox-eitje-hours: filter to 2026-05-12 Kinsbergen
  const hoursTotal = await db.collection('inbox-eitje-hours').countDocuments({})
  const hoursSample = await db.collection('inbox-eitje-hours').findOne({})
  console.log('\n--- inbox-eitje-hours ---')
  console.log(`total=${hoursTotal}`)
  console.log('keys:', hoursSample ? Object.keys(hoursSample).join(', ') : '—')
  if (hoursSample) console.log('sample:', JSON.stringify(hoursSample, null, 2).slice(0, 1500))

  // distinct date/location fields in inbox-eitje-hours
  const distFields = ['date', 'business_date', 'period', 'work_date', 'shift_date', 'location_id', 'locationId', 'location_name']
  for (const f of distFields) {
    const c1 = await db.collection('inbox-eitje-hours').countDocuments({ [f]: { $exists: true } })
    if (c1 > 0) console.log(`  field ${f}: ${c1} docs`)
  }

  // Find a 2026-05-12 row by any plausible date field
  const trial1 = await db.collection('inbox-eitje-hours').findOne({ date: '2026-05-12' })
  if (trial1) {
    console.log('\nHours row by date=2026-05-12:', JSON.stringify(trial1, null, 2).slice(0, 1500))
  }
  const trial2 = await db.collection('inbox-eitje-hours').findOne({ business_date: '2026-05-12' })
  if (trial2) console.log('\nHours row by business_date=2026-05-12:', JSON.stringify(trial2, null, 2).slice(0, 1500))

  // Try yesterday Kinsbergen — count rows
  const kinsbergenRows = await db.collection('inbox-eitje-hours').countDocuments({
    $or: [{ date: '2026-05-12' }, { business_date: '2026-05-12' }],
    $and: [
      {
        $or: [
          { location_name: { $regex: /kinsbergen/i } },
          { location: { $regex: /kinsbergen/i } },
        ],
      },
    ],
  }).catch(() => 0)
  console.log(`\nKinsbergen rows on 2026-05-12: ${kinsbergenRows}`)

  // Distinct locations in inbox-eitje-hours
  const locs = await db.collection('inbox-eitje-hours').distinct('location_name')
  console.log('Distinct location_name in inbox-eitje-hours:', locs.slice(0, 20))

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
