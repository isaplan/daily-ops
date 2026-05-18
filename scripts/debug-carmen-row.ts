import { MongoClient } from 'mongodb'

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  // Inspect Carmen's contract row
  const carmen = await db.collection('inbox-eitje-contracts').findOne({ employee_name: { $regex: /carmen/i } })
  console.log('Carmen contract row keys:', carmen ? Object.keys(carmen) : '—')
  console.log('cph field in doc?', carmen && 'cost_per_hour' in carmen, 'value=', carmen?.cost_per_hour)
  console.log('Full doc:', JSON.stringify(carmen, null, 2))

  // Inspect Carmen's eitje agg row
  const row = await db.collection('eitje_time_registration_aggregation').findOne({
    period: '2026-05-12', locationId: '69d6cfa63d2adf93b79d1ae7', user_name: { $regex: /carmen/i },
  })
  console.log('\nCarmen agg row:', JSON.stringify(row, null, 2))

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
