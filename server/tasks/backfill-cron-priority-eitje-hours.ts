/**
 * @task-id: backfill-cron-priority-eitje-hours
 * @description: Add cron_priority field to all existing inbox-eitje-hours documents
 * @run: MONGODB_URI=... node -r tsx ./server/tasks/backfill-cron-priority-eitje-hours.ts
 */

import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops'

async function backfillCronPriority() {
  const client = new MongoClient(MONGODB_URI)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('inbox-eitje-hours')
    
    console.log('[backfill-eitje] Starting cron_priority backfill for inbox-eitje-hours...')
    
    // Get all documents without cron_priority
    const docs = await collection
      .find({ cron_priority: { $exists: false } })
      .toArray()
    
    console.log(`[backfill-eitje] Found ${docs.length} documents without cron_priority`)
    
    if (docs.length === 0) {
      console.log('[backfill-eitje] No documents to update')
      return
    }
    
    // Prepare bulk operations
    const operations = docs.map(doc => ({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            cron_priority: calculateCronPriority(doc.cron_hour),
          },
        },
      },
    }))
    
    // Execute bulk write
    const result = await collection.bulkWrite(operations)
    
    console.log(`[backfill-eitje] Updated ${result.modifiedCount} documents`)
    console.log(`[backfill-eitje] Backfill complete`)
  } finally {
    await client.close()
  }
}

function calculateCronPriority(cronHour: number | undefined): number {
  if (cronHour === 7) return 3   // Final (next morning)
  if (cronHour === 23) return 2  // Night
  if (cronHour === 18) return 1  // Evening
  return 0                        // Other/Unknown
}

backfillCronPriority().catch(console.error)
