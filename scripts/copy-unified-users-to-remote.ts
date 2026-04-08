/**
 * Copy `unified_user` from source MongoDB (default: local daily-ops) into MONGODB_URI / MONGODB_DB_NAME.
 * Upserts by _id so Eitje ID resolution (support_id → eitje user ids) works on the target cluster.
 *
 *   node --experimental-strip-types scripts/copy-unified-users-to-remote.ts
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
  const targetUri = process.env.MONGODB_URI
  const targetDbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  const sourceUri = process.env.SOURCE_MONGODB_URI || 'mongodb://127.0.0.1:27017'
  const sourceDbName = process.env.SOURCE_MONGODB_DB_NAME || 'daily-ops'

  if (!targetUri) {
    console.error('Missing MONGODB_URI (set in .env)')
    process.exit(1)
  }

  const sourceClient = new MongoClient(sourceUri)
  const targetClient = new MongoClient(targetUri)
  await sourceClient.connect()
  await targetClient.connect()

  const sourceDb = sourceClient.db(sourceDbName)
  const targetDb = targetClient.db(targetDbName)

  const n = await sourceDb.collection('unified_user').countDocuments()
  console.log(`Source ${sourceDbName}.unified_user: ${n} documents`)
  if (n === 0) {
    console.error('No unified_user documents to copy.')
    process.exit(1)
  }

  const cursor = sourceDb.collection('unified_user').find({})
  let batch: Record<string, unknown>[] = []
  const BATCH = 200
  let total = 0
  while (await cursor.hasNext()) {
    const doc = await cursor.next()
    if (!doc) break
    batch.push(doc as Record<string, unknown>)
    if (batch.length >= BATCH) {
      const ops = batch.map((d) => ({
        replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true },
      }))
      const r = await targetDb.collection('unified_user').bulkWrite(ops, { ordered: false })
      total += r.upsertedCount + r.modifiedCount + r.matchedCount
      batch = []
    }
  }
  if (batch.length) {
    const ops = batch.map((d) => ({
      replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true },
    }))
    const r = await targetDb.collection('unified_user').bulkWrite(ops, { ordered: false })
    total += r.upsertedCount + r.modifiedCount + r.matchedCount
  }

  const after = await targetDb.collection('unified_user').countDocuments()
  console.log(`Target ${targetDbName}.unified_user: ${after} documents (bulk ops acknowledged: ${total})`)

  await sourceClient.close()
  await targetClient.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
