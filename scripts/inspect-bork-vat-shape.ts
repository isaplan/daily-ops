/**
 * Verify VAT fields are present on rebuilt rollups (Phase 0 sanity check).
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

  console.log('\n=== bork_business_days for 2026-05-11 (Phase 0 verification) ===')
  const days = await db
    .collection('bork_business_days')
    .find({ business_date: '2026-05-11' })
    .toArray()
  for (const d of days) {
    const inc = Number(d.total_revenue_inc_vat ?? 0)
    const ex = Number(d.total_revenue_ex_vat ?? 0)
    const vat = Number(d.total_vat ?? 0)
    console.log({
      business_date: d.business_date,
      locationName: d.locationName,
      total_revenue: d.total_revenue,
      total_revenue_ex_vat: ex,
      total_revenue_inc_vat: inc,
      total_vat: vat,
      consistency_delta: (inc - (ex + vat)).toFixed(4),
    })
  }

  console.log('\n=== bork_sales_by_hour for 2026-05-11 (first 3) ===')
  const hours = await db
    .collection('bork_sales_by_hour')
    .find({ business_date: '2026-05-11' })
    .limit(3)
    .toArray()
  for (const h of hours) {
    console.log({
      business_date: h.business_date,
      business_hour: h.business_hour,
      locationName: h.locationName,
      total_revenue: h.total_revenue,
      total_revenue_ex_vat: h.total_revenue_ex_vat,
      total_vat: h.total_vat,
    })
  }

  console.log('\n=== bork_sales_by_day (workers_day[0]) for 2026-05-11 ===')
  const days2 = await db
    .collection('bork_sales_by_day')
    .find({ business_date: '2026-05-11' })
    .limit(1)
    .toArray()
  for (const d of days2) {
    const w = (d.workers_day ?? [])[0]
    const p = (d.products_day ?? [])[0]
    console.log({
      locationName: d.locationName,
      first_worker: w,
      first_product: p,
    })
  }

  await client.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
