/**
 * @registry-id: memberBorkContext
 * @created: 2026-05-19T12:00:00.000Z
 * @last-modified: 2026-05-19T14:00:00.000Z
 * @description: Bork sales rollups per unified_user / member (bork_sales_by_worker)
 * @last-fix: [2026-05-19] Read-time bork_unified_user_mapping + link suggestions
 *
 * @architecture-ref: ARCHITECTURE.md#4-canonical-entities
 * @adr-ref: ADR-003
 *
 * @exports-to:
 * ✓ server/api/daily-ops/bork-staff.get.ts
 * ✓ server/api/daily-ops/bork-staff/link.post.ts
 * ✓ server/api/members/[id].get.ts
 */

import { ObjectId, type Db } from 'mongodb'
import { amsterdamYmdForOffset } from '~/utils/inbox/importTableQuickDates'
import { listBorkAggReadSuffixCandidates, resolveBorkAggReadSuffix } from './borkAggVersionSuffix'
import {
  fetchAggregationActivityByLocationTeam,
  resolveEitjeAggregationUserCandidates,
} from './memberEitjeContext'
import {
  borkNamesForUnifiedUser,
  loadBorkUserMappingIndex,
  resolveBorkWorkerLink,
  type BorkMemberSuggestion,
  type BorkUnifiedUserSuggestion,
} from './borkUserLinking'

export type BorkStaffDateRange = { range_start: string; range_end: string }

export type BorkLocationBreakdown = {
  location_id: string
  location_name: string
  total_sales_ex_vat: number
  days_active: number
  total_quantity: number
}

export type MemberBorkSalesContext = {
  range_start: string
  range_end: string
  collection_suffix: string | null
  totals: {
    total_sales_ex_vat: number
    days_active: number
    avg_sales_per_day: number | null
    total_quantity: number
    worked_hours: number | null
    productivity_per_hour: number | null
  }
  by_location: BorkLocationBreakdown[]
}

export type BorkStaffLinkStatus =
  | 'linked'
  | 'unified_no_member'
  | 'suggested'
  | 'unmapped'

