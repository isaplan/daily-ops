import { MongoClient } from 'mongodb'
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)
  const m = await db.collection('daily_ops_snapshot').findOne({ businessDate: '2026-05-11', locationId: '69d6cfa63d2adf93b79d1ae7' })
  console.log('MASTER:', JSON.stringify(m, null, 2))
  const lab = await db.collection('daily_ops_snapshot_section_labor').findOne({ businessDate: '2026-05-11', locationId: '69d6cfa63d2adf93b79d1ae7' })
  console.log('\nLABOR teams:', lab?.teams)
  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
