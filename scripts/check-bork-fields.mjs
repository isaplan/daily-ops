import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // Check one document to see all fields
  const doc = await db.collection('bork_business_days_v2')
    .findOne({ business_date: '2026-05-07' })
  
  console.log('Fields in bork_business_days_v2 document:')
  console.log(JSON.stringify(doc, null, 2).slice(0, 2000))
  
} finally {
  await client.close()
}
