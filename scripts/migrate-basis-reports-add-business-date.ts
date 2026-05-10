/**
 * Migrate inbox/test basis report collections:
 * Populate business_date field for all documents where it's null or missing.
 *
 * Usage: node --experimental-strip-types scripts/migrate-basis-reports-add-business-date.ts
 */

import { Db, MongoClient } from 'mongodb'

function addCalendarDaysISO(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function calendarToBusinessDay(
  calendarDateStr: string,
  calendarHour: number,
): { businessDate: string; businessHour: number } {
  if (calendarHour >= 8 && calendarHour <= 23) {
    return { businessDate: calendarDateStr, businessHour: calendarHour - 8 }
  }
  return {
    businessDate: addCalendarDaysISO(calendarDateStr, -1),
    businessHour: calendarHour + 16,
  }
}

async function migrateCollection(db: Db, collectionName: string): Promise<void> {
  const collection = db.collection(collectionName)

  console.log(`[migrate] Processing ${collectionName}...`)
  const docs = await collection.find({ $or: [{ business_date: null }, { business_date: { $exists: false } }] }).toArray()

  if (docs.length === 0) {
    console.log(`[migrate] ✓ ${collectionName}: All documents have valid business_date field`)
    return
  }

  console.log(`[migrate] ${collectionName}: Found ${docs.length} documents to update`)

  let updated = 0
  let failed = 0

  for (const doc of docs) {
    try {
      const date = doc.date as string | undefined
      const cronHour = doc.cron_hour as number | undefined

      if (!date || typeof cronHour !== 'number') {
        failed++
        continue
      }

      const { businessDate, businessHour } = calendarToBusinessDay(date, cronHour)

      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            business_date: businessDate,
            business_hour: businessHour,
          },
        },
      )

      updated++

      if (updated % 50 === 0) {
        console.log(`[migrate] ${collectionName}: Updated ${updated}/${docs.length}...`)
      }
    } catch (err) {
      console.error(`[migrate] Error in ${collectionName}:`, err)
      failed++
    }
  }

  console.log(`[migrate] ${collectionName}: ✓ Completed: ${updated} updated, ${failed} failed`)
}

async function main(): Promise<void> {
  const dbUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops'
  const client = new MongoClient(dbUrl)

  try {
    console.log(`[migrate] Connecting to ${dbUrl}...`)
    await client.connect()
    const db = client.db()

    console.log('[migrate] Starting migration...')
    await migrateCollection(db, 'inbox-bork-basis-report')
    await migrateCollection(db, 'test-basis-report')

    console.log('[migrate] All migrations complete!')
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('[migrate] Fatal error:', err)
  process.exit(1)
})
