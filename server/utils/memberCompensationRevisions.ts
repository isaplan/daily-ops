/**
 * @registry-id: memberCompensationRevisions
 * @created: 2026-05-16T12:00:00.000Z
 * @last-modified: 2026-05-18T12:00:00.000Z
 * @description: Open/close compensation revision intervals on members (forward-only, idempotent)
 * @last-fix: [2026-05-18] ZZP: cost_per_hour = hourly_rate only (ignore inbox Loonkosten)
 *
 * @architecture-ref: ARCHITECTURE.md#5-business-rules
 * @adr-ref: ADR-001, ADR-002, ADR-005
 *
 * @exports-to:
 * ✓ server/services/dataMappingService.ts
 * ✓ server/api/members/[id].put.ts
 */

import { ObjectId, type Db } from 'mongodb'
import type {
  CompensationCostModel,
  CompensationMaterialFields,
  CompensationRevision,
  CompensationRevisionSource,
  CompensationStatus,
} from '../../types/member-compensation'

const NUL_UREN_RATIO = 1.36

export function isNulUrenContract(contractType: string): boolean {
  return /nul\s*uren/i.test(String(contractType ?? ''))
}

export function isZzpContract(contractType: string): boolean {
  return /zzp/i.test(String(contractType ?? ''))
}

export function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function resolveCostModel(
  contractType: string,
  hourlyRate: number | null,
  costPerHour: number | null
): CompensationCostModel {
  if (isZzpContract(contractType) && hourlyRate != null) return 'zzp_invoice'
  if (costPerHour != null) return 'stored_cph'
  if (isNulUrenContract(contractType) && hourlyRate != null) return 'nul_uren_1_36'
  return 'manual'
}

export function resolveCostPerHour(
  contractType: string,
  hourlyRate: number | null,
  costPerHour: number | null
): number | null {
  if (isZzpContract(contractType)) return hourlyRate
  if (costPerHour != null) return costPerHour
  if (isNulUrenContract(contractType) && hourlyRate != null) return hourlyRate * NUL_UREN_RATIO
  return hourlyRate
}

export function compensationStatusFromFields(
  contractType: string,
  hourlyRate: number | null,
  costPerHour: number | null
): CompensationStatus {
  const ct = contractType.trim()
  if (!ct) return 'missing'
  const resolved = resolveCostPerHour(contractType, hourlyRate, costPerHour)
  if (resolved == null) return 'missing'
  return 'ok'
}

export function materialFieldsChanged(
  prev: CompensationMaterialFields | null,
  next: CompensationMaterialFields
): boolean {
  if (!prev) return true
  if (prev.contract_type.trim() !== next.contract_type.trim()) return true
  const prevHr = prev.hourly_rate
  const nextHr = next.hourly_rate
  if (prevHr !== nextHr && !(prevHr != null && nextHr != null && Math.abs(prevHr - nextHr) < 0.001)) {
    return true
  }
  const prevCph = prev.cost_per_hour
  const nextCph = next.cost_per_hour
  if (prevCph !== nextCph && !(prevCph != null && nextCph != null && Math.abs(prevCph - nextCph) < 0.001)) {
    return true
  }
  return false
}

function latestOpenRevision(history: CompensationRevision[] | undefined): CompensationRevision | null {
  if (!history?.length) return null
  const open = history.filter((r) => r.effective_to == null)
  if (!open.length) return history[history.length - 1] ?? null
  return open.sort((a, b) => b.effective_from.getTime() - a.effective_from.getTime())[0] ?? null
}

