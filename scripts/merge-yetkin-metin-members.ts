/**
 * One-off: merge duplicate Yetkin Metin → Yetkin Metin | Leerling.
 *
 * Usage:
 *   npx tsx scripts/merge-yetkin-metin-members.ts
 *   npx tsx scripts/merge-yetkin-metin-members.ts --apply
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, ObjectId, type Db } from 'mongodb'
import { openNewRevision, resolveCostPerHour, compensationStatusFromFields } from '../server/utils/memberCompensationRevisions.ts'
import { upsertUnifiedUserEitjeIdentity } from '../server/utils/unifiedUserMerge.ts'
import { invalidateEitjeStaffHubCache } from '../server/utils/eitjeStaffHub.ts'
import { MEMBER_EITJE_SALDO_COLLECTION } from '../server/utils/memberEitjeSaldoSnapshots.ts'
import { invalidateWorkerContractIndexCache } from '../server/utils/dailyOpsStaff/resolveWorkerContractFromMembers.ts'

const CANONICAL_ID = '6a4086ab34b57212b138a1fa'
const DUPE_IDS = ['6a42b0dd4c8c9e1bb18842a2']

const PROFILE = {
  name: 'Yetkin Metin | Leerling',
  contract_type: 'uren contract (16)',
  hourly_rate: 2,
  weekly_hours: 16,
  support_id: '38556',
  eitje_id: 123531,
  eitje_ids: ['38556', '123531'],
  nmbrs_id: '1077cbb8-e1ed-49b0-9e06-6706fb0297ce',
  email: 'y.e.metin2009@gmail.com',
}

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
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) throw new Error('Missing MONGODB_URI')

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')
  const now = new Date()

  const canonicalOid = new ObjectId(CANONICAL_ID)
  const canonical = await db.collection('members').findOne({ _id: canonicalOid })
  if (!canonical) throw new Error(`Canonical member not found: ${CANONICAL_ID}`)

  const dupes = await db
    .collection('members')
    .find({ _id: { $in: DUPE_IDS.map((id) => new ObjectId(id)) } })
    .toArray()

  console.log(`[merge-yetkin] canonical=${CANONICAL_ID} dupes=${dupes.length}/${DUPE_IDS.length}`)
  console.log('[merge-yetkin] target profile:', PROFILE)

  if (!apply) {
    console.log('\nDry run. Run with --apply to merge.')
    await client.close()
    return
  }

  const costPerHour = resolveCostPerHour(PROFILE.contract_type, PROFILE.hourly_rate, canonical.cost_per_hour as number | null)
  const status = compensationStatusFromFields(PROFILE.contract_type, PROFILE.hourly_rate, costPerHour)

  await openNewRevision(
    db,
    canonicalOid,
    {
      contract_type: PROFILE.contract_type,
      hourly_rate: PROFILE.hourly_rate,
      cost_per_hour: costPerHour,
    },
    'manual_ui',
    now,
    'merge-yetkin-metin-members',
  )

  const unified = await upsertUnifiedUserEitjeIdentity(db, PROFILE.eitje_id, PROFILE.name, PROFILE.support_id)

  const eitjeIdValues = [...new Set([...PROFILE.eitje_ids.map(String), String(PROFILE.eitje_id)])]
  await db.collection('unified_user').updateOne(
    { _id: unified.unifiedUserId },
    {
      $set: {
        canonicalName: PROFILE.name,
        primaryName: PROFILE.name,
        canonicalEmail: PROFILE.email,
        support_id: PROFILE.support_id,
        updatedAt: now,
      },
      $addToSet: {
        eitjeIds: { $each: eitjeIdValues },
        eitjeNames: { $each: [PROFILE.name, 'Yetkin Metin', 'Yetkin'] },
        eitjeEmails: PROFILE.email,
        allIdValues: { $each: [PROFILE.nmbrs_id, PROFILE.support_id, ...eitjeIdValues] },
      },
    },
  )

  await db.collection('members').updateOne(
    { _id: canonicalOid },
    {
      $set: {
        ...PROFILE,
        eitje_id: PROFILE.eitje_id,
        cost_per_hour: costPerHour,
        compensation_status: status,
        unified_user_id: unified.unifiedUserId,
        is_active: true,
        eitje_active: true,
        updated_at: now,
      },
    },
  )

  for (const dupe of dupes) {
    const dupeId = String(dupe._id)
    await relinkMemberRefs(db, dupeId, CANONICAL_ID, now)
    await db.collection('members').deleteOne({ _id: dupe._id })
    console.log(`[merge-yetkin] deleted dupe ${dupeId}`)
  }

  invalidateEitjeStaffHubCache()
  invalidateWorkerContractIndexCache()

  const remaining = await db.collection('members').find({ name: /yetkin metin/i }).toArray()
  console.log(`\n[merge-yetkin] done. members remaining: ${remaining.length}`)
  for (const m of remaining) {
    console.log(
      `  ${String(m._id)} | ${m.name} | support=${m.support_id} | email=${m.email} | eitje_ids=${JSON.stringify(m.eitje_ids)} | contract=${m.contract_type} | €${m.hourly_rate}`,
    )
  }

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
