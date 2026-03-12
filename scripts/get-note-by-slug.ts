/**
 * One-off: fetch a note by slug from MongoDB and print its stored data.
 * Run: npx tsx scripts/get-note-by-slug.ts wekelijks-mt-11-mrt-2026
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { MongoClient } from 'mongodb'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
const slug = process.argv[2] || 'wekelijks-mt-11-mrt-2026'

async function main() {
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  const coll = db.collection('notes')

  const note = await coll.findOne({ slug })
  if (!note) {
    console.log('No note found with slug:', slug)
    const anyByTitle = await coll.findOne({ title: /wekelijks|mt|11|mrt|2026/i })
    if (anyByTitle) {
      console.log('Found a note that might be related (by title):', (anyByTitle as { title?: string }).title, (anyByTitle as { slug?: string }).slug)
    }
    await client.close()
    process.exit(0)
    return
  }

  const n = note as Record<string, unknown>
  const created = n.created_at as Date | string | undefined
  const updated = n.updated_at as Date | string | undefined
  const toLocal = (d: Date | string | undefined) => {
    if (!d) return '—'
    const date = typeof d === 'string' ? new Date(d) : d
    return date.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', dateStyle: 'short', timeStyle: 'medium' })
  }
  console.log('--- Note in DB ---')
  console.log('_id:', n._id)
  console.log('slug:', n.slug)
  console.log('title:', n.title)
  console.log('status:', n.status)
  console.log('created_at (UTC):', created)
  console.log('created_at (Amsterdam):', toLocal(created))
  console.log('updated_at (UTC):', updated)
  console.log('updated_at (Amsterdam):', toLocal(updated))
  const content = (n.content as string) ?? ''
  console.log('content length:', content.length)
  if (content.length > 0) {
    console.log('content (first 800 chars):', content.slice(0, 800))
    if (content.length > 800) console.log('... (truncated)')
  } else {
    console.log('content: (empty)')
  }

  // Notes updated yesterday between 13:00–16:00 UTC (14:00–17:00 Amsterdam)
  const yesterdayStart = new Date('2026-03-11T12:00:00.000Z')
  const yesterdayEnd = new Date('2026-03-11T16:00:00.000Z')
  const cursor = coll.find({
    $or: [
      { updated_at: { $gte: yesterdayStart, $lte: yesterdayEnd } },
      { created_at: { $gte: yesterdayStart, $lte: yesterdayEnd } },
    ],
  }).project({ slug: 1, title: 1, created_at: 1, updated_at: 1 })
  const inWindow = await cursor.toArray()
  console.log('\n--- Notes created/updated 11 Mar 2026 13:00–16:00 UTC (14:00–17:00 Amsterdam) ---')
  if (inWindow.length === 0) console.log('(none)')
  else inWindow.forEach((doc: Record<string, unknown>) => console.log(doc.slug, doc.title, 'created', doc.created_at, 'updated', doc.updated_at))

  await client.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
