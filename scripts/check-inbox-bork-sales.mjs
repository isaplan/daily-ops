import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  const count = await db.collection('inbox-bork-sales').countDocuments({})
  console.log(`Total documents in inbox-bork-sales: ${count}\n`)
  
  // Get summary by date
  const byDate = await db.collection('inbox-bork-sales')
    .aggregate([
      { $group: { _id: '$date', count: { $sum: 1 }, total: { $sum: '$finalRevenueExVat' } } },
      { $sort: { _id: -1 } },
      { $limit: 5 }
    ])
    .toArray()
  
  console.log('Recent dates:')
  for (const doc of byDate) {
    console.log(`  ${doc._id}: ${doc.count} docs, €${(doc.total || 0).toFixed(2)}`)
  }
  
} finally {
  await client.close()
}
