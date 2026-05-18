/**
 * @registry-id: initSnapshotCollections
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-13T00:00:00.000Z
 * @description: Idempotent setup script — creates daily_ops_snapshot collections + indexes.
 *   Safe to run repeatedly.
 * @last-fix: [2026-05-13] Initial — Phase A.1 setup.
 *
 * Usage:
 *   MONGODB_URI=... MONGODB_DB_NAME=daily-ops-db npx tsx scripts/init-snapshot-collections.ts
 */

import { MongoClient } from 'mongodb'

const COLLECTIONS = ['daily_ops_snapshot', 'daily_ops_snapshot_section_revenue', 'daily_ops_snapshot_section_labor'] as const

async function ensureCollection(db: ReturnType<MongoClient['db']>, name: string): Promise<boolean> {
  const existing = await db.listCollections({ name }).toArray()
  if (existing.length === 0) {
    await db.createCollection(name)
    return true
  }
  return false
}

async function run() {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME ?? 'daily-ops-db'
  if (!uri) {
    console.error('MONGODB_URI not set')
    process.exit(1)
  }
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  for (const name of COLLECTIONS) {
    const created = await ensureCollection(db, name)
    console.log(`${created ? '[created]' : '[exists] '} ${name}`)
    const col = db.collection(name)
    await col.createIndex({ businessDate: 1, locationId: 1 }, { unique: true, name: 'businessDate_locationId_unique' })
    await col.createIndex({ lastBuiltAt: 1 }, { name: 'lastBuiltAt' })
    if (name === 'daily_ops_snapshot') {
      await col.createIndex({ status: 1, businessDate: -1 }, { name: 'status_businessDate' })
    }
    const indexes = await col.indexes()
    console.log(`         ${name} indexes: ${indexes.map((i) => i.name).join(', ')}`)
  }

  await client.close()
  console.log('\nDone.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
