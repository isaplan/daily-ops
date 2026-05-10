import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // Find cron 7 reports for business day May 7
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ cron_hour: 7, date: '2026-05-08' })
    .toArray()
  
  console.log(`Found ${reports.length} cron 7 (07:00) reports on ISO date May 8\n`)
  
  for (const r of reports) {
    console.log(`${r.location}:`)
    console.log(`  date (ISO): ${r.date}`)
    console.log(`  business_date: ${r.business_date}`)
    console.log(`  cron_hour: ${r.cron_hour}`)
    console.log(`  revenue: €${r.final_revenue_ex_vat}`)
    console.log()
  }
  
} finally {
  await client.close()
}
