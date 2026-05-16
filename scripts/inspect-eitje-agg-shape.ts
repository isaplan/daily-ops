/**
 * One-off live shape inspection for eitje_time_registration_aggregation + inbox basis report.
 */
import { MongoClient } from 'mongodb'
const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB_NAME ?? 'daily-ops-db'
if (!URI) {
  console.error('MONGODB_URI not set')
  process.exit(1)
}

async function run() {
  const client = new MongoClient(URI!)
  await client.connect()
  const db = client.db(DB)

  console.log('=== eitje_time_registration_aggregation: 3 newest docs ===')
  const eitje = await db
    .collection('eitje_time_registration_aggregation')
    .find({})
    .sort({ period: -1 })
    .limit(3)
    .toArray()
  for (const d of eitje) {
    console.log({
      keys: Object.keys(d),
      period: d.period,
      locationId: d.locationId?.toString?.(),
      locationName: d.locationName,
      teamId: d.teamId,
      teamName: d.teamName,
      userId: d.userId?.toString?.(),
      userName: d.userName,
      hours: d.hours,
      hourly_rate: d.hourly_rate,
      cost_per_hour: d.cost_per_hour,
      total_cost: d.total_cost,
    })
  }

  console.log('\n=== inbox-bork-basis-report: 2 newest ===')
  const inbox = await db
    .collection('inbox-bork-basis-report')
    .find({})
    .sort({ business_date: -1, cron_hour: -1 })
    .limit(2)
    .toArray()
  for (const d of inbox) {
    console.log({
      keys: Object.keys(d),
      business_date: d.business_date,
      locationName: d.locationName,
      cron_hour: d.cron_hour,
      total_revenue: d.total_revenue,
      total_revenue_ex_vat: d.total_revenue_ex_vat ?? '(missing)',
      total_revenue_inc_vat: d.total_revenue_inc_vat ?? '(missing)',
      parsed_at: d.parsed_at,
    })
  }

  console.log('\n=== bork_sales_by_hour: structure ===')
  const hr = await db.collection('bork_sales_by_hour').findOne({ business_date: '2026-05-11' })
  if (hr) console.log({ keys: Object.keys(hr), sample: hr })

  await client.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
