/**
 * @registry-id: resolveWorkerContractFromMembers
 * @created: 2026-06-29T12:00:00.000Z
 * @last-modified: 2026-06-29T12:00:00.000Z
 * @description: Resolve snapshot worker contractType from members + unified_user (ADR-012)
 * @adr-ref: ADR-001, ADR-004, ADR-012
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsStaff/fetchStaffDailyLabor.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type { DailyOpsSnapshotLaborSection } from '~/types/daily-ops-snapshot'
import { classifyStaffContractType } from '~/utils/dailyOpsStaffContractBuckets'

function normName (s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function idKeys (id: unknown): string[] {
  if (id == null || id === '') return []
  const s = String(id).trim()
  const out = new Set<string>([s])
  const n = Number(s)
  if (!Number.isNaN(n)) out.add(String(n))
  return [...out]
}

function isMissingContractType (ct: unknown): boolean {
  const s = String(ct ?? '').trim()
  return !s || s === '—' || s === '-'
}

type ContractIndex = {
  byShiftId: Map<string, string>
  byName: Map<string, string>
}

let cachedIndex: { builtAt: number; index: ContractIndex } | null = null
const INDEX_TTL_MS = 60_000

async function buildContractIndex (db: Db): Promise<ContractIndex> {
  const now = Date.now()
  if (cachedIndex && cachedIndex.builtAt + INDEX_TTL_MS > now) {
    return cachedIndex.index
  }

  const byShiftId = new Map<string, string>()
  const byName = new Map<string, string>()
  const unifiedToMember = new Map<string, string>()

  const members = await db
    .collection('members')
    .find({ contract_type: { $exists: true, $nin: [null, ''] } })
    .project({
      name: 1,
      support_id: 1,
      eitje_id: 1,
      eitje_ids: 1,
      contract_type: 1,
      unified_user_id: 1,
    })
    .toArray()

  for (const m of members) {
    const ct = String(m.contract_type ?? '').trim()
    if (!ct || !classifyStaffContractType(ct)) continue
    const nm = normName(m.name)
    if (nm) byName.set(nm, ct)
    if (m.unified_user_id instanceof ObjectId) {
      unifiedToMember.set(m.unified_user_id.toHexString(), ct)
    }
    for (const k of idKeys(m.support_id)) byShiftId.set(k, ct)
    for (const k of idKeys(m.eitje_id)) byShiftId.set(k, ct)
    for (const x of (m.eitje_ids as unknown[] | undefined) ?? []) {
      for (const k of idKeys(x)) byShiftId.set(k, ct)
    }
  }

  const unified = await db
    .collection('unified_user')
    .find({})
    .project({ eitjeIds: 1, allIdValues: 1, support_id: 1 })
    .toArray()

  for (const u of unified) {
    let ct: string | undefined
    if (u._id instanceof ObjectId) {
      ct = unifiedToMember.get(u._id.toHexString())
    }
    if (!ct && u.support_id != null) {
      for (const k of idKeys(u.support_id)) ct = byShiftId.get(k)
    }
    if (!ct) continue
    for (const x of (u.eitjeIds as unknown[] | undefined) ?? []) {
      for (const k of idKeys(x)) byShiftId.set(k, ct)
    }
    for (const x of (u.allIdValues as unknown[] | undefined) ?? []) {
      for (const k of idKeys(x)) byShiftId.set(k, ct)
    }
  }

  const index = { byShiftId, byName }
  cachedIndex = { builtAt: now, index }
  return index
}

export function invalidateWorkerContractIndexCache (): void {
  cachedIndex = null
}

function resolveContract (
  worker: { userId?: string; userName?: string; contractType?: string },
  index: ContractIndex,
): string {
  const existing = String(worker.contractType ?? '').trim()
  if (!isMissingContractType(existing) && classifyStaffContractType(existing)) {
    return existing
  }

  for (const k of idKeys(worker.userId)) {
    const ct = index.byShiftId.get(k)
    if (ct) return ct
  }

  const nm = normName(worker.userName)
  if (nm) {
    const ct = index.byName.get(nm)
    if (ct) return ct
  }

  return existing || '—'
}

/** Patch workers missing contractType using members SSOT (staff analytics read overlay). */
export function enrichLaborWorkersFromMembers (
  workers: DailyOpsSnapshotLaborSection['workers'] | undefined,
  index: ContractIndex,
): DailyOpsSnapshotLaborSection['workers'] {
  if (!Array.isArray(workers)) return workers
  return workers.map((w) => {
    const contractType = resolveContract(w, index)
    if (contractType === w.contractType) return w
    return { ...w, contractType }
  })
}

export async function buildWorkerContractIndex (db: Db): Promise<ContractIndex> {
  return buildContractIndex(db)
}
