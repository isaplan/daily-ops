/**
 * @registry-id: memberEitjeMasterSync
 * @created: 2026-06-29T12:00:00.000Z
 * @last-modified: 2026-06-29T12:00:00.000Z
 * @description: Upsert all Eitje master users → members (employment + identity)
 * @last-fix: [2026-06-29] Master API active flag drives members.is_active
 * @adr-ref: ADR-001, ADR-003, ADR-012
 *
 * @exports-to:
 * ✓ server/services/eitjeSyncService.ts
 * ✓ scripts/sync-members-from-eitje-master.ts
 */

import { ObjectId, type Db } from 'mongodb'
import { linkMemberUnifiedUserId } from './memberEitjeContext'
import { upsertUnifiedUserEitjeIdentity } from './unifiedUserMerge'
import type { StaffEmploymentOverride } from '~/types/staff-employment'

export type EitjeMasterUserRow = {
  eitje_id: number | string
  name: string
  email: string | null
  eitje_active: boolean
  cost_per_hour: number | null
}

export type MemberEmploymentInput = {
  is_active?: boolean | null
  eitje_active?: boolean | null
  contract_end_date?: Date | null
  staff_employment_override?: StaffEmploymentOverride | null
}

/** Employment status: Eitje master active + contract end + manual override — NOT recent hours. */
export function resolveMemberEmploymentActive (input: MemberEmploymentInput, asOf = new Date()): boolean {
  const override = input.staff_employment_override
  if (override === 'no_longer_working') return false
  if (override === 'still_working') return true

  const end = input.contract_end_date
  if (end instanceof Date && !Number.isNaN(end.getTime())) {
    const day = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()))
    const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
    if (endDay < day) return false
  }

  if (input.eitje_active === false) return false
  if (input.eitje_active === true) return true
  if (input.is_active === false) return false
  return true
}

function normName (s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function escapeRegex (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toNum (v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseEitjeMasterUsers (docs: Array<Record<string, unknown>>): EitjeMasterUserRow[] {
  const out: EitjeMasterUserRow[] = []
  for (const doc of docs) {
    const raw = doc.rawApiResponse as Record<string, unknown> | undefined
    if (!raw) continue
    const id = raw.id
    if (id == null || id === '') continue
    const first = String(raw.first_name ?? '').trim()
    const last = String(raw.last_name ?? '').trim()
    const email = raw.email != null ? String(raw.email).trim().toLowerCase() : null
    const name = (first && last) ? `${first} ${last}` : email || String(id)
    out.push({
      eitje_id: id as number | string,
      name,
      email: email || null,
      eitje_active: raw.active !== false,
      cost_per_hour: toNum(raw.cost_per_hour),
    })
  }
  return out
}

async function findMemberForEitjeUser (
  db: Db,
  row: EitjeMasterUserRow,
): Promise<Record<string, unknown> | null> {
  const idStr = String(row.eitje_id).trim()
  const idNum = Number(idStr)
  const orClause: Record<string, unknown>[] = [
    { support_id: idStr },
    { eitje_id: idStr },
    { eitje_ids: idStr },
  ]
  if (!Number.isNaN(idNum)) {
    orClause.push({ support_id: idNum }, { eitje_id: idNum }, { eitje_ids: idNum })
  }
  if (row.email) orClause.push({ email: row.email })
  const nm = row.name.trim()
  if (nm) {
    orClause.push({ name: nm })
    orClause.push({ name: { $regex: `^\\s*${escapeRegex(nm)}\\s*$`, $options: 'i' } })
  }

  return db.collection('members').findOne({ $or: orClause }) as Promise<Record<string, unknown> | null>
}

export type SyncMembersFromEitjeMasterResult = {
  total: number
  created: number
  updated: number
  linked: number
  skipped: number
}

/** Upsert every Eitje master user into members; set eitje_active + is_active from master. */
export async function syncMembersFromEitjeMaster (db: Db): Promise<SyncMembersFromEitjeMasterResult> {
  const userDocs = await db.collection('eitje_raw_data').find({ endpoint: 'users' }).toArray()
  const rows = parseEitjeMasterUsers(userDocs as Array<Record<string, unknown>>)
  const now = new Date()
  let created = 0
  let updated = 0
  let linked = 0
  let skipped = 0

  for (const row of rows) {
    const idStr = String(row.eitje_id).trim()
    let member = await findMemberForEitjeUser(db, row)

    if (!member) {
      const email =
        row.email ||
        `eitje-${idStr.replace(/[^\w.-]/g, '_')}@noreply.local`
      const ins = await db.collection('members').insertOne({
        name: row.name,
        email,
        support_id: idStr,
        eitje_id: idStr,
        eitje_ids: [idStr],
        eitje_active: row.eitje_active,
        is_active: resolveMemberEmploymentActive({ eitje_active: row.eitje_active }),
        roles: [{ role: 'kitchen_staff', scope: 'team', grantedAt: now }],
        data_sources: { eitje_master: now },
        created_at: now,
        updated_at: now,
      })
      member = { _id: ins.insertedId }
      created++
    } else {
      const oid = member._id instanceof ObjectId ? member._id : new ObjectId(String(member._id))
      const eitje_active = row.eitje_active
      const is_active = resolveMemberEmploymentActive({
        eitje_active,
        contract_end_date: member.contract_end_date instanceof Date ? member.contract_end_date : null,
        staff_employment_override: member.staff_employment_override as StaffEmploymentOverride | null,
        is_active: member.is_active as boolean | null,
      })

      const $set: Record<string, unknown> = {
        eitje_active,
        is_active,
        updated_at: now,
        'data_sources.eitje_master': now,
      }
      if (!member.support_id) $set.support_id = idStr
      const eitjeIds = new Set<string>([
        ...((member.eitje_ids as string[] | undefined) ?? []).map(String),
        ...(member.eitje_id ? [String(member.eitje_id)] : []),
        idStr,
      ])
      $set.eitje_ids = [...eitjeIds]
      if (!member.eitje_id) $set.eitje_id = idStr
      if (!member.name && row.name) $set.name = row.name
      if (!member.email && row.email) $set.email = row.email

      await db.collection('members').updateOne({ _id: oid }, { $set })
      member = { ...member, _id: oid }
      updated++
    }

    const oid = member._id instanceof ObjectId ? member._id : new ObjectId(String(member._id))
    const { unifiedUserId } = await upsertUnifiedUserEitjeIdentity(db, row.eitje_id, row.name, idStr)
    await db.collection('members').updateOne(
      { _id: oid },
      { $set: { unified_user_id: unifiedUserId, updated_at: now } },
    )
    await linkMemberUnifiedUserId(db, oid, idStr, row.name)
    linked++
  }

  return { total: rows.length, created, updated, linked, skipped }
}

/** Recompute members.is_active from eitje_active + contract_end_date + override. */
export async function refreshAllMemberEmploymentFlags (db: Db): Promise<number> {
  const members = await db.collection('members').find({}).toArray()
  let changed = 0
  const now = new Date()
  for (const m of members) {
    const next = resolveMemberEmploymentActive({
      eitje_active: m.eitje_active as boolean | null | undefined,
      contract_end_date: m.contract_end_date instanceof Date ? m.contract_end_date : null,
      staff_employment_override: m.staff_employment_override as StaffEmploymentOverride | null,
      is_active: m.is_active as boolean | null,
    })
    if (m.is_active !== next) {
      await db.collection('members').updateOne(
        { _id: m._id },
        { $set: { is_active: next, updated_at: now } },
      )
      changed++
    }
  }
  return changed
}
