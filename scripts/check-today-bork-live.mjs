import { MongoClient, ObjectId } from 'mongodb'
import 'dotenv/config'

const uri = process.env.MONGODB_URI
const client = new MongoClient(uri)
const today = '2026-06-06'

const locs = [
  { id: '69d6cfa63d2adf93b79d1ae7', name: 'Van Kinsbergen' },
  { id: '69d6cfa63d2adf93b79d1ae6', name: 'Bar Bea' },
  { id: '69d6cfa73d2adf93b79d1ae8', name: "l'Amour Toujours" },
]

try {
  await client.connect()
  const db = client.db()

  for (const loc of locs) {
    const oid = new ObjectId(loc.id)
    console.log(`\n=== ${loc.name} ===`)

    const day = await db.collection('bork_business_days_v2').findOne({
      business_date: today,
      locationId: oid,
    })
    if (day) {
      console.log(`bork_business_days_v2 @ ${day._id.getTimestamp().toISOString()}`)
      console.log(`  ex: €${Number(day.total_revenue_ex_vat ?? 0).toFixed(2)}`)
      console.log(`  inc: €${Number(day.total_revenue_inc_vat ?? day.total_revenue ?? 0).toFixed(2)}`)
    } else {
      console.log('bork_business_days_v2: MISSING')
    }

    const hourly = await db.collection('bork_sales_by_hour_v2').aggregate([
      { $match: { business_date: today, locationId: oid } },
      {
        $group: {
          _id: null,
          ex: { $sum: { $ifNull: ['$total_revenue_ex_vat', '$total_revenue'] } },
          inc: { $sum: { $ifNull: ['$total_revenue_inc_vat', '$total_revenue'] } },
          hours: { $sum: 1 },
          latest: { $max: '$_id' },
        },
      },
    ]).toArray()

    const h = hourly[0]
    if (h) {
      console.log(`bork_sales_by_hour_v2 sum (${h.hours} hour rows, latest _id ${h.latest?.getTimestamp?.()?.toISOString?.()})`)
      console.log(`  ex: €${Number(h.ex).toFixed(2)}`)
      console.log(`  inc: €${Number(h.inc).toFixed(2)}`)
    } else {
      console.log('bork_sales_by_hour_v2: no rows')
    }
  }

  // Last sync job?
  const syncLog = await db.collection('bork_sync_logs')
    .find({})
    .sort({ _id: -1 })
    .limit(3)
    .toArray()
  console.log('\n=== Recent bork sync logs ===')
  for (const s of syncLog) {
    console.log(`${s._id.getTimestamp().toISOString()} job=${s.jobType ?? s.job_type} ok=${s.success ?? s.ok}`)
  }
} finally {
  await client.close()
}
