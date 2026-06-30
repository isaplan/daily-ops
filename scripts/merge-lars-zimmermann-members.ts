/**
 * One-off: merge duplicate Lars Zimmermann members → single canonical profile.
 *
 * Usage:
 *   npx tsx scripts/merge-lars-zimmermann-members.ts
 *   npx tsx scripts/merge-lars-zimmermann-members.ts --apply
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, ObjectId, type Db } from 'mongodb'
import { openNewRevision, resolveCostPerHour, compensationStatusFromFields } from '../server/utils/memberCompensationRevisions.ts'
import { upsertUnifiedUserEitjeIdentity } from '../server/utils/unifiedUserMerge.ts'
import { invalidateEitjeStaffHubCache } from '../server/utils/eitjeStaffHub.ts'
import { MEMBER_EITJE_SALDO_COLLECTION } from '../server/utils/memberEitjeSaldoSnapshots.ts'
import { invalidateWorkerContractIndexCache } from '../server/utils/dailyOpsStaff/resolveWorkerContractFromMembers.ts'

const CANONICAL_ID = '69ca3a743056b2a44dba1b06'
const DUPE_IDS = [
  '6a42ab3cda6e4aab9137257e',
  '6a42ab69da6e4aab91372580',
  '6a42ab7ada6e4aab91372582',
  '6a42ab81da6e4aab91372584',
  '6a42ae5720f828511ca3baf8',
]

const PROFILE = {
  name: 'Lars Zimmermann',
  contract_type: 'uren contract (38)',
  hourly_rate: 20.35,
  weekly_hours: 38,
  support_id: '18020',
  eitje_id: 33320,
  eitje_ids: ['18020', '33320', '123647', '81170'],
  nmbrs_id: 'fa99c507-c7cc-4239-8f1e-503b74a84365',
  email: 'larszimmermann@hotmail.com',
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

  console.log(`[merge-lars] canonical=${CANONICAL_ID} dupes=${dupes.length}/${DUPE_IDS.length}`)
  console.log('[merge-lars] target profile:', PROFILE)

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
    'merge-lars-zimmermann-members',
  )

  const unified = await upsertUnifiedUserEitjeIdentity(db, PROFILE.eitje_id, PROFILE.name, PROFILE.support_id)
  for (const eid of PROFILE.eitje_ids) {
    if (String(eid) !== String(PROFILE.eitje_id)) {
      await upsertUnifiedUserEitjeIdentity(db, eid, PROFILE.name, PROFILE.support_id)
    }
  }

  const eitjeIdValues = [...new Set([...PROFILE.eitje_ids.map(String), PROFILE.eitje_id])]
  await db.collection('unified_user').updateOne(
    { _id: unified.unifiedUserId },
    {
      $set: {
        canonicalName: PROFILE.name,
        primaryName: PROFILE.name,
        support_id: PROFILE.support_id,
        updatedAt: now,
      },
      $addToSet: {
        eitjeIds: { $each: eitjeIdValues },
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
    console.log(`[merge-lars] deleted dupe ${dupeId}`)
  }

  const extraUnified = await db
    .collection('unified_user')
    .find({ canonicalName: /zimmermann/i })
    .toArray()
  for (const u of extraUnified) {
    if (String(u._id) === String(unified.unifiedUserId)) continue
    await db.collection('members').updateMany(
      { unified_user_id: u._id },
      { $set: { unified_user_id: unified.unifiedUserId, updated_at: now } },
    )
    await db.collection('unified_user').deleteOne({ _id: u._id })
    console.log(`[merge-lars] removed extra unified_user ${String(u._id)}`)
  }

  invalidateEitjeStaffHubCache()
  invalidateWorkerContractIndexCache()

  const remaining = await db.collection('members').find({ name: /zimmermann/i }).toArray()
  console.log(`\n[merge-lars] done. members remaining: ${remaining.length}`)
  for (const m of remaining) {
    console.log(
      `  ${String(m._id)} | ${m.name} | support=${m.support_id} | eitje_ids=${JSON.stringify(m.eitje_ids)} | contract=${m.contract_type} | €${m.hourly_rate}`,
    )
  }

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
