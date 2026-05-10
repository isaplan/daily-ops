import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // Check bork_business_days collection for May 7
  const docs = await db.collection('bork_business_days_v2')
    .find({ business_date: '2026-05-07' })
    .sort({ locationId: 1 })
    .toArray()
  
  console.log(`Bork business days for 2026-05-07:\n`)
  
  let total = 0
  for (const doc of docs) {
    console.log(`Location: ${doc.location_name || doc.locationId}`)
    console.log(`  total_revenue: €${doc.total_revenue}`)
    console.log(`  Fields: ${Object.keys(doc).filter(k => k.includes('vat') || k.includes('tax') || k.includes('rev')).join(', ')}`)
    console.log()
    total += Number(doc.total_revenue || 0)
  }
  
  console.log(`Total: €${total.toFixed(2)}`)
  
} finally {
  await client.close()
}
