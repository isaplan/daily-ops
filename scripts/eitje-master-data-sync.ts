/**
 * Eitje master-data only: environments, teams, users → eitje_raw_data → unified_user/team.
 * Does NOT refetch time_registration_shifts (use eitje-full-raw-backfill for that).
 *
 * Usage:
 *   EITJE_MASTER_SYNC_CONFIRM=1 npx tsx scripts/eitje-master-data-sync.ts
 *   pnpm eitje:master-sync
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { executeEitjeJob } from '../server/services/eitjeSyncService.ts'
import { linkMemberUnifiedUserId } from '../server/utils/memberEitjeContext.ts'
import { dedupeUnifiedUsersByName } from '../server/utils/unifiedUserMerge.ts'
import { ObjectId } from 'mongodb'

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

async function relinkAllMembers (db: Awaited<ReturnType<MongoClient['db']>>): Promise<number> {
  const members = await db.collection('members').find({}).toArray()
  let linked = 0
  for (const m of members) {
    if (!(m._id instanceof ObjectId)) continue
    await db.collection('members').updateOne(
      { _id: m._id },
      { $unset: { unified_user_id: '' } },
    )
    const name = String(m.name ?? '').trim()
    const sid = typeof m.support_id === 'string' ? m.support_id : undefined
    const uid = await linkMemberUnifiedUserId(db, m._id, sid, name)
    if (uid) linked++
  }
  return linked
}

async function main (): Promise<void> {
  loadDotEnv()
  const confirmed =
    process.env.EITJE_MASTER_SYNC_CONFIRM === '1' || process.env.EITJE_MASTER_SYNC_CONFIRM === 'yes'
  if (!confirmed) {
    console.error('[eitje-master] Set EITJE_MASTER_SYNC_CONFIRM=1 to run.')
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops-db'
  if (!uri) {
    console.error('[eitje-master] Missing MONGODB_URI / DATABASE_URL')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  console.log('[eitje-master] syncing environments, teams, users…')
  const master = await executeEitjeJob(db, 'master-data')
  console.log('[eitje-master]', master.ok ? 'OK' : 'FAIL', master.message)
  if (master.master?.endpoints) {
    for (const e of master.master.endpoints) {
      console.log(`  ${e.name}: fetched=${e.fetched} upserted=${e.upserted}${e.error ? ` err=${e.error}` : ''}`)
    }
  }

  console.log('[eitje-master] dedupe unified_user by name…')
  const dedupe = await dedupeUnifiedUsersByName(db, { apply: true })
  console.log(`[eitje-master] dedupe groups=${dedupe.groups} merged=${dedupe.merged} deleted=${dedupe.deleted} membersRelinked=${dedupe.membersRelinked}`)

  console.log('[eitje-master] relink members.unified_user_id…')
  const linked = await relinkAllMembers(db)
  console.log(`[eitje-master] members linked=${linked}`)

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
