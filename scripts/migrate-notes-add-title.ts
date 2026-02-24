/**
 * One-time migration: ensure every note has a non-empty title (same schema).
 * Weekly and basic notes share the same document shape; weekly is just a variant with block content.
 *
 * Updates notes where title is missing, null, or empty string to title: 'Untitled'.
 * Run from repo root: npx tsx scripts/migrate-notes-add-title.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { MongoClient } from 'mongodb'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'

async function main() {
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  const coll = db.collection('notes')

  const result = await coll.updateMany(
    {
      $or: [
        { title: { $exists: false } },
        { title: null },
        { title: '' },
        { title: { $regex: /^\s*$/ } },
      ],
    },
    { $set: { title: 'Untitled', updated_at: new Date() } }
  )

  console.log(`Notes migration: matched ${result.matchedCount}, modified ${result.modifiedCount}`)
  if (result.modifiedCount > 0) {
    console.log('All notes now have a title (Untitled where it was missing).')
  }
  await client.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
