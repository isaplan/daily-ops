/**
 * One-time backfill: set members.unified_user_id from unified_user (support_id / eitjeIds / name).
 * Run: pnpm members:backfill-unified-user-id
 *   (or: npx --yes tsx scripts/backfill-members-unified-user-id.ts)
 *
 * @adr-ref: ADR-003
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../server/utils/db'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function resolveUnifiedUserId(
  db: Awaited<ReturnType<typeof getDb>>,
  supportId: string | undefined,
  name: string
): Promise<ObjectId | null> {
  const orClause: Record<string, unknown>[] = []
  const sid = supportId?.trim()
  if (sid) {
    orClause.push({ support_id: sid })
    const n = Number(sid)
    if (!Number.isNaN(n)) {
      orClause.push({ eitjeIds: n })
      orClause.push({ allIdValues: n })
    }
  }
  const nm = name.trim()
  if (nm) {
    orClause.push({ canonicalName: name })
    orClause.push({
      canonicalName: { $regex: `^\\s*${escapeRegex(nm)}\\s*$`, $options: 'i' },
    })
  }
  if (!orClause.length) return null

  const u = await db.collection('unified_user').findOne(
    { $or: orClause },
    { projection: { _id: 1 } }
  )
  return u?._id instanceof ObjectId ? u._id : null
}

async function main() {
  const db = await getDb()
  await db.collection('members').createIndex({ unified_user_id: 1 }, { sparse: true })

  const members = await db.collection('members').find({}).toArray()
  let linked = 0
  let skipped = 0

  for (const m of members) {
    if (m.unified_user_id instanceof ObjectId) {
      skipped++
      continue
    }
    const name = String(m.name ?? '').trim()
    const supportId = typeof m.support_id === 'string' ? m.support_id : undefined
    const uid = await resolveUnifiedUserId(db, supportId, name)
    if (!uid) continue
    await db.collection('members').updateOne(
      { _id: m._id },
      { $set: { unified_user_id: uid, updated_at: new Date() } }
    )
    linked++
  }

  process.stdout.write(`Backfill complete: linked=${linked} already_set=${skipped} total=${members.length}\n`)
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
