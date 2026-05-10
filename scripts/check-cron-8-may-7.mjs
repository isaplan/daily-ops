import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  const docs = await db.collection('inbox-bork-basis-report')
    .find({ cron_hour: 8, business_date: '2026-05-07' })
    .toArray()
  
  console.log(`Cron 8 reports for business day 2026-05-07:\n`)
  
  let total = 0
  for (const doc of docs) {
    console.log(`${doc.location}: €${doc.final_revenue_ex_vat}`)
    total += Number(doc.final_revenue_ex_vat || 0)
  }
  
  console.log(`\nTotal: €${total.toFixed(2)}`)
  
} finally {
  await client.close()
}
