import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  const docs = await db.collection('inbox-bork-basis-report')
    .find({ cron_hour: 8 })
    .sort({ date: -1 })
    .limit(20)
    .toArray()
  
  console.log(`Recent cron_hour=8 reports:\n`)
  
  for (const doc of docs) {
    console.log(`ISO Date: ${doc.date}, Business Date: ${doc.business_date}, Location: ${doc.location}, Revenue: €${doc.final_revenue_ex_vat}`)
  }
  
} finally {
  await client.close()
}
