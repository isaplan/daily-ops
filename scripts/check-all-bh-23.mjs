import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  const docs = await db.collection('inbox-bork-basis-report')
    .find({ business_date: '2026-05-07', business_hour: 23 })
    .sort({ location: 1, date: -1, cron_hour: -1 })
    .toArray()
  
  console.log(`All business_hour=23 reports for business day 2026-05-07:\n`)
  
  for (const doc of docs) {
    console.log(`${doc.location} (ISO ${doc.date}, Cron ${doc.cron_hour}): €${doc.final_revenue_ex_vat}`)
  }
  
} finally {
  await client.close()
}
