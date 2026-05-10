import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  const docs = await db.collection('inbox-bork-basis-report')
    .find({ cron_hour: 8 })
    .toArray()
  
  console.log(`Found ${docs.length} documents with cron_hour = 8\n`)
  
  // Check what cron hours exist
  const cronHours = await db.collection('inbox-bork-basis-report')
    .aggregate([
      { $group: { _id: '$cron_hour', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
    .toArray()
  
  console.log('All cron_hour values in collection:')
  for (const doc of cronHours) {
    console.log(`  cron_hour ${doc._id}: ${doc.count} reports`)
  }
  
} finally {
  await client.close()
}
