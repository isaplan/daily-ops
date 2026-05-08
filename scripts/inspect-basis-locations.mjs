/**
 * Inspect inbox-bork-basis-report locations and unified_location aliases.
 * Output:
 *  1) Distinct `location` strings + count + linked `location_id`
 *  2) `unified_location` documents (id + every alias-ish field)
 *
 * Run: node scripts/inspect-basis-locations.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

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

async function main() {
  loadDotEnv()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI / MONGODB_DB_NAME')
    process.exit(1)
  }

  const client = new MongoClient(uri.trim())
  await client.connect()
  const db = client.db(dbName)

  console.log('\n=== unified_location ===')
  const ulocs = await db
    .collection('unified_location')
    .find({})
    .toArray()
  for (const u of ulocs) {
    console.log({
      _id: String(u._id),
      name: u.name,
      primaryName: u.primaryName,
      canonicalName: u.canonicalName,
      abbreviation: u.abbreviation,
      borkLocationName: u.borkMapping?.borkLocationName,
    })
  }

  console.log('\n=== bork_unified_location_mapping ===')
  const mapping = await db.collection('bork_unified_location_mapping').find({}).toArray()
  for (const m of mapping) console.log(m)

  console.log('\n=== inbox-bork-basis-report distinct `location` ===')
  const dist = await db
    .collection('inbox-bork-basis-report')
    .aggregate([
      {
        $group: {
          _id: '$location',
          count: { $sum: 1 },
          sampleDates: { $addToSet: '$date' },
          sampleLocationRaw: { $addToSet: '$location_raw' },
          sampleLocationId: { $addToSet: '$location_id' },
          sampleSubject: { $addToSet: '$metadata.email_subject' },
          sampleAttachment: { $addToSet: '$metadata.attachment_filename' },
        },
      },
      { $sort: { count: -1 } },
    ])
    .toArray()

  for (const d of dist) {
    console.log({
      location: d._id,
      count: d.count,
      location_raw: d.sampleLocationRaw,
      location_id: d.sampleLocationId,
      sampleSubject: (d.sampleSubject ?? []).slice(0, 3),
      sampleAttachment: (d.sampleAttachment ?? []).slice(0, 3),
      sampleDates: (d.sampleDates ?? []).slice(0, 3),
    })
  }

  console.log('\n=== rows with no location_id ===')
  const orphans = await db
    .collection('inbox-bork-basis-report')
    .aggregate([
      { $match: { $or: [{ location_id: null }, { location_id: { $exists: false } }, { location_id: '' }] } },
      {
        $group: {
          _id: '$location',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])
    .toArray()
  console.log(orphans)

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
