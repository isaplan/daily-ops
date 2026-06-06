import { MongoClient, ObjectId } from 'mongodb'
import 'dotenv/config'

const uri = process.env.MONGODB_URI
const client = new MongoClient(uri)
const today = '2026-06-06'

const locs = [
  { id: '69d6cfa63d2adf93b79d1ae7', name: 'Van Kinsbergen' },
  { id: '69d6cfa63d2adf93b79d1b0a', name: 'Bar Bea' },
  { id: '69d6cfa63d2adf93b79d1b1d', name: "l'Amour Toujours" },
]

try {
  await client.connect()
  const db = client.db()

  console.log(`\n=== TODAY ${today} ===\n`)

  for (const loc of locs) {
    const oid = new ObjectId(loc.id)
    console.log(`\n--- ${loc.name} ---`)

    for (const suffix of ['', '_v2']) {
      const coll = `bork_business_days${suffix}`
      const doc = await db.collection(coll).findOne({
        business_date: today,
        locationId: oid,
      })
      if (doc) {
        console.log(`${coll}:`)
        console.log(`  ex_vat: €${Number(doc.total_revenue_ex_vat ?? 0).toFixed(2)}`)
        console.log(`  inc_vat: €${Number(doc.total_revenue_inc_vat ?? doc.total_revenue ?? 0).toFixed(2)}`)
        console.log(`  _id time: ${doc._id?.getTimestamp?.()?.toISOString?.() ?? '?'}`)
      } else {
        console.log(`${coll}: (no doc)`)
      }
    }

    const snap = await db.collection('daily_ops_snapshot_section_revenue').findOne({
      businessDate: today,
      locationId: loc.id,
    })
    if (snap) {
      console.log(`snapshot:`)
      console.log(`  ex_vat: €${Number(snap.totals?.ex_vat ?? 0).toFixed(2)}`)
      console.log(`  inc_vat: €${Number(snap.totals?.inc_vat ?? 0).toFixed(2)}`)
      console.log(`  lastBuiltAt: ${snap.lastBuiltAt?.toISOString?.() ?? '?'}`)
    } else {
      console.log(`snapshot: (no doc)`)
    }
  }
} finally {
  await client.close()
}
