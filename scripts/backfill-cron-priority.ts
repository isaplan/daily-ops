/**
 * One-off: set cron_priority on inbox-bork-basis-report where missing.
 *
 * Lives under scripts/ so Nitro does not import it on every dev startup.
 *
 * @run: pnpm run backfill:cron-priority
 */

import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops'

function calculateCronPriority (cronHour: number | undefined): number {
  if (cronHour === 7 || cronHour === 8) return 3
  if (cronHour === 23) return 2
  if (cronHour === 18) return 1
  return 0
}

export async function runBackfillCronPriorityBasisReport () {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('inbox-bork-basis-report')

    console.log('[backfill] Starting cron_priority backfill...')

    const docs = await collection
      .find({ cron_priority: { $exists: false } })
      .toArray()

    console.log(`[backfill] Found ${docs.length} documents without cron_priority`)

    if (docs.length === 0) {
      console.log('[backfill] No documents to update')
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

    console.log(`[backfill] Updated ${result.modifiedCount} documents`)
    console.log('[backfill] Backfill complete')
  } finally {
    await client.close()
  }
}

void runBackfillCronPriorityBasisReport().catch(console.error)
