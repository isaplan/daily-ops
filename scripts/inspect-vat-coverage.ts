import { MongoClient } from 'mongodb'
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  const total = await db.collection('bork_business_days').countDocuments({})
  const withVat = await db.collection('bork_business_days').countDocuments({ total_revenue_ex_vat: { $exists: true } })
  const missing = total - withVat

  const first = await db.collection('bork_business_days').find({}).sort({ business_date: 1 }).limit(1).project({ business_date: 1 }).toArray()
  const last = await db.collection('bork_business_days').find({}).sort({ business_date: -1 }).limit(1).project({ business_date: 1 }).toArray()
  const oldestWithVat = await db.collection('bork_business_days').find({ total_revenue_ex_vat: { $exists: true } }).sort({ business_date: 1 }).limit(1).project({ business_date: 1 }).toArray()

  console.log({
    total_docs: total,
    with_vat_fields: withVat,
    missing_vat_fields: missing,
    full_date_range: { from: first[0]?.business_date, to: last[0]?.business_date },
    backfilled_so_far: oldestWithVat[0]?.business_date,
  })

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
