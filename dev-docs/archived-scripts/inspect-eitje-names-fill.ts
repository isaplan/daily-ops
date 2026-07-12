import { MongoClient } from 'mongodb'
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)
  const total = await db.collection('eitje_time_registration_aggregation').countDocuments({ period: '2026-05-12' })
  const missingTeam = await db.collection('eitje_time_registration_aggregation').countDocuments({ period: '2026-05-12', $or: [{ team_name: null }, { team_name: '' }, { team_name: { $exists: false } }] })
  const missingUser = await db.collection('eitje_time_registration_aggregation').countDocuments({ period: '2026-05-12', $or: [{ user_name: null }, { user_name: '' }, { user_name: { $exists: false } }] })
  const missingLoc = await db.collection('eitje_time_registration_aggregation').countDocuments({ period: '2026-05-12', $or: [{ location_name: null }, { location_name: '' }, { location_name: { $exists: false } }] })
  console.log({ total, missingTeam, missingUser, missingLoc })
  const sample = await db.collection('eitje_time_registration_aggregation').findOne({ period: '2026-05-12' })
  console.log('sample row:', sample)
  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
