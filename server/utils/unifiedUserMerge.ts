/**
 * @registry-id: unifiedUserMerge
 * @created: 2026-06-25T12:00:00.000Z
 * @last-modified: 2026-06-25T12:00:00.000Z
 * @description: Upsert unified_user — one person, many Eitje/Bork IDs (ADR-003)
 * @last-fix: [2026-06-25] Merge-by-name instead of one doc per shift user ID
 * @adr-ref: ADR-003
 *
 * @exports-to:
 * ✓ server/services/eitjeSyncService.ts
 * ✓ scripts/dedup-unified-user.ts
 * ✓ scripts/apply-teamleden-contract-csv.ts
 */

import { ObjectId, type Db } from 'mongodb'

export function normUnifiedPersonName (name: unknown): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function escapeRegex (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function idVariants (id: number | string): unknown[] {
  const out = new Set<unknown>()
  out.add(id)
  const s = String(id).trim()
  if (s) out.add(s)
  const n = Number(s)
  if (!Number.isNaN(n) && String(n) === s) out.add(n)
  return [...out]
}

function pickDisplayName (current: string | undefined, next: string | undefined): string {
  const c = String(current ?? '').trim()
  const n = String(next ?? '').trim()
  if (!c) return n
  if (!n) return c
  if (n.length > c.length && /[a-z]/i.test(n)) return n
  if (c === c.toLowerCase() && n !== n.toLowerCase()) return n
  return c
}

/** Find best existing unified_user for an Eitje identity. */
export async function findUnifiedUserForEitjeIdentity (
  db: Db,
  eitjeId: number | string,
  opts?: { name?: string; supportId?: string },
): Promise<ObjectId | null> {
  const orClause: Record<string, unknown>[] = []
  for (const v of idVariants(eitjeId)) {
    orClause.push({ eitjeIds: v })
    orClause.push({ allIdValues: v })
    orClause.push({ primaryId: v })
  }
  const sid = opts?.supportId?.trim()
  if (sid) {
    orClause.push({ support_id: sid })
    for (const v of idVariants(sid)) orClause.push({ eitjeIds: v }, { allIdValues: v })
  }
  const norm = normUnifiedPersonName(opts?.name)
  if (norm.length >= 3) {
    orClause.push({ canonicalName: { $regex: `^\\s*${escapeRegex(norm)}\\s*$`, $options: 'i' } })
    orClause.push({ primaryName: { $regex: `^\\s*${escapeRegex(norm)}\\s*$`, $options: 'i' } })
  }
  if (!orClause.length) return null

  const doc = await db.collection('unified_user').findOne(
    { $or: orClause },
    { projection: { _id: 1 }, sort: { updatedAt: -1 } },
  )
  return doc?._id instanceof ObjectId ? doc._id : null
}

/** Add Eitje id(s) to one unified_user row; merge by id or name — never spawn duplicate person docs. */
export async function upsertUnifiedUserEitjeIdentity (
  db: Db,
  eitjeId: number | string,
  name?: string,
  supportId?: string,
): Promise<{ unifiedUserId: ObjectId; created: boolean }> {
  const ids = idVariants(eitjeId)
  const displayName = String(name ?? '').trim()
  const existingId = await findUnifiedUserForEitjeIdentity(db, eitjeId, { name: displayName, supportId })

  const addToSet: Record<string, unknown> = {
    eitjeIds: { $each: ids },
    allIdValues: { $each: ids },
  }
  if (displayName) {
    addToSet.eitjeNames = displayName
  }

  if (existingId) {
    const existing = await db.collection('unified_user').findOne(
      { _id: existingId },
      { projection: { canonicalName: 1, primaryName: 1 } },
    )
    const canonical = pickDisplayName(
      typeof existing?.canonicalName === 'string' ? existing.canonicalName : undefined,
      displayName,
    )
    await db.collection('unified_user').updateOne(
      { _id: existingId },
      {
        $addToSet: addToSet,
        $set: {
          ...(canonical ? { canonicalName: canonical, primaryName: canonical } : {}),
          ...(supportId?.trim() ? { support_id: supportId.trim() } : {}),
          updatedAt: new Date(),
        },
      },
    )
    return { unifiedUserId: existingId, created: false }
  }

  const canonical = displayName || String(eitjeId)
  const ins = await db.collection('unified_user').insertOne({
    eitjeIds: ids,
    allIdValues: ids,
    ...(displayName ? { eitjeNames: [displayName] } : {}),
    primaryName: canonical,
    canonicalName: canonical,
    ...(supportId?.trim() ? { support_id: supportId.trim() } : {}),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return { unifiedUserId: ins.insertedId, created: true }
}

export type UnifiedUserMergeStats = {
  groups: number
  merged: number
  deleted: number
  membersRelinked: number
}

function scoreUnifiedUserDoc (doc: Record<string, unknown>, memberLinkCount: number): number {
  let score = memberLinkCount * 1000
  const ej = doc.eitjeIds
  if (Array.isArray(ej)) score += ej.filter(Boolean).length * 10
  const av = doc.allIdValues
  if (Array.isArray(av)) score += av.filter(Boolean).length
  const name = String(doc.canonicalName ?? doc.primaryName ?? '').trim()
  if (name && name !== name.toLowerCase()) score += 5
  if (doc.support_id) score += 20
  if (doc.createdAt instanceof Date) score += doc.createdAt.getTime() / 1e15
  return score
}

/** Merge duplicate unified_user rows (same normalized name). */
export async function dedupeUnifiedUsersByName (
  db: Db,
  opts?: { apply?: boolean },
): Promise<UnifiedUserMergeStats> {
  const apply = opts?.apply === true
  const docs = await db.collection('unified_user').find({}).toArray()
  const byName = new Map<string, Array<Record<string, unknown>>>()

  for (const raw of docs) {
    const d = raw as Record<string, unknown>
    const norm = normUnifiedPersonName(d.canonicalName ?? d.primaryName)
    if (norm.length < 3) continue
    const list = byName.get(norm) ?? []
    list.push(d)
    byName.set(norm, list)
  }

  let merged = 0
  let deleted = 0
  let membersRelinked = 0
  let groups = 0

  for (const [, group] of byName) {
    if (group.length < 2) continue
    groups++

    const linkCounts = new Map<string, number>()
    for (const d of group) {
      const id = d._id instanceof ObjectId ? d._id : new ObjectId(String(d._id))
      const n = await db.collection('members').countDocuments({ unified_user_id: id })
      linkCounts.set(id.toHexString(), n)
    }

    const sorted = [...group].sort((a, b) => {
      const sa = scoreUnifiedUserDoc(a, linkCounts.get(String(a._id)) ?? 0)
      const sb = scoreUnifiedUserDoc(b, linkCounts.get(String(b._id)) ?? 0)
      return sb - sa
    })
    const survivor = sorted[0]!
    const survivorId = survivor._id instanceof ObjectId ? survivor._id : new ObjectId(String(survivor._id))
    const dupes = sorted.slice(1)

    const mergedEitjeIds = new Set<unknown>()
    const mergedAllIds = new Set<unknown>()
    const mergedNames = new Set<string>()

    for (const d of group) {
      for (const x of (d.eitjeIds as unknown[] | undefined) ?? []) if (x != null && x !== '') mergedEitjeIds.add(x)
      for (const x of (d.allIdValues as unknown[] | undefined) ?? []) if (x != null && x !== '') mergedAllIds.add(x)
      for (const x of (d.eitjeNames as unknown[] | undefined) ?? []) {
        const s = String(x).trim()
        if (s) mergedNames.add(s)
      }
      const cn = String(d.canonicalName ?? d.primaryName ?? '').trim()
      if (cn) mergedNames.add(cn)
    }

    if (!apply) {
      merged += dupes.length
      deleted += dupes.length
      continue
    }

    await db.collection('unified_user').updateOne(
      { _id: survivorId },
      {
        $set: {
          eitjeIds: [...mergedEitjeIds],
          allIdValues: [...mergedAllIds],
          eitjeNames: [...mergedNames],
          canonicalName: pickDisplayName(
            String(survivor.canonicalName ?? ''),
            [...mergedNames].sort((a, b) => b.length - a.length)[0],
          ),
          primaryName: pickDisplayName(
            String(survivor.primaryName ?? ''),
            [...mergedNames].sort((a, b) => b.length - a.length)[0],
          ),
          updatedAt: new Date(),
        },
      },
    )

    for (const d of dupes) {
      const dupeId = d._id instanceof ObjectId ? d._id : new ObjectId(String(d._id))
      const rel = await db.collection('members').updateMany(
        { unified_user_id: dupeId },
        { $set: { unified_user_id: survivorId, updated_at: new Date() } },
      )
      membersRelinked += rel.modifiedCount
      await db.collection('unified_user').deleteOne({ _id: dupeId })
      merged++
      deleted++
    }
  }

  return { groups, merged, deleted, membersRelinked }
}
