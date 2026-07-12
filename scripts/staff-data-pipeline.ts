/**
 * Staff data pipeline: CSV → members → unified_user dedupe → snapshot labor rebuild.
 *
 * Usage:
 *   STAFF_PIPELINE_CONFIRM=1 npx tsx scripts/staff-data-pipeline.ts
 *   STAFF_PIPELINE_CONFIRM=1 npx tsx scripts/staff-data-pipeline.ts --skip-snapshots
 *   STAFF_PIPELINE_CONFIRM=1 npx tsx scripts/staff-data-pipeline.ts --csv /path/to.csv
 *
 * Run Eitje master sync separately (long API job):
 *   EITJE_MASTER_SYNC_CONFIRM=1 pnpm eitje:master-sync
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { MongoClient, ObjectId } from 'mongodb'
import { dedupeUnifiedUsersByName } from '../server/utils/unifiedUserMerge.ts'
import { linkMemberUnifiedUserId } from '../server/utils/memberEitjeContext.ts'
import { invalidateEitjeStaffHubCache } from '../server/utils/eitjeStaffHub.ts'

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

function arg (name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

function runStep (label: string, cmd: string, args: string[]): void {
  console.log(`\n[staff-pipeline] ${label}…`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, cwd: process.cwd() })
  if (r.status !== 0) {
    throw new Error(`${label} failed (exit ${r.status})`)
  }
}

async function relinkMembers (db: Awaited<ReturnType<MongoClient['db']>>): Promise<number> {
  const members = await db.collection('members').find({}).toArray()
  let linked = 0
  for (const m of members) {
    if (!(m._id instanceof ObjectId)) continue
    await db.collection('members').updateOne({ _id: m._id }, { $unset: { unified_user_id: '' } })
    const uid = await linkMemberUnifiedUserId(
      db,
      m._id,
      typeof m.support_id === 'string' ? m.support_id : undefined,
      String(m.name ?? ''),
    )
    if (uid) linked++
  }
  return linked
}

async function main (): Promise<void> {
  loadDotEnv()
  if (process.env.STAFF_PIPELINE_CONFIRM !== '1' && process.env.STAFF_PIPELINE_CONFIRM !== 'yes') {
    console.error('[staff-pipeline] Set STAFF_PIPELINE_CONFIRM=1 to run.')
    process.exit(1)
  }

  const skipSnapshots = process.argv.includes('--skip-snapshots')
  const csvPath = arg('csv')

  const csvArgs = ['tsx', 'scripts/sync-members-from-eitje-master.ts']
  runStep('1/5 Eitje master → members', 'npx', ['--yes', ...csvArgs])

  const csvApplyArgs = ['tsx', 'scripts/apply-teamleden-contract-csv.ts', '--apply']
  if (csvPath) csvApplyArgs.push(csvPath)
  runStep('2/5 CSV → members', 'npx', ['--yes', ...csvApplyArgs])

  runStep('3/5 dedup members (teamleden)', 'npx', ['--yes', 'tsx', 'scripts/dedup-teamleden-contract-members.ts', '--apply'])

  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops-db'
  if (!uri) throw new Error('Missing MONGODB_URI')

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  console.log('\n[staff-pipeline] 4/5 dedupe unified_user…')
  const dedupe = await dedupeUnifiedUsersByName(db, { apply: true })
  console.log(`  groups=${dedupe.groups} merged=${dedupe.merged} deleted=${dedupe.deleted}`)

  console.log('[staff-pipeline] relink members.unified_user_id…')
  const linked = await relinkMembers(db)
  console.log(`  linked=${linked}`)

  invalidateEitjeStaffHubCache()
  await client.close()

  if (!skipSnapshots) {
    runStep('5/5 rebuild labor snapshots 2024→now', 'npx', [
      '--yes', 'tsx', 'scripts/backfill-daily-ops-full-snapshots.ts',
      '--start', '2024-01-01',
      '--force',
    ])
  } else {
    console.log('\n[staff-pipeline] skipped snapshots (--skip-snapshots)')
  }

  console.log('\n[staff-pipeline] done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