export type BorkStaffHubRow = {
  worker_key: string
  worker_id: string
  /** Raw Bork POS name from aggregates */
  bork_user_name: string
  worker_name: string
  unified_user_id?: string
  matched_member_id?: string
  match_confidence: 'high' | 'none'
  link_status: BorkStaffLinkStatus
  is_unmapped: boolean
  from_bork_mapping: boolean
  needs_rebuild: boolean
  suggestion?: BorkUnifiedUserSuggestion
  member_suggestion?: BorkMemberSuggestion
  total_sales_ex_vat: number
  avg_sales_per_day: number | null
  days_active: number
  location_count: number
  locations: string[]
  total_quantity: number
  worked_hours: number | null
  productivity_per_hour: number | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function lineRevenueEx(doc: Record<string, unknown>): number {
  const ex = Number(doc.total_revenue_ex_vat)
  if (Number.isFinite(ex) && ex > 0) return ex
  const legacy = Number(doc.total_revenue)
  return Number.isFinite(legacy) ? legacy : 0
}

function normStr(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function normalizeBorkStaffDateRange(
  startDate?: string,
  endDate?: string
): BorkStaffDateRange {
  const yesterday = amsterdamYmdForOffset(-1)
  const thirtyBeforeYesterday = amsterdamYmdForOffset(-30)
  if (!startDate && !endDate) {
    return { range_start: thirtyBeforeYesterday, range_end: yesterday }
  }
  if (startDate && !endDate) return { range_start: startDate, range_end: yesterday }
  if (!startDate && endDate) {
    const e = new Date(`${endDate}T12:00:00Z`)
    const s = new Date(e.getTime() - 29 * 24 * 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const start = `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`
    return { range_start: start, range_end: endDate }
  }
  return { range_start: startDate!, range_end: endDate! }
}

export function monthsBackToBorkRange(monthsBack: number): BorkStaffDateRange {
  const end = amsterdamYmdForOffset(-1)
  const months = Math.max(1, Math.min(36, Math.floor(monthsBack) || 12))
  const [y, m, d] = end.split('-').map(Number)
  const endDt = new Date(Date.UTC(y, m - 1, d))
  const startDt = new Date(endDt)
  startDt.setUTCMonth(startDt.getUTCMonth() - months)
  const pad = (n: number) => String(n).padStart(2, '0')
  const range_start = `${startDt.getUTCFullYear()}-${pad(startDt.getUTCMonth() + 1)}-${pad(startDt.getUTCDate())}`
  return { range_start, range_end: end }
}

async function resolveWorkerCollection(db: Db): Promise<{ name: string; suffix: string }> {
  const candidates = listBorkAggReadSuffixCandidates()
  for (const suffix of candidates) {
    const name = `bork_sales_by_worker${suffix}`
    const n = await db.collection(name).estimatedDocumentCount()
    if (n > 0) return { name, suffix }
  }
  const suffix = resolveBorkAggReadSuffix()
  return { name: `bork_sales_by_worker${suffix}`, suffix }
}

function workerGroupKey(workerId: unknown, workerName: unknown): string {
  const id = String(workerId ?? '').trim()
  const name = String(workerName ?? '').trim() || 'Unknown'
  if (!id || id === 'unknown') return `unknown:${normStr(name)}`
  return id
}

function isValidUnifiedObjectId(id: string): boolean {
  return /^[0-9a-f]{24}$/i.test(id)
}

export async function fetchMemberWorkedHoursInRange(
  db: Db,
  options: {
    supportId?: string
    userName: string
    range: BorkStaffDateRange
  }
): Promise<number> {
  const userIdCandidates = await resolveEitjeAggregationUserCandidates(
    db,
    options.supportId,
    options.userName
  )
  const rows = await fetchAggregationActivityByLocationTeam(
    db,
    'eitje_time_registration_aggregation',
    {
      userIdCandidates,
      userName: options.userName,
      range: options.range,
    }
  )
  const total = rows.reduce((s, r) => s + r.total_hours, 0)
  return round2(total)
}

function productivityPerHour(revenue: number, hours: number | null): number | null {
  if (hours == null || hours <= 0 || !Number.isFinite(revenue)) return null
  return round2(revenue / hours)
}

type AggRow = {
  worker_key: string
  worker_id: string
  worker_name: string
  is_unmapped: boolean
  total_sales_ex_vat: number
  total_quantity: number
  days_active: number
  locations: string[]
}

async function aggregateWorkerSales(
  db: Db,
  collectionName: string,
  range: BorkStaffDateRange,
  locationId?: string
): Promise<AggRow[]> {
  const match: Record<string, unknown> = {
    business_date: { $gte: range.range_start, $lte: range.range_end },
  }
  if (locationId && locationId !== 'all') {
    try {
      match.locationId = new ObjectId(locationId)
    } catch {
      match.locationId = locationId
    }
  }

  const raw = await db
    .collection(collectionName)
    .find(match, {
      projection: {
        workerId: 1,
        workerName: 1,
        locationName: 1,
        business_date: 1,
        total_revenue_ex_vat: 1,
        total_revenue: 1,
        total_quantity: 1,
      },
    })
    .toArray()

  const byKey = new Map<
    string,
    {
      worker_id: string
      worker_name: string
      is_unmapped: boolean
      revenue: number
      quantity: number
      days: Set<string>
      locations: Set<string>
    }
  >()

  for (const doc of raw) {
    const d = doc as Record<string, unknown>
    const rev = lineRevenueEx(d)
    if (rev <= 0) continue
    const workerId = String(d.workerId ?? 'unknown').trim() || 'unknown'
    const workerName = String(d.workerName ?? 'Unknown').trim() || 'Unknown'
    const key = workerGroupKey(workerId, workerName)
    const isUnmapped = workerId === 'unknown' || !isValidUnifiedObjectId(workerId)
    const businessDate = String(d.business_date ?? '').trim()
    const locName = String(d.locationName ?? '').trim()

    let bucket = byKey.get(key)
    if (!bucket) {
      bucket = {
        worker_id: isUnmapped ? 'unknown' : workerId,
        worker_name: workerName,
        is_unmapped: isUnmapped,
        revenue: 0,
        quantity: 0,
        days: new Set<string>(),
        locations: new Set<string>(),
      }
      byKey.set(key, bucket)
    }
    bucket.revenue += rev
    bucket.quantity += Number(d.total_quantity ?? 0) || 0
    if (businessDate) bucket.days.add(businessDate)
    if (locName) bucket.locations.add(locName)
  }

  const out: AggRow[] = []
  for (const [worker_key, b] of byKey) {
    out.push({
      worker_key,
      worker_id: b.worker_id,
      worker_name: b.worker_name,
      is_unmapped: b.is_unmapped,
      total_sales_ex_vat: round2(b.revenue),
      total_quantity: Math.round(b.quantity),
      days_active: b.days.size,
      locations: [...b.locations].sort((a, b) => a.localeCompare(b, 'nl')),
    })
  }
  return out
}

export async function fetchMemberBorkSales(
  db: Db,
  options: {
    unifiedUserId: ObjectId
    monthsBack?: number
    range?: BorkStaffDateRange
  }
): Promise<MemberBorkSalesContext | null> {
  const range = options.range ?? monthsBackToBorkRange(options.monthsBack ?? 12)
  const { name: collectionName, suffix } = await resolveWorkerCollection(db)
  const uidStr = String(options.unifiedUserId)
  const borkNames = await borkNamesForUnifiedUser(db, options.unifiedUserId)
  const workerOr: Record<string, unknown>[] = [
    { workerId: { $in: [options.unifiedUserId, uidStr] } },
  ]
  if (borkNames.length > 0) {
    workerOr.push({ workerName: { $in: borkNames } })
  }

  const workerMatch: Record<string, unknown> = {
    business_date: { $gte: range.range_start, $lte: range.range_end },
    $or: workerOr,
  }

  const raw = await db
    .collection(collectionName)
    .find(workerMatch, {
      projection: {
        locationId: 1,
        locationName: 1,
        business_date: 1,
        total_revenue_ex_vat: 1,
        total_revenue: 1,
        total_quantity: 1,
      },
    })
    .toArray()

  if (raw.length === 0) return null

  const byLoc = new Map<
    string,
    { location_id: string; location_name: string; revenue: number; quantity: number; days: Set<string> }
  >()
  let totalRevenue = 0
  let totalQty = 0
  const allDays = new Set<string>()

  for (const doc of raw) {
    const d = doc as Record<string, unknown>
    const rev = lineRevenueEx(d)
    if (rev <= 0) continue
    totalRevenue += rev
    totalQty += Number(d.total_quantity ?? 0) || 0
    const bd = String(d.business_date ?? '').trim()
    if (bd) allDays.add(bd)
    const locId = String(d.locationId ?? 'unknown')
    const locName = String(d.locationName ?? 'Unknown').trim() || 'Unknown'
    let row = byLoc.get(locId)
    if (!row) {
      row = { location_id: locId, location_name: locName, revenue: 0, quantity: 0, days: new Set() }
      byLoc.set(locId, row)
    }
    row.revenue += rev
    row.quantity += Number(d.total_quantity ?? 0) || 0
    if (bd) row.days.add(bd)
  }

  if (totalRevenue <= 0) return null

  const by_location: BorkLocationBreakdown[] = [...byLoc.values()]
    .map((r) => ({
      location_id: r.location_id,
      location_name: r.location_name,
      total_sales_ex_vat: round2(r.revenue),
      days_active: r.days.size,
      total_quantity: Math.round(r.quantity),
    }))
    .sort((a, b) => b.total_sales_ex_vat - a.total_sales_ex_vat)

  const days_active = allDays.size
  const total_sales_ex_vat = round2(totalRevenue)

  return {
    range_start: range.range_start,
    range_end: range.range_end,
    collection_suffix: suffix || null,
    totals: {
      total_sales_ex_vat,
      days_active,
      avg_sales_per_day: days_active > 0 ? round2(total_sales_ex_vat / days_active) : null,
      total_quantity: Math.round(totalQty),
      worked_hours: null,
      productivity_per_hour: null,
    },
    by_location,
  }
}

export async function enrichMemberBorkWithProductivity(
  db: Db,
  bork: MemberBorkSalesContext,
  options: { supportId?: string; userName: string }
): Promise<MemberBorkSalesContext> {
  const range = { range_start: bork.range_start, range_end: bork.range_end }
  const worked = await fetchMemberWorkedHoursInRange(db, {
    supportId: options.supportId,
    userName: options.userName,
    range,
  })
  const hours = worked > 0 ? worked : null
  return {
    ...bork,
    totals: {
      ...bork.totals,
      worked_hours: hours,
      productivity_per_hour: productivityPerHour(bork.totals.total_sales_ex_vat, hours),
    },
  }
}

export async function fetchBorkStaffHubRows(
  db: Db,
  options: {
    range: BorkStaffDateRange
    locationId?: string
    search?: string
    includeUnmapped?: boolean
  }
): Promise<{ rows: BorkStaffHubRow[]; collection_suffix: string | null }> {
  const { name: collectionName, suffix } = await resolveWorkerCollection(db)
  const agg = await aggregateWorkerSales(db, collectionName, options.range, options.locationId)
  const mappingIndex = await loadBorkUserMappingIndex(db)

  const members = (await db
    .collection('members')
    .find({})
    .project({ unified_user_id: 1, name: 1 })
    .toArray()) as { _id: ObjectId; unified_user_id?: ObjectId; name?: string }[]

  const memberByUnified = new Map<string, { memberId: string; name: string }>()
  for (const m of members) {
    if (m.unified_user_id instanceof ObjectId) {
      memberByUnified.set(String(m.unified_user_id), {
        memberId: String(m._id),
        name: typeof m.name === 'string' ? m.name.trim() : '',
      })
    }
  }

  const search = normStr(options.search ?? '')
  const includeUnmapped = options.includeUnmapped === true

  let rows: BorkStaffHubRow[] = []
  for (const r of agg) {
    const link = await resolveBorkWorkerLink(db, {
      borkUserName: r.worker_name,
      storedWorkerId: r.worker_id,
      mappingIndex,
      memberByUnified,
    })

    if (
      !includeUnmapped &&
      r.is_unmapped &&
      !link.from_bork_mapping &&
      !link.effective_unified_user_id &&
      !link.suggestion
    ) {
      continue
    }

    const unified_user_id = link.effective_unified_user_id
    const matched_member_id =
      link.matched_member_id ?? link.member_suggestion?.member_id
    const displayName =
      link.effective_unified_user_name ||
      link.suggestion?.name ||
      r.worker_name

    let link_status: BorkStaffLinkStatus = 'unmapped'
    if (unified_user_id && matched_member_id) link_status = 'linked'
    else if (unified_user_id) link_status = 'unified_no_member'
    else if (link.suggestion) link_status = 'suggested'

    const needs_rebuild =
      link.from_bork_mapping &&
      r.is_unmapped &&
      !link.from_stored_worker_id

    const days = r.days_active
    rows.push({
      worker_key: r.worker_key,
      worker_id: r.worker_id,
      bork_user_name: r.worker_name,
      worker_name: displayName,
      ...(unified_user_id ? { unified_user_id } : {}),
      ...(matched_member_id ? { matched_member_id } : {}),
      match_confidence: matched_member_id && link.matched_member_id ? 'high' : 'none',
      link_status,
      is_unmapped: r.is_unmapped && !link.from_bork_mapping,
      from_bork_mapping: link.from_bork_mapping,
      needs_rebuild,
      ...(link.suggestion ? { suggestion: link.suggestion } : {}),
      ...(link.member_suggestion && !link.matched_member_id
        ? { member_suggestion: link.member_suggestion }
        : {}),
      total_sales_ex_vat: r.total_sales_ex_vat,
      avg_sales_per_day: days > 0 ? round2(r.total_sales_ex_vat / days) : null,
      days_active: days,
      location_count: r.locations.length,
      locations: r.locations,
      total_quantity: r.total_quantity,
      worked_hours: null,
      productivity_per_hour: null,
    })
  }

  if (search) {
    rows = rows.filter((r) => {
      const hay = `${normStr(r.worker_name)} ${normStr(r.worker_id)} ${r.locations.join(' ').toLowerCase()}`
      return hay.includes(search)
    })
  }

  rows.sort((a, b) => {
    if (a.is_unmapped !== b.is_unmapped) return a.is_unmapped ? 1 : -1
    if (a.match_confidence !== b.match_confidence) {
      return a.match_confidence === 'high' ? -1 : 1
    }
    return b.total_sales_ex_vat - a.total_sales_ex_vat
  })

  return { rows, collection_suffix: suffix || null }
}

/** Productivity (€/h) for a page of hub rows — only matched members. */
export async function enrichBorkStaffRowsProductivity(
  db: Db,
  rows: BorkStaffHubRow[],
  range: BorkStaffDateRange
): Promise<void> {
  const memberIds = [...new Set(rows.map((r) => r.matched_member_id).filter(Boolean))] as string[]
  if (memberIds.length === 0) return

  const memberFull = await db
    .collection('members')
    .find({ _id: { $in: memberIds.map((id) => new ObjectId(id)) } })
    .project({ support_id: 1, name: 1 })
    .toArray()

  const memberEnrich = new Map<string, { supportId?: string; name: string }>()
  for (const m of memberFull) {
    memberEnrich.set(String(m._id), {
      supportId: typeof m.support_id === 'string' ? m.support_id : undefined,
      name: typeof m.name === 'string' && m.name.trim() ? m.name : 'Unknown',
    })
  }

  await Promise.all(
    rows
      .filter((r) => r.matched_member_id)
      .map(async (r) => {
        const info = memberEnrich.get(r.matched_member_id!)
        if (!info) return
        const hours = await fetchMemberWorkedHoursInRange(db, {
          supportId: info.supportId,
          userName: info.name,
          range,
        })
        r.worked_hours = hours > 0 ? hours : null
        r.productivity_per_hour = productivityPerHour(r.total_sales_ex_vat, r.worked_hours)
      })
  )
}
