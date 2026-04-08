/**
 * Read-only check: counts + latest docs in eitje_raw_data.
 * Uses same MONGODB_URI / MONGODB_DB_NAME resolution as server/utils/db.ts (cwd .env.local, parent .env).
 * Run: node scripts/verify-eitje-raw-data.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

function loadParentEnv () {
  const root = resolve(process.cwd(), '..')
  for (const file of ['.env.local', '.env']) {
    const p = resolve(root, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}

function loadCwdMongoEnv () {
  const root = resolve(process.cwd())
  for (const file of ['.env.local', '.env']) {
    const p = resolve(root, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (!match) continue
      const key = match[1].trim()
      if (key !== 'MONGODB_URI' && key !== 'MONGODB_DB_NAME') continue
      process.env[key] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

loadParentEnv()
loadCwdMongoEnv()

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'

if (!uri) {
  console.error('No MONGODB_URI — set in .env.local (project root).')
  process.exit(1)
}

const client = new MongoClient(uri)
await client.connect()
const coll = client.db(dbName).collection('eitje_raw_data')

const total = await coll.countDocuments({})
const since = new Date(Date.now() - 2 * 60 * 60 * 1000)
const last2h = await coll.countDocuments({ updatedAt: { $gte: since } })
const latest = await coll
  .find({})
  .sort({ updatedAt: -1 })
  .limit(8)
  .project({
    endpoint: 1,
    updatedAt: 1,
    date: 1,
    syncDedupKey: 1,
    'extracted.environmentId': 1,
  })
  .toArray()

const byEndpoint = await coll
  .aggregate([{ $group: { _id: '$endpoint', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }])
  .toArray()

console.log(
  JSON.stringify(
    {
      database: dbName,
      collection: 'eitje_raw_data',
      totalDocuments: total,
      updatedInLast2Hours: last2h,
      topEndpointsByCount: byEndpoint,
      eightLatestByUpdatedAt: latest,
    },
    null,
    2
  )
)

await client.close()
