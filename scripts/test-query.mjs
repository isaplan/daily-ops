import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ business_date: { $gte: '2026-05-07', $lte: '2026-05-07' } })
    .toArray()
  
  console.log(`Found ${reports.length} reports for business_date 2026-05-07\n`)
  
  let total = 0
  for (const r of reports) {
    console.log(`${r.location} - cron ${r.cron_hour}: €${r.final_revenue_ex_vat}`)
    total += Number(r.final_revenue_ex_vat)
  }
  
  console.log(`\nRaw sum (all documents): €${total.toFixed(2)}`)
  
  // Now apply pickBasisReportsPerLocation logic
  const byLoc = {}
  for (const r of reports) {
    if (!byLoc[r.location]) byLoc[r.location] = []
    byLoc[r.location].push(r)
  }
  
  let finalTotal = 0
  for (const [loc, docs] of Object.entries(byLoc)) {
    const sorted = docs.sort((a, b) => (b.cron_hour ?? -1) - (a.cron_hour ?? -1))
    const final = sorted[0]
    console.log(`\n${loc}: pick cron ${final.cron_hour} = €${final.final_revenue_ex_vat}`)
    finalTotal += Number(final.final_revenue_ex_vat)
  }
  
  console.log(`\nFinal total (after picking highest cron_hour per location): €${finalTotal.toFixed(2)}`)
  
} finally {
  await client.close()
}
