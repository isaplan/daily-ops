import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // All reports for business day May 7 with business_hour
  const docs = await db.collection('inbox-bork-basis-report')
    .find({ business_date: '2026-05-07' })
    .sort({ business_hour: -1 })
    .toArray()
  
  console.log(`Business day 2026-05-07 (sorted by business_hour DESC):\n`)
  
  const byLocation = {}
  for (const doc of docs) {
    const loc = doc.location
    if (!byLocation[loc]) byLocation[loc] = []
    byLocation[loc].push(doc)
  }
  
  for (const [loc, reports] of Object.entries(byLocation)) {
    console.log(`\n${loc}:`)
    for (const r of reports) {
      console.log(`  ISO ${r.date}, Cron ${r.cron_hour}, Business Hour ${r.business_hour}: €${r.final_revenue_ex_vat}`)
    }
  }
  
} finally {
  await client.close()
}
