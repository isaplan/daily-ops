/**
 * Merge duplicate unified_user rows (same person, multiple Eitje IDs / name-only dupes).
 *
 * Usage:
 *   npx tsx scripts/dedup-unified-user.ts
 *   npx tsx scripts/dedup-unified-user.ts --apply
 *   pnpm unified-user:dedup -- --apply
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { dedupeUnifiedUsersByName } from '../server/utils/unifiedUserMerge.ts'

function loadDotEnv () {
  for (const file of ['.env.local', '.env', '.env.digitalocean.local']) {
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

async function main (): Promise<void> {
  loadDotEnv()
  const apply = process.argv.includes('--apply')
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops-db'
  if (!uri) {
    console.error('[dedup-unified-user] Missing MONGODB_URI')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const before = await db.collection('unified_user').countDocuments()
  const stats = await dedupeUnifiedUsersByName(db, { apply })
  const after = await db.collection('unified_user').countDocuments()

  console.log(`[dedup-unified-user] ${apply ? 'APPLIED' : 'DRY-RUN'} before=${before} after=${apply ? after : before - stats.deleted}`)
  console.log(`  groups=${stats.groups} merged=${stats.merged} deleted=${stats.deleted} membersRelinked=${stats.membersRelinked}`)
  if (!apply) console.log('  Run with --apply to write.')

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
