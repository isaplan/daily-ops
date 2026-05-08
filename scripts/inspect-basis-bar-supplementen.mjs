/**
 * Dump the early XLSX rows of `Bar supplementen` and `Unspecified` Basis Reports
 * to identify where the parser pulled the wrong / no venue.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, ObjectId } from 'mongodb'

function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m && process.env[m[1].trim()] === undefined) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}

async function dumpOne(db, label, locationFilter) {
  console.log(`\n=== ${label} ===`)
  const reports = await db
    .collection('inbox-bork-basis-report')
    .find(locationFilter)
    .limit(2)
    .toArray()

  for (const r of reports) {
    console.log('\n--- report ---')
    console.log({
      date: r.date,
      location: r.location,
      location_raw: r.location_raw,
      subject: r.metadata?.email_subject,
      file: r.metadata?.attachment_filename,
      source_attachment_id: r.metadata?.source_attachment_id,
    })

    const attId = r.metadata?.source_attachment_id
    if (!attId) continue
    let attObjectId
    try {
      attObjectId = new ObjectId(attId)
    } catch {
      console.log('  (invalid attachmentId, skipping)')
      continue
    }
    const parsed = await db.collection('parseddatas').findOne({ attachmentId: attObjectId })
    if (!parsed) {
      console.log('  (no parseddatas found for that attachment)')
      continue
    }
    const rows = parsed.data?.rows ?? []
    console.log(`  Parsed rows: ${rows.length}`)
    console.log('  First 25 rows (any non-empty cell):')
    for (let i = 0; i < Math.min(25, rows.length); i++) {
      const vals = Object.values(rows[i] ?? {})
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
      if (vals.length > 0) console.log(`    [${i}]`, vals.join(' | '))
    }
  }
}

async function main() {
  loadDotEnv()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  const client = new MongoClient(uri.trim())
  await client.connect()
  const db = client.db(dbName)

  await dumpOne(db, 'Bar supplementen', { location: 'Bar supplementen' })
  await dumpOne(db, 'Unspecified', { location: 'Unspecified' })

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
