/**
 * Rebuild `eitje_time_registration_aggregation` for [startDate, endDate] after pipeline fixes
 * (Amsterdam business day + normalized worker/team/location keys).
 *
 * Usage:
 *   npx tsx scripts/rebuild-eitje-labor-aggregation.ts 2026-05-01 2026-05-10
 *
 * Env: MONGODB_URI, MONGODB_DB_NAME (from .env)
 */
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { MongoClient } from 'mongodb'
import { rebuildEitjeTimeRegistrationAggregation } from '../server/services/eitjeRebuildAggregationService.ts'

function loadDotEnv () {
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

async function main () {
  loadDotEnv()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI or MONGODB_DB_NAME')
    process.exit(1)
  }
  const start = process.argv[2] ?? process.env.EITJE_REBUILD_START
  const end = process.argv[3] ?? process.env.EITJE_REBUILD_END ?? start
  if (!start || !end) {
    console.error('Usage: npx tsx scripts/rebuild-eitje-labor-aggregation.ts <startDate> <endDate>')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const db = client.db(dbName)
    console.log(`Rebuilding Eitje labor aggregation ${start} .. ${end} ...`)
    const r = await rebuildEitjeTimeRegistrationAggregation(db, start, end)
    console.log('Done:', r)
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
