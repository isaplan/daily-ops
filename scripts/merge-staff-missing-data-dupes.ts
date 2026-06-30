/**
 * Merge staff save-stubs into canonical CSV members (Timur, Inna, Jan).
 * npx tsx scripts/merge-staff-missing-data-dupes.ts --apply
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, ObjectId, type Db } from 'mongodb'
import { openNewRevision, resolveCostPerHour, compensationStatusFromFields } from '../server/utils/memberCompensationRevisions.ts'
import { invalidateEitjeStaffHubCache } from '../server/utils/eitjeStaffHub.ts'
import { MEMBER_EITJE_SALDO_COLLECTION } from '../server/utils/memberEitjeSaldoSnapshots.ts'
import { invalidateWorkerContractIndexCache } from '../server/utils/dailyOpsStaff/resolveWorkerContractFromMembers.ts'

type MergeSpec = {
  canonicalId: string
  dupeIds: string[]
  patch?: Record<string, unknown>
}

const MERGES: MergeSpec[] = [
  {
    canonicalId: '69ca3a763056b2a44dba1b2c',
    dupeIds: ['6a4086ab34b57212b138a1f9'],
    patch: { name: 'Timur Waanders', hourly_rate: 18.5, contract_type: 'nul uren', support_id: '98266', eitje_id: 77653, eitje_ids: ['98266', '77653'] },
  },
  {
    canonicalId: '69ca3a6e5d7c5fc3cb219bce',
    dupeIds: ['6a42add220f828511ca3baf4'],
    patch: { contract_type: 'uren contract (38)', hourly_rate: 17.27 },
  },
  {
    canonicalId: '69ca3a6e5d7c5fc3cb219bd0',
    dupeIds: ['6a42ae0d20f828511ca3baf6'],
    patch: { contract_type: 'nul uren', hourly_rate: 15 },
  },
]

function loadEnv() {
  for (const f of ['.env.local', '.env', '.env.digitalocean.local']) {
    const p = resolve(f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

async function relinkMemberRefs(db: Db, fromId: string, toId: string, now: Date) {
  const fromOid = new ObjectId(fromId)
  const toOid = new ObjectId(toId)
  await db.collection(MEMBER_EITJE_SALDO_COLLECTION).updateMany({ member_id: fromId }, { $set: { member_id: toId, updated_at: now } })
  await db.collection('notes').updateMany(
    { connected_member_ids: fromOid },
    [{ $set: { connected_member_ids: { $setUnion: [{ $filter: { input: { $ifNull: ['$connected_member_ids', []] }, cond: { $ne: ['$$this', fromOid] } } }, [toOid]] }, updated_at: now } }],
  )
  await db.collection('notes').updateMany({ 'connected_to.member_id': fromOid }, { $set: { 'connected_to.member_id': toOid, updated_at: now } })
}

async function main() {
  loadEnv()
  const apply = process.argv.includes('--apply')
  const client = new MongoClient(process.env.MONGODB_URI!)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')
  const now = new Date()

  for (const spec of MERGES) {
    const canonical = await db.collection('members').findOne({ _id: new ObjectId(spec.canonicalId) })
    if (!canonical) throw new Error(`Missing canonical ${spec.canonicalId}`)
    const dupes = await db.collection('members').find({ _id: { $in: spec.dupeIds.map((id) => new ObjectId(id)) } }).toArray()
    console.log(`[merge-staff] ${canonical.name} canonical=${spec.canonicalId} dupes=${dupes.length}`)
    if (!apply) continue

    const patch = spec.patch ?? {}
    if (patch.contract_type != null || patch.hourly_rate != null) {
      const contract_type = String(patch.contract_type ?? canonical.contract_type ?? '')
      const hourly_rate = Number(patch.hourly_rate ?? canonical.hourly_rate)
      const costPerHour = resolveCostPerHour(contract_type, hourly_rate, canonical.cost_per_hour as number | null)
      await openNewRevision(db, new ObjectId(spec.canonicalId), { contract_type, hourly_rate, cost_per_hour: costPerHour }, 'manual_ui', now, 'merge-staff-missing-data-dupes')
      patch.compensation_status = compensationStatusFromFields(contract_type, hourly_rate, costPerHour)
      patch.cost_per_hour = costPerHour
    }
    await db.collection('members').updateOne({ _id: new ObjectId(spec.canonicalId) }, { $set: { ...patch, is_active: true, eitje_active: true, updated_at: now } })
    for (const dupe of dupes) {
      await relinkMemberRefs(db, String(dupe._id), spec.canonicalId, now)
      await db.collection('members').deleteOne({ _id: dupe._id })
      console.log(`  deleted dupe ${String(dupe._id)}`)
    }
  }

  if (apply) {
    invalidateEitjeStaffHubCache()
    invalidateWorkerContractIndexCache()
  } else console.log('\nDry run — use --apply')
  await client.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
