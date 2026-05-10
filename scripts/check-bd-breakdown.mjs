import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // Check the range for "yesterday" from dashboard
  // Dashboard shows "Yesterday: Thursday 7 May 2026 (UTC)"
  // That's ISO date 2026-05-07
  
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ date: { $gte: '2026-05-07', $lte: '2026-05-07' } })
    .toArray()
  
  console.log(`Reports with ISO date 2026-05-07:\n`)
  
  const byBD = {}
  for (const r of reports) {
    const bd = r.business_date || 'unknown'
    if (!byBD[bd]) byBD[bd] = []
    byBD[bd].push(r)
  }
  
  for (const [bd, docs] of Object.entries(byBD).sort()) {
    const total = docs.reduce((s, d) => s + (Number(d.final_revenue_ex_vat || 0)), 0)
    console.log(`Business date: ${bd}`)
    console.log(`  Count: ${docs.length}`)
    console.log(`  Total: €${total.toFixed(2)}`)
    console.log()
  }
  
} finally {
  await client.close()
}
