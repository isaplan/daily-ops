import { MongoClient } from 'mongodb'
import 'dotenv/config'

const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017')
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops')
  
  console.log('Basis reports for 2026-05-07 (yesterday):')
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ date: '2026-05-07' })
    .toArray()
  
  console.log(`Found ${reports.length} reports\n`)
  for (const r of reports) {
    console.log(`- ${r.location} (location_id: ${r.location_id}) => €${r.final_revenue_ex_vat}`)
  }
  
  console.log('\n\nGrouping by normalized location:')
  const byLoc = {}
  for (const r of reports) {
    const norm = r.location.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!byLoc[norm]) byLoc[norm] = []
    byLoc[norm].push(r)
  }
  
  for (const [norm, list] of Object.entries(byLoc)) {
    const total = list.reduce((s, r) => s + (r.final_revenue_ex_vat || 0), 0)
    console.log(`\n"${norm}": ${list.length} reports, total €${total}`)
    for (const r of list) {
      console.log(`  - location_id: ${r.location_id}, business_hour: ${r.business_hour}, cron_hour: ${r.cron_hour}, €${r.final_revenue_ex_vat}`)
    }
  }
  
} finally {
  await client.close()
}
