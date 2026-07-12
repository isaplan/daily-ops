/**
 * Merge staff save-stubs into canonical CSV members (Timur / Inna / Jan).
 *
 * Usage:
 *   npx tsx scripts/merge-staff-save-stub-members.ts --apply
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, ObjectId, type Db } from 'mongodb'
import { openNewRevision, resolveCostPerHour, compensationStatusFromFields } from '../server/utils/memberCompensationRevisions.ts'
import { upsertUnifiedUserEitjeIdentity } from '../server/utils/unifiedUserMerge.ts'
import { invalidateEitjeStaffHubCache } from '../server/utils/eitjeStaffHub.ts'
import { MEMBER_EITJE_SALDO_COLLECTION } from '../server/utils/memberEitjeSaldoSnapshots.ts'
import { invalidateWorkerContractIndexCache } from '../server/utils/dailyOpsStaff/resolveWorkerContractFromMembers.ts'

type MergeSpec = {
  canonicalId: string
  dupeIds: string[]
  profile: Record<string, unknown>
}

const MERGES: MergeSpec[] = [
  {
    canonicalId: '69ca3a763056b2a44dba1b2c',
    dupeIds: ['6a4086ab34b57212b138a1f9'],
    profile: {
      name: 'Timur Waanders',
      contract_type: 'nul uren',
      hourly_rate: 18.5,
      support_id: '98266',
      eitje_id: 77653,
      eitje_ids: ['98266', '77653'],
      nmbrs_id: '70857cca-c776-46e6-b724-b795b3e3de5d',
      email: 'waanders.timur@gmail.com',
    },
  },
  {
    canonicalId: '69ca3a6e5d7c5fc3cb219bce',
    dupeIds: ['6a42add220f828511ca3baf4'],
    profile: {
      name: 'Inna Skotnikova',
      contract_type: 'uren contract (38)',
      hourly_rate: 17.27,
    },
  },
  {
    canonicalId: '69ca3a6e5d7c5fc3cb219bd0',
    dupeIds: ['6a42ae0d20f828511ca3baf6'],
    profile: {
      name: 'Jan Schavemaker',
      contract_type: 'nul uren',
      hourly_rate: 15,
    },
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
  await db.collection(MEMBER_EITJE_SALDO_COLLECTION).updateMany(
    { member_id: fromId },
    { $set: { member_id: toId, updated_at: now } },
  )
  await db.collection('notes').updateMany(
    { connected_member_ids: fromOid },
    [
      {
        $set: {
          connected_member_ids: {
            $setUnion: [
              {
                $filter: {
                  input: { $ifNull: ['$connected_member_ids', []] },
                  cond: { $ne: ['$$this', fromOid] },
                },
              },
              [toOid],
            ],
          },
          updated_at: now,
        },
      },
    ],
  )
  await db.collection('notes').updateMany(
    { 'connected_to.member_id': fromOid },
    { $set: { 'connected_to.member_id': toOid, updated_at: now } },
  )
}

async function main() {
  loadEnv()
  const apply = process.argv.includes('--apply')
  const client = new MongoClient(process.env.MONGODB_URI || process.env.DATABASE_URL || '')
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')
  const now = new Date()

  for (const spec of MERGES) {
    const canonical = await db.collection('members').findOne({ _id: new ObjectId(spec.canonicalId) })
    if (!canonical) {
      console.warn(`[merge-stubs] skip missing canonical ${spec.canonicalId}`)
      continue
    }
    const dupes = await db
      .collection('members')
      .find({ _id: { $in: spec.dupeIds.map((id) => new ObjectId(id)) } })
      .toArray()
    console.log(`[merge-stubs] ${spec.profile.name}: canonical=${spec.canonicalId} dupes=${dupes.length}`)
    if (!apply) continue

    const contract_type = String(spec.profile.contract_type ?? canonical.contract_type ?? '')
    const hourly_rate = Number(spec.profile.hourly_rate ?? canonical.hourly_rate)
    const costPerHour = resolveCostPerHour(contract_type, hourly_rate, canonical.cost_per_hour as number | null)
    const status = compensationStatusFromFields(contract_type, hourly_rate, costPerHour)

    await openNewRevision(
      db,
      new ObjectId(spec.canonicalId),
      { contract_type, hourly_rate, cost_per_hour: costPerHour },
      'manual_ui',
      now,
      'merge-staff-save-stub-members',
    )

    const eitjeId = spec.profile.eitje_id ?? canonical.eitje_id
    const supportId = String(spec.profile.support_id ?? canonical.support_id ?? '')
    if (eitjeId) {
      await upsertUnifiedUserEitjeIdentity(db, eitjeId, String(spec.profile.name ?? canonical.name), supportId || undefined)
    }

    await db.collection('members').updateOne(
      { _id: new ObjectId(spec.canonicalId) },
      {
        $set: {
          ...spec.profile,
          contract_type,
          hourly_rate,
          cost_per_hour: costPerHour,
          compensation_status: status,
          is_active: true,
          eitje_active: true,
          updated_at: now,
        },
      },
    )

    if (canonical.unified_user_id && spec.profile.name) {
      await db.collection('unified_user').updateOne(
        { _id: canonical.unified_user_id },
        {
          $set: {
            canonicalName: spec.profile.name,
            primaryName: spec.profile.name,
            updatedAt: now,
          },
          $addToSet: { eitjeNames: { $each: [spec.profile.name, 'Timur Waanders', 'Waanders.Timur@Gmail.Com'].filter(Boolean) } },
        },
      )
    }

    for (const dupe of dupes) {
      await relinkMemberRefs(db, String(dupe._id), spec.canonicalId, now)
      await db.collection('members').deleteOne({ _id: dupe._id })
      console.log(`[merge-stubs] deleted dupe ${String(dupe._id)}`)
    }
  }

  if (apply) {
    invalidateEitjeStaffHubCache()
    invalidateWorkerContractIndexCache()
  } else {
    console.log('\nDry run. Run with --apply to merge.')
  }

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
