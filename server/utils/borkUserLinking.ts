/**
 * @registry-id: borkUserLinking
 * @created: 2026-05-19T14:00:00.000Z
 * @last-modified: 2026-05-19T14:00:00.000Z
 * @description: Bork waiter name ↔ unified_user ↔ member linking and fuzzy suggestions
 * @last-fix: [2026-05-19] Read-time mapping overlay + confirm/reject link API support
 *
 * @adr-ref: ADR-003
 *
 * @exports-to:
 * ✓ server/utils/memberBorkContext.ts
 * ✓ server/api/daily-ops/bork-staff/link.post.ts
 * ✓ server/api/daily-ops/bork-staff/unified-users.get.ts
 */

import { ObjectId, type Db } from 'mongodb'

export type BorkLinkSuggestionConfidence = 'high' | 'medium' | 'low'

export type BorkUnifiedUserSuggestion = {
  unified_user_id: string
  name: string
  confidence: BorkLinkSuggestionConfidence
  reason: string
}

export type BorkMemberSuggestion = {
  member_id: string
  name: string
  confidence: BorkLinkSuggestionConfidence
  reason: string
}

export type BorkLinkResolution = {
  effective_unified_user_id?: string
  effective_unified_user_name?: string
  matched_member_id?: string
  matched_member_name?: string
  from_bork_mapping: boolean
  from_stored_worker_id: boolean
  suggestion?: BorkUnifiedUserSuggestion
  member_suggestion?: BorkMemberSuggestion
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normBorkName(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function isValidObjectIdString(id: string): boolean {
  return /^[0-9a-f]{24}$/i.test(id)
}

export type BorkUserMappingIndex = Map<
  string,
  { unifiedUserId: ObjectId; unifiedUserName: string; borkUserName: string }
>

/** Load confirmed Bork → unified_user rows keyed by normalized Bork display name. */
export async function loadBorkUserMappingIndex(db: Db): Promise<BorkUserMappingIndex> {
  const docs = await db.collection('bork_unified_user_mapping').find({}).toArray()
  const out: BorkUserMappingIndex = new Map()
  for (const doc of docs) {
    const d = doc as Record<string, unknown>
    const uid = d.unifiedUserId
    if (!(uid instanceof ObjectId) && typeof uid !== 'string') continue
    const oid = uid instanceof ObjectId ? uid : new ObjectId(String(uid))
    const borkName = String(d.borkUserName ?? d.bork_user_name ?? '').trim()
    if (!borkName) continue
    const unifiedUserName = String(d.unifiedUserName ?? d.unified_user_name ?? '').trim()
    out.set(normBorkName(borkName), {
      unifiedUserId: oid,
      unifiedUserName: unifiedUserName || borkName,
      borkUserName: borkName,
    })
  }
  return out
}

/** Bork POS names that map to this unified user (for querying aggregates with workerId unknown). */
export async function borkNamesForUnifiedUser(db: Db, unifiedUserId: ObjectId): Promise<string[]> {
  const uidStr = String(unifiedUserId)
  const docs = await db
    .collection('bork_unified_user_mapping')
    .find({
      $or: [{ unifiedUserId }, { unifiedUserId: uidStr }],
    })
    .project({ borkUserName: 1, bork_user_name: 1 })
    .toArray()
  const names = new Set<string>()
  for (const d of docs) {
    const n = String((d as Record<string, unknown>).borkUserName ?? (d as Record<string, unknown>).bork_user_name ?? '').trim()
    if (n) names.add(n)
  }
  return [...names]
}

async function loadRejectedPairs(
  db: Db,
  borkNameNorm: string
): Promise<Set<string>> {
  const rows = await db
    .collection('bork_user_link_rejections')
    .find({ bork_user_name_norm: borkNameNorm })
    .project({ unified_user_id: 1 })
    .toArray()
  return new Set(rows.map((r) => String((r as { unified_user_id?: unknown }).unified_user_id ?? '')))
}

export async function suggestUnifiedUserForBorkName(
  db: Db,
  borkUserName: string,
  opts?: { excludeUnifiedIds?: Set<string> }
): Promise<BorkUnifiedUserSuggestion | null> {
  const raw = borkUserName.trim()
  const norm = normBorkName(raw)
  if (!norm) return null

  const rejected = await loadRejectedPairs(db, norm)
  const exclude = opts?.excludeUnifiedIds ?? new Set<string>()
  for (const id of rejected) exclude.add(id)

  const exactOr: Record<string, unknown>[] = [
    { canonicalName: { $regex: `^\\s*${escapeRegex(raw)}\\s*$`, $options: 'i' } },
    { primaryName: { $regex: `^\\s*${escapeRegex(raw)}\\s*$`, $options: 'i' } },
    { eitjeNames: raw },
    { allIdValues: raw },
  ]

  const exact = await db.collection('unified_user').findOne({ $or: exactOr })
  if (exact) {
    const id = String(exact._id)
    if (!exclude.has(id)) {
      const name =
        String((exact as Record<string, unknown>).canonicalName ?? '') ||
        String((exact as Record<string, unknown>).primaryName ?? '') ||
        raw
      return {
        unified_user_id: id,
        name,
        confidence: 'high',
        reason: 'Exact name match in unified_user',
      }
    }
  }

  const tokens = norm.split(' ').filter((t) => t.length >= 2)
  if (tokens.length >= 2) {
    const first = tokens[0]!
    const last = tokens[tokens.length - 1]!
    const fuzzyOr: Record<string, unknown>[] = [
      { canonicalName: { $regex: escapeRegex(first), $options: 'i' } },
      { canonicalName: { $regex: escapeRegex(last), $options: 'i' } },
      { primaryName: { $regex: escapeRegex(first), $options: 'i' } },
    ]
    const candidates = await db
      .collection('unified_user')
      .find({ $or: fuzzyOr })
      .limit(20)
      .toArray()

    for (const c of candidates) {
      const id = String(c._id)
      if (exclude.has(id)) continue
      const cName = normBorkName(
        (c as Record<string, unknown>).canonicalName ?? (c as Record<string, unknown>).primaryName
      )
      if (!cName) continue
      const cTokens = cName.split(' ')
      const sharesFirst = cTokens.some((t) => t === first || t.startsWith(first))
      const sharesLast = cTokens.some((t) => t === last || t.endsWith(last))
      if (sharesFirst && sharesLast) {
        const name =
          String((c as Record<string, unknown>).canonicalName ?? '') ||
          String((c as Record<string, unknown>).primaryName ?? '') ||
          raw
        return {
          unified_user_id: id,
          name,
          confidence: 'medium',
          reason: 'Similar name in unified_user',
        }
      }
    }
  }

  return null
}

export async function suggestMemberForUnifiedUser(
  db: Db,
  unifiedUserId: ObjectId,
  displayName: string
): Promise<BorkMemberSuggestion | null> {
  const byFk = await db.collection('members').findOne({
    unified_user_id: unifiedUserId,
  })
  if (byFk) {
    return {
      member_id: String(byFk._id),
      name: String((byFk as Record<string, unknown>).name ?? displayName),
      confidence: 'high',
      reason: 'Member already has unified_user_id',
    }
  }

  const nm = displayName.trim()
  if (!nm) return null
  const byName = await db.collection('members').findOne({
    name: { $regex: `^\\s*${escapeRegex(nm)}\\s*$`, $options: 'i' },
  })
  if (byName && !(byName.unified_user_id instanceof ObjectId)) {
    return {
      member_id: String(byName._id),
      name: String((byName as Record<string, unknown>).name ?? nm),
      confidence: 'medium',
      reason: 'Member name matches unified_user name',
    }
  }

  return null
}

export async function resolveBorkWorkerLink(
  db: Db,
  options: {
    borkUserName: string
    storedWorkerId: string
    mappingIndex: BorkUserMappingIndex
    memberByUnified: Map<string, { memberId: string; name: string }>
  }
): Promise<BorkLinkResolution> {
  const { borkUserName, storedWorkerId, mappingIndex, memberByUnified } = options
  const norm = normBorkName(borkUserName)

  let effectiveUnifiedId: string | undefined
  let effectiveUnifiedName: string | undefined
  let fromBorkMapping = false
  let fromStoredWorkerId = false

  if (isValidObjectIdString(storedWorkerId) && storedWorkerId !== 'unknown') {
    effectiveUnifiedId = storedWorkerId
    fromStoredWorkerId = true
  }

  const mapped = mappingIndex.get(norm)
  if (mapped) {
    effectiveUnifiedId = String(mapped.unifiedUserId)
    effectiveUnifiedName = mapped.unifiedUserName
    fromBorkMapping = true
  }

  let matchedMemberId: string | undefined
  let matchedMemberName: string | undefined
  if (effectiveUnifiedId) {
    const hit = memberByUnified.get(effectiveUnifiedId)
    if (hit) {
      matchedMemberId = hit.memberId
      matchedMemberName = hit.name
    }
  }

  let suggestion: BorkUnifiedUserSuggestion | undefined
  let memberSuggestion: BorkMemberSuggestion | undefined

  if (!effectiveUnifiedId) {
    const sug = await suggestUnifiedUserForBorkName(db, borkUserName)
    if (sug) suggestion = sug
  } else if (!matchedMemberId) {
    const uDoc = await db.collection('unified_user').findOne(
      { _id: new ObjectId(effectiveUnifiedId) },
      { projection: { canonicalName: 1, primaryName: 1 } }
    )
    const uName =
      String((uDoc as Record<string, unknown> | null)?.canonicalName ?? '') ||
      String((uDoc as Record<string, unknown> | null)?.primaryName ?? '') ||
      effectiveUnifiedName ||
      borkUserName
    const memSug = await suggestMemberForUnifiedUser(db, new ObjectId(effectiveUnifiedId), uName)
    if (memSug) memberSuggestion = memSug
  }

  return {
    ...(effectiveUnifiedId
      ? {
          effective_unified_user_id: effectiveUnifiedId,
          effective_unified_user_name: effectiveUnifiedName,
        }
      : {}),
    ...(matchedMemberId
      ? { matched_member_id: matchedMemberId, matched_member_name: matchedMemberName }
      : {}),
    from_bork_mapping: fromBorkMapping,
    from_stored_worker_id: fromStoredWorkerId,
    ...(suggestion ? { suggestion } : {}),
    ...(memberSuggestion ? { member_suggestion: memberSuggestion } : {}),
  }
}

export async function confirmBorkUserLink(
  db: Db,
  options: {
    borkUserName: string
    unifiedUserId: string
    memberId?: string
    confirmedBy?: string
  }
): Promise<{ mapping_id: string; member_updated: boolean }> {
  const borkUserName = options.borkUserName.trim()
  if (!borkUserName) throw new Error('bork_user_name is required')
  if (!isValidObjectIdString(options.unifiedUserId)) throw new Error('Invalid unified_user_id')

  const unifiedOid = new ObjectId(options.unifiedUserId)
  const u = await db.collection('unified_user').findOne({ _id: unifiedOid })
  if (!u) throw new Error('unified_user not found')

  const unifiedUserName =
    String((u as Record<string, unknown>).canonicalName ?? '') ||
    String((u as Record<string, unknown>).primaryName ?? '') ||
    borkUserName

  const now = new Date()
  const mappingResult = await db.collection('bork_unified_user_mapping').updateOne(
    { borkUserName },
    {
      $set: {
        borkUserName,
        unifiedUserId: unifiedOid,
        unifiedUserName,
        updated_at: now,
        ...(options.confirmedBy ? { confirmed_by: options.confirmedBy } : {}),
      },
      $setOnInsert: { created_at: now },
    },
    { upsert: true }
  )

  let memberUpdated = false
  if (options.memberId && isValidObjectIdString(options.memberId)) {
    const r = await db.collection('members').updateOne(
      { _id: new ObjectId(options.memberId) },
      { $set: { unified_user_id: unifiedOid, updated_at: now } }
    )
    memberUpdated = r.matchedCount > 0
  }

  await db.collection('bork_user_link_rejections').deleteMany({
    bork_user_name_norm: normBorkName(borkUserName),
    unified_user_id: options.unifiedUserId,
  })

  return {
    mapping_id: mappingResult.upsertedId ? String(mappingResult.upsertedId) : borkUserName,
    member_updated: memberUpdated,
  }
}

export async function rejectBorkUserLinkSuggestion(
  db: Db,
  options: { borkUserName: string; unifiedUserId: string }
): Promise<void> {
  const norm = normBorkName(options.borkUserName)
  if (!norm || !isValidObjectIdString(options.unifiedUserId)) return
  await db.collection('bork_user_link_rejections').updateOne(
    {
      bork_user_name_norm: norm,
      unified_user_id: options.unifiedUserId,
    },
    {
      $set: {
        bork_user_name: options.borkUserName.trim(),
        bork_user_name_norm: norm,
        unified_user_id: options.unifiedUserId,
        rejected_at: new Date(),
      },
    },
    { upsert: true }
  )
}
