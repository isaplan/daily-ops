import { MongoClient } from 'mongodb'
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)
  const d = await db.collection('bork_business_days').findOne({ business_date: '2026-05-11' })
  console.log('bork_business_days.locationId:', typeof d?.locationId, '|', d?.locationId?.constructor?.name, '|', String(d?.locationId))
  const e = await db.collection('eitje_time_registration_aggregation').findOne({ period: '2026-05-12' })
  console.log('eitje.locationId:', typeof e?.locationId, '|', e?.locationId?.constructor?.name, '|', String(e?.locationId))
  console.log('eitje.teamId:', typeof e?.teamId, '|', e?.teamId?.constructor?.name, '|', String(e?.teamId))
  console.log('eitje.userId:', typeof e?.userId, '|', e?.userId?.constructor?.name, '|', String(e?.userId))
  const i = await db.collection('inbox-bork-basis-report').findOne({ business_date: '2026-05-11' })
  console.log('inbox.location_id:', typeof i?.location_id, '|', i?.location_id?.constructor?.name, '|', String(i?.location_id))
  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
