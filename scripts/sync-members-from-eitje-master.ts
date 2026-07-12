/**
 * Sync all Eitje master users → members (employment from API active flag).
 *
 * Usage:
 *   npx tsx scripts/sync-members-from-eitje-master.ts
 *   pnpm members:sync-eitje-master
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import {
  refreshAllMemberEmploymentFlags,
  syncMembersFromEitjeMaster,
} from '../server/utils/memberEitjeMasterSync.ts'
import { invalidateEitjeStaffHubCache } from '../server/utils/eitjeStaffHub.ts'
import { invalidateWorkerContractIndexCache } from '../server/utils/dailyOpsStaff/resolveWorkerContractFromMembers.ts'

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
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) throw new Error('Missing MONGODB_URI')
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')

  const r = await syncMembersFromEitjeMaster(db)
  console.log('[sync-members-eitje-master]', r)

  const refreshed = await refreshAllMemberEmploymentFlags(db)
  console.log(`[sync-members-eitje-master] employment flags refreshed=${refreshed}`)

  invalidateEitjeStaffHubCache()
  invalidateWorkerContractIndexCache()
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
