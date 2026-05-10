/**
 * One-off: set cron_priority on inbox-eitje-hours where missing.
 *
 * Lives under scripts/ so Nitro does not import it on every dev startup.
 *
 * @run: pnpm run backfill:cron-priority-eitje-hours
 */

import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops'

function calculateCronPriority (cronHour: number | undefined): number {
  if (cronHour === 7) return 3
  if (cronHour === 23) return 2
  if (cronHour === 18) return 1
  return 0
}

export async function runBackfillCronPriorityEitjeHours () {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('inbox-eitje-hours')

    console.log('[backfill-eitje] Starting cron_priority backfill for inbox-eitje-hours...')

    const docs = await collection
      .find({ cron_priority: { $exists: false } })
      .toArray()

    console.log(`[backfill-eitje] Found ${docs.length} documents without cron_priority`)

    if (docs.length === 0) {
      console.log('[backfill-eitje] No documents to update')
      return
    }

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

    const result = await collection.bulkWrite(operations)

    console.log(`[backfill-eitje] Updated ${result.modifiedCount} documents`)
    console.log('[backfill-eitje] Backfill complete')
  } finally {
    await client.close()
  }
}

void runBackfillCronPriorityEitjeHours().catch(console.error)
