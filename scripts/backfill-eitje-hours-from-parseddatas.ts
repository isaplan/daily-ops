/**
 * One-off: parseddatas (documentType=hours) → inbox-eitje-hours
 *
 * Lives under scripts/ (not server/tasks/) so Nitro does not import it on every dev startup.
 *
 * @run: pnpm run backfill:eitje-hours-from-parseddatas
 */

import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops'

export async function runBackfillEitjeHoursFromParseddatas () {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    const db = client.db()
    const parsedCol = db.collection('parseddatas')
    const inboxCol = db.collection('inbox-eitje-hours')

    console.log('[backfill-eitje-hours] Starting import from parseddatas...')

    const parsedDocs = await parsedCol
      .find({ documentType: 'hours' })
      .toArray()

    console.log(`[backfill-eitje-hours] Found ${parsedDocs.length} parsed documents`)

    let totalRowsInserted = 0
    const operations = []

    for (const parsed of parsedDocs) {
      const rows = parsed.data?.rows || []

      for (const row of rows) {
        const doc = {
          ...row,
          source: 'inbox',
          importedAt: parsed.created_at || new Date(),
          sourceEmailId: parsed.emailId,
          sourceParsedDataId: parsed._id,
          cron_priority: 0,
          cron_hour: undefined,
        }

        operations.push({
          insertOne: {
            document: doc,
          },
        })

        totalRowsInserted++
      }
    }

    if (operations.length === 0) {
      console.log('[backfill-eitje-hours] No rows to insert')
      return
    }

    const result = await inboxCol.bulkWrite(operations)

    console.log(`[backfill-eitje-hours] Inserted ${result.insertedCount} documents`)
    console.log(`[backfill-eitje-hours] Total rows processed: ${totalRowsInserted}`)
    console.log('[backfill-eitje-hours] Backfill complete')
  } finally {
    await client.close()
  }
}

void runBackfillEitjeHoursFromParseddatas().catch(console.error)
