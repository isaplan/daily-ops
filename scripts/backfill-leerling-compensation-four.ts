/**
 * One-off backfill: Chelsea, Hugo, Xavi De Lange, Flora — apply Leerling €2/h fallback on members.
 *
 * Usage:
 *   npx tsx scripts/backfill-leerling-compensation-four.ts            # dry run
 *   npx tsx scripts/backfill-leerling-compensation-four.ts --apply    # writes
 */

import { MongoClient, ObjectId, type Db } from 'mongodb'
import { openNewRevision } from '../server/utils/memberCompensationRevisions'
import { resolveLeerlingInboxWages } from '../utils/dailyOpsLeerlingWageFallback'

const APPLY = process.argv.includes('--apply')

/** support_id SSOT for the four staff discussed (compensation gaps). */
const TARGET_SUPPORT_IDS = ['86822', '76413', '113484', '130067'] as const

async function latestInboxOverig(db: Db, employeeName: string, supportId: string): Promise<string | null> {
  const row = await db
    .collection('inbox-eitje-hours')
    .find({
      $or: [
        { support_id: supportId },
        { employee_name: { $regex: new RegExp(`^${employeeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      ],
    })
    .sort({ date: -1, importedAt: -1 })
    .limit(1)
    .project({ overig: 1 })
    .next()
  const overig = row?.overig
  return overig != null && String(overig).trim() ? String(overig).trim() : null
}

async function run() {
  const uri = process.env.MONGODB_URI || process.env.NUXT_MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)

  const members = await db
    .collection('members')
    .find({ support_id: { $in: [...TARGET_SUPPORT_IDS] } })
    .project({
      _id: 1,
      name: 1,
      support_id: 1,
      contract_type: 1,
      hourly_rate: 1,
      cost_per_hour: 1,
      overig: 1,
    })
    .toArray()

  console.log(`Found ${members.length}/${TARGET_SUPPORT_IDS.length} target members`)

  let changed = 0
  let skipped = 0

  for (const m of members) {
    const name = String(m.name ?? '')
    const supportId = String(m.support_id ?? '')
    const contractType = String(m.contract_type ?? 'uren contract').trim() || 'uren contract'
    const hourlyRate = typeof m.hourly_rate === 'number' ? m.hourly_rate : null
    const costPerHour = typeof m.cost_per_hour === 'number' ? m.cost_per_hour : null
    const inboxOverig = await latestInboxOverig(db, name, supportId)
    const overig = inboxOverig ?? (m.overig != null ? String(m.overig).trim() : null)

    const leerling = resolveLeerlingInboxWages(name, contractType, hourlyRate, costPerHour, overig)
    if (!leerling) {
      console.log(`  SKIP ${name} — not Leerling (name/overig) or has valid CSV uurloon`)
      skipped++
      continue
    }

    console.log(
      `  ${APPLY ? 'APPLY' : 'DRY'} ${name}: hr ${hourlyRate ?? '—'} → €${leerling.hourly_rate}, cph ${costPerHour ?? '—'} → €${leerling.cost_per_hour}${overig ? ` (overig=${overig})` : ''}`,
    )

    if (!APPLY) {
      changed++
      continue
    }

    const memberId = m._id instanceof ObjectId ? m._id : new ObjectId(String(m._id))
    const result = await openNewRevision(
      db,
      memberId,
      {
        contract_type: contractType,
        hourly_rate: leerling.hourly_rate,
        cost_per_hour: leerling.cost_per_hour,
      },
      'migration_seed',
      new Date(),
      'backfill-leerling-compensation-four',
    )

    if (overig) {
      await db.collection('members').updateOne({ _id: memberId }, { $set: { overig } })
    }

    if (result.changed) changed++
    else skipped++
  }

  console.log(`\nDone. ${APPLY ? 'changed' : 'would change'}=${changed} skipped=${skipped}`)
  if (!APPLY) console.log('Dry run — pass --apply to write.')

  await client.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
