import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // Check ISO date May 8
  const docs = await db.collection('inbox-bork-basis-report')
    .find({ date: '2026-05-08', cron_hour: 8 })
    .toArray()
  
  console.log(`ISO Date 2026-05-08, cron_hour=8:\n`)
  
  let total = 0
  for (const doc of docs) {
    console.log(`Location: ${doc.location}, Business Date: ${doc.business_date}, Revenue: €${doc.final_revenue_ex_vat}`)
    total += Number(doc.final_revenue_ex_vat || 0)
  }
  
  console.log(`\nTotal: €${total.toFixed(2)}`)
  
} finally {
  await client.close()
}
