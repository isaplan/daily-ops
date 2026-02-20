/**
 * Verify weekly notes are present in the DB.
 * Weekly notes use title pattern "Wekelijks MT - ..." (from weeklyNoteTemplate).
 * Usage: node scripts/verify-weekly-notes.js
 */
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { MongoClient } = require('mongodb')

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db(dbName)
    const notes = db.collection('notes')

    const weeklyCount = await notes.countDocuments({ title: /Wekelijks MT/i })
    console.log('=== Weekly notes in DB\n')
    console.log('DB:', dbName)
    console.log('Notes with title matching "Wekelijks MT":', weeklyCount)

    if (weeklyCount > 0) {
      const list = await notes
        .find({ title: /Wekelijks MT/i })
        .sort({ created_at: -1 })
        .limit(20)
        .project({ _id: 1, title: 1, slug: 1, created_at: 1, status: 1 })
        .toArray()
      console.log('\nRecent weekly notes (up to 20):')
      list.forEach((n) => {
        console.log('  -', n.title, '|', n.created_at ? new Date(n.created_at).toISOString() : 'no date', '|', n._id)
      })
    }

    const totalNotes = await notes.countDocuments({})
    console.log('\nTotal notes in collection:', totalNotes)
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
