/**
 * Copy `locations` and `teams` from a source MongoDB (default: local daily-ops)
 * into the database from MONGODB_URI / MONGODB_DB_NAME (.env).
 *
 * Usage (from repo root):
 *   node --experimental-strip-types scripts/copy-locations-teams-to-remote.ts
 *
 * Optional env:
 *   SOURCE_MONGODB_URI=mongodb://127.0.0.1:27017
 *   SOURCE_MONGODB_DB_NAME=daily-ops
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

  const locCount = await sourceDb.collection('locations').countDocuments()
  const teamCount = await sourceDb.collection('teams').countDocuments()
  console.log(`Source ${sourceDbName}: ${locCount} locations, ${teamCount} teams`)

  if (locCount === 0 && teamCount === 0) {
    console.error('Nothing to copy from source.')
    process.exit(1)
  }

  const locations = await sourceDb.collection('locations').find({}).toArray()
  const teams = await sourceDb.collection('teams').find({}).toArray()

  if (locations.length) {
    const ops = locations.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    }))
    const r = await targetDb.collection('locations').bulkWrite(ops, { ordered: false })
    console.log(
      `Target locations: upserted ${r.upsertedCount}, modified ${r.modifiedCount}, matched ${r.matchedCount}`
    )
  }

  if (teams.length) {
    const ops = teams.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    }))
    const r = await targetDb.collection('teams').bulkWrite(ops, { ordered: false })
    console.log(
      `Target teams: upserted ${r.upsertedCount}, modified ${r.modifiedCount}, matched ${r.matchedCount}`
    )
  }

  const afterLoc = await targetDb.collection('locations').countDocuments()
  const afterTeam = await targetDb.collection('teams').countDocuments()
  console.log(`Target ${targetDbName}: ${afterLoc} locations, ${afterTeam} teams`)

  await sourceClient.close()
  await targetClient.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
