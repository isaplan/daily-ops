import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ date: '2026-05-07' })
    .toArray()
  
  console.log('Checking business_date field:\n')
  
  for (const r of reports.slice(0, 3)) {
    console.log(`Location: ${r.location}`)
    console.log(`  date (ISO): ${r.date}`)
    console.log(`  business_date: ${r.business_date}`)
    console.log(`  cron_hour: ${r.cron_hour}`)
    console.log(`  received: ${r.received_at}\n`)
  }
  
} finally {
  await client.close()
}
