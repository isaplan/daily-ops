import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // Simulate yesterday = May 7
  const startDate = '2026-05-07'
  const endDate = '2026-05-07'
  
  const query = {
    business_date: { $gte: startDate, $lte: endDate }
  }
  
  console.log('Query:', JSON.stringify(query, null, 2))
  
  const docs = await db.collection('inbox-bork-basis-report')
    .find(query)
    .toArray()
  
  console.log(`\nFound ${docs.length} documents\n`)
  
  for (const doc of docs) {
    console.log(`${doc.location} (ISO ${doc.date}, Cron ${doc.cron_hour}): €${doc.final_revenue_ex_vat}`)
  }
  
} finally {
  await client.close()
}