export function effectiveFromFromInboxRow(row: Record<string, unknown>, importedAt: Date): Date {
  const candidates = [
    row.start_date,
    row.contract_start_date,
    row.startdatum,
  ]
  for (const c of candidates) {
    if (c instanceof Date && !Number.isNaN(c.getTime())) return c
    if (typeof c === 'string' && c.trim()) {
      const d = new Date(c)
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  return importedAt
}

export type OpenRevisionInput = CompensationMaterialFields & {
  cost_model?: CompensationCostModel
}

export async function openNewRevision(
  db: Db,
  memberId: ObjectId,
  next: OpenRevisionInput,
  source: CompensationRevisionSource,
  asOf: Date,
  sourceRef?: string
): Promise<{ changed: boolean; revision: CompensationRevision | null }> {
  const member = await db.collection('members').findOne({ _id: memberId })
  if (!member) return { changed: false, revision: null }

  const history = (member.compensationHistory as CompensationRevision[] | undefined) ?? []
  const prevOpen = latestOpenRevision(history)
  const contractType = String(next.contract_type ?? '').trim() || '—'
  const hourlyRate = toNum(next.hourly_rate)
  const rawCph = toNum(next.cost_per_hour)
  const costPerHour = resolveCostPerHour(contractType, hourlyRate, rawCph)
  const costModel = next.cost_model ?? resolveCostModel(contractType, hourlyRate, rawCph)

  const material: CompensationMaterialFields = {
    contract_type: contractType,
    hourly_rate: hourlyRate,
    cost_per_hour: costPerHour,
  }

  if (prevOpen && !materialFieldsChanged(
    {
      contract_type: prevOpen.contract_type,
      hourly_rate: prevOpen.hourly_rate,
      cost_per_hour: prevOpen.cost_per_hour,
    },
    material
  )) {
    return { changed: false, revision: prevOpen }
  }

  const now = new Date()
  const revision: CompensationRevision = {
    effective_from: asOf,
    effective_to: null,
    contract_type: contractType,
    hourly_rate: hourlyRate,
    cost_per_hour: costPerHour,
    cost_model: costModel,
    source,
    source_ref: sourceRef,
    created_at: now,
  }

  const status = compensationStatusFromFields(contractType, hourlyRate, costPerHour)

  const setFields: Record<string, unknown> = {
    contract_type: contractType,
    compensation_status: status,
    updated_at: now,
  }
  if (hourlyRate != null) setFields.hourly_rate = hourlyRate
  if (costPerHour != null) setFields.cost_per_hour = costPerHour

  const update: Record<string, unknown> = {
    $set: setFields,
    $push: { compensationHistory: revision },
  }

  if (prevOpen) {
    setFields['compensationHistory.$[open].effective_to'] = asOf
  }

  await db.collection('members').updateOne(
    { _id: memberId },
    update,
    prevOpen ? { arrayFilters: [{ 'open.effective_to': null }] } : undefined
  )

  return { changed: true, revision }
}

export async function findMemberIdBySupportId(db: Db, supportId: string): Promise<ObjectId | null> {
  const sid = supportId.trim()
  if (!sid) return null
  const m = await db.collection('members').findOne(
    { support_id: sid },
    { projection: { _id: 1 } }
  )
  return m?._id instanceof ObjectId ? m._id : null
}

export async function applyContractInboxRowToMember(
  db: Db,
  row: Record<string, unknown>
): Promise<{ memberId: ObjectId | null; changed: boolean }> {
  const supportId = row.support_id != null ? String(row.support_id).trim() : ''
  let memberId = supportId ? await findMemberIdBySupportId(db, supportId) : null

  if (!memberId) {
    const name = String(row.employee_name ?? '').trim()
    if (name) {
      const byName = await db.collection('members').findOne(
        { name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { projection: { _id: 1 } }
      )
      if (byName?._id instanceof ObjectId) memberId = byName._id
    }
  }

  if (!memberId) return { memberId: null, changed: false }

  const importedAt = row.importedAt instanceof Date ? row.importedAt : new Date()
  const asOf = effectiveFromFromInboxRow(row, importedAt)
  const contractType = String(row.contract_type ?? '').trim()
  const hourlyRate = toNum(row.hourly_rate)
  const costPerHour = toNum(row.cost_per_hour)
  const sourceRef = row._id != null ? String(row._id) : undefined

  const { changed } = await openNewRevision(
    db,
    memberId,
    { contract_type: contractType, hourly_rate: hourlyRate, cost_per_hour: costPerHour },
    'inbox_eitje_contract',
    asOf,
    sourceRef
  )

  return { memberId, changed }
}
