/**
 * @description: Fill missing wage/loaded costs on Eitje agg (or snapshot worker) rows from members.
 * Used when aggregation was built without a linked hourly rate (e.g. ZZP on support_id only).
 */

import type { Db } from 'mongodb'
import { resolveCostPerHour, toNum } from './memberCompensationRevisions'
import {
  isLeerlingEmployee,
  resolveLeerlingInboxWages,
} from '../../utils/dailyOpsLeerlingWageFallback'

export type MemberCompensationHit = {
  contractType: string
  hourlyRate: number
  costPerHour: number
}

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function normPersonName (name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function escapeRegex (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hitFromMemberDoc (m: Record<string, unknown>): MemberCompensationHit | null {
  const name = String(m.name ?? '')
  const contractType = String(m.contract_type ?? '').trim()
  let hourlyRate = toNum(m.hourly_rate) ?? toNum(m.hourly_wage)
  let costPerHour = toNum(m.cost_per_hour)

  const overig = m.overig != null ? String(m.overig).trim() : null
  const leerling = resolveLeerlingInboxWages(name, contractType, hourlyRate, costPerHour, overig)
  if (leerling) {
    hourlyRate = leerling.hourly_rate
    costPerHour = leerling.cost_per_hour
  } else if (hourlyRate == null) {
    return null
  } else {
    costPerHour = resolveCostPerHour(contractType, hourlyRate, costPerHour) ?? hourlyRate
  }

  return { contractType, hourlyRate: hourlyRate!, costPerHour: costPerHour ?? hourlyRate! }
}

/** Map shift userId → compensation (support_id, eitje_id, eitje_ids). */
export async function loadMemberCompensationByShiftUserIds (
  db: Db,
  userIds: string[],
): Promise<Map<string, MemberCompensationHit>> {
  const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return new Map()

  const members = await db
    .collection('members')
    .find({
      $or: [
        { support_id: { $in: ids } },
        { eitje_id: { $in: ids } },
        { eitje_ids: { $in: ids } },
      ],
    })
    .project({
      name: 1,
      support_id: 1,
      eitje_id: 1,
      eitje_ids: 1,
      hourly_rate: 1,
      hourly_wage: 1,
      cost_per_hour: 1,
      contract_type: 1,
      overig: 1,
    })
    .toArray()

  const map = new Map<string, MemberCompensationHit>()
  for (const raw of members) {
    const hit = hitFromMemberDoc(raw as Record<string, unknown>)
    if (!hit) continue
    const keys = new Set<string>()
    const sid = raw.support_id != null ? String(raw.support_id).trim() : ''
    if (sid) keys.add(sid)
    const eid = raw.eitje_id != null ? String(raw.eitje_id).trim() : ''
    if (eid) keys.add(eid)
    for (const x of (raw.eitje_ids as unknown[] | undefined) ?? []) {
      const s = String(x).trim()
      if (s) keys.add(s)
    }
    for (const k of keys) map.set(k, hit)
  }
  return map
}

/** Fallback when shift userId ≠ member support_id / eitje_id (e.g. Lars 33320 vs 123647). */
export async function loadMemberCompensationByNames (
  db: Db,
  names: string[],
): Promise<Map<string, MemberCompensationHit>> {
  const norms = [...new Set(names.map(normPersonName).filter(Boolean))]
  if (norms.length === 0) return new Map()

  const members = await db
    .collection('members')
    .find({
      $or: norms.map((n) => ({
        name: { $regex: new RegExp(`^${escapeRegex(n).replace(/\s+/g, '\\s+')}$`, 'i') },
      })),
    })
    .project({
      name: 1,
      hourly_rate: 1,
      hourly_wage: 1,
      cost_per_hour: 1,
      contract_type: 1,
      overig: 1,
    })
    .toArray()

  const map = new Map<string, MemberCompensationHit>()
  for (const raw of members) {
    const hit = hitFromMemberDoc(raw as Record<string, unknown>)
    if (!hit) continue
    const key = normPersonName(String((raw as Record<string, unknown>).name ?? ''))
    if (key) map.set(key, hit)
  }
  return map
}

export type MemberCompensationLookup = {
  byUserId: Map<string, MemberCompensationHit>
  byName: Map<string, MemberCompensationHit>
}

/** Member wages for check-ins / active staff (userId + name fallback). */
export async function loadMemberCompensationForStaffRows (
  db: Db,
  rows: Array<{ userId: string; userName: string }>,
): Promise<MemberCompensationLookup> {
  const [byUserId, byName] = await Promise.all([
    loadMemberCompensationByShiftUserIds(db, rows.map((r) => r.userId)),
    loadMemberCompensationByNames(db, rows.map((r) => r.userName)),
  ])
  return { byUserId, byName }
}

export function resolveMemberCompensationHit (
  userId: string,
  userName: string,
  lookup: MemberCompensationLookup,
): MemberCompensationHit | undefined {
  const byId = lookup.byUserId.get(userId.trim())
  if (byId) return byId
  const norm = normPersonName(userName)
  return norm ? lookup.byName.get(norm) : undefined
}

function rowNeedsEnrichment (row: Record<string, unknown>): boolean {
  const hours = Number(row.total_hours ?? row.hours ?? 0)
  if (hours <= 0) return false
  const wages = Number(row.total_cost ?? row.wage_cost ?? 0)
  const loaded = Number(row.total_cost_loaded ?? row.loaded_cost ?? 0)
  return wages <= 0 || loaded <= 0
}

function applyCompensationToRow (
  row: Record<string, unknown>,
  comp: MemberCompensationHit,
): void {
  const hours = Number(row.total_hours ?? row.hours ?? 0)
  if (hours <= 0) return

  const rowCph = toNum(row.cost_per_hour)
  const costPerHour = rowCph ?? comp.costPerHour
  row.hourly_rate = comp.hourlyRate
  row.cost_per_hour = costPerHour
  const wages = round2(hours * comp.hourlyRate)
  const loaded = round2(hours * costPerHour)

  if ('total_cost' in row || row.total_hours != null) {
    row.total_cost = wages
    row.total_cost_loaded = loaded
  }
  if ('wage_cost' in row || row.hours != null) {
    row.wage_cost = wages
    row.loaded_cost = loaded
    row.loaded_cost_fallback = false
  }

  const gewHours = Number(row.gewerkt_hours ?? 0)
  if (gewHours > 0) {
    row.gewerkt_cost = round2(gewHours * comp.hourlyRate)
    row.gewerkt_cost_loaded = round2(gewHours * comp.costPerHour)
  }
}

function applyLeerlingFallbackToRow(row: Record<string, unknown>): boolean {
  const userName = String(row.user_name ?? row.userName ?? '')
  const overig = row.overig != null ? String(row.overig).trim() : null
  if (!isLeerlingEmployee(userName, overig)) return false
  const contractType = String(row.contract_type ?? row.team_name ?? 'uren contract')
  const leerling = resolveLeerlingInboxWages(
    userName,
    contractType,
    toNum(row.hourly_rate),
    toNum(row.cost_per_hour ?? row.total_cost_loaded),
    overig,
  )
  if (!leerling) return false
  applyCompensationToRow(row, {
    contractType,
    hourlyRate: leerling.hourly_rate,
    costPerHour: leerling.cost_per_hour,
  })
  return true
}

/** Mutates rows in place when hours exist but wages/rate are missing. */
export async function enrichEitjeAggRowsFromMembers (
  db: Db,
  rows: Record<string, unknown>[],
): Promise<void> {
  const need = rows.filter(rowNeedsEnrichment)
  if (need.length === 0) return

  const map = await loadMemberCompensationByShiftUserIds(
    db,
    need.map((r) => String(r.userId ?? '')),
  )

  const stillNeed: Record<string, unknown>[] = []
  for (const row of need) {
    const comp = map.get(String(row.userId ?? '').trim())
    if (comp) applyCompensationToRow(row, comp)
    else stillNeed.push(row)
  }

  if (stillNeed.length === 0) return

  const byName = await loadMemberCompensationByNames(
    db,
    stillNeed.map((r) => String(r.user_name ?? '')),
  )
  const afterName: Record<string, unknown>[] = []
  for (const row of stillNeed) {
    const comp = byName.get(normPersonName(String(row.user_name ?? '')))
    if (comp) applyCompensationToRow(row, comp)
    else afterName.push(row)
  }

  for (const row of afterName) {
    applyLeerlingFallbackToRow(row)
  }
}

export async function enrichSnapshotLaborWorkersFromMembers (
  db: Db,
  workers: Array<Record<string, unknown>> | undefined,
): Promise<void> {
  if (!workers?.length) return
  const need = workers.filter(rowNeedsEnrichment) as Record<string, unknown>[]
  if (need.length === 0) return

  const map = await loadMemberCompensationByShiftUserIds(
    db,
    need.map((w) => String(w.userId ?? '')),
  )

  const stillNeed: Record<string, unknown>[] = []
  for (const w of need) {
    const comp = map.get(String(w.userId ?? '').trim())
    if (comp) applyCompensationToRow(w, comp)
    else stillNeed.push(w)
  }

  if (stillNeed.length === 0) return

  const byName = await loadMemberCompensationByNames(
    db,
    stillNeed.map((w) => String(w.user_name ?? '')),
  )
  for (const w of stillNeed) {
    const comp = byName.get(normPersonName(String(w.user_name ?? '')))
    if (comp) applyCompensationToRow(w, comp)
    else applyLeerlingFallbackToRow(w)
  }
}
