/**
 * @registry-id: dailyOpsEitjeStaffHubGet
 * @created: 2026-05-11T17:50:00.000Z
 * @last-modified: 2026-05-11T17:50:00.000Z
 * @description: Lists deduped Eitje contract rows from inbox-eitje-contracts with member match hints
 * @last-fix: [2026-05-11] Initial — support_id/email/name confidence + pagination
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/eitje-staff.vue (GET hub data)
 */

import { getDb } from '../../utils/db'
import { ObjectId } from 'mongodb'

type MatchConfidence = 'high' | 'medium' | 'none'

export type EitjeStaffRow = {
  support_id: string
  employee_name: string
  contract_type: string
  contract_location: string
  startdatum: string | null
  einddatum: string | null
  hourly_rate: number | null
  cost_per_hour: number | null
  matched_member_id?: string
  match_confidence: MatchConfidence
}

function normStr(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function ymdFromValue(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10)
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  return null
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function dedupeKey(doc: Record<string, unknown>): string {
  const sid = String(doc.support_id ?? '').trim()
  if (sid) return `sid:${sid}`
  const name = normStr(doc.employee_name)
  const loc = normStr(doc.contract_location)
  return `nl:${name}|${loc}`
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const skip = Math.max(0, parseInt(String(query.skip ?? '0'), 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50))
    const search = normStr(query.search ?? '')
    const locationFilter = String(query.location ?? '').trim().toLowerCase()

    const db = await getDb()
    const raw = (await db
      .collection('inbox-eitje-contracts')
      .find({})
      .sort({ _id: -1 })
      .toArray()) as Record<string, unknown>[]

    const bestByKey = new Map<string, Record<string, unknown>>()
    for (const doc of raw) {
      const k = dedupeKey(doc)
      if (!bestByKey.has(k)) bestByKey.set(k, doc)
    }

    const members = (await db
      .collection('members')
      .find({})
      .project({ support_id: 1, email: 1, name: 1 })
      .toArray()) as {
      _id: ObjectId
      support_id?: string
      email?: string
      name?: string
    }[]

    const bySupport = new Map<string, { id: string }>()
    const byEmail = new Map<string, { id: string }>()
    const byName = new Map<string, { id: string }>()
    for (const m of members) {
      const id = String(m._id)
      const sup = String(m.support_id ?? '').trim()
      if (sup) bySupport.set(sup, { id })
      const em = String(m.email ?? '').trim().toLowerCase()
      if (em && !byEmail.has(em)) byEmail.set(em, { id })
      const nm = normStr(m.name)
      if (nm && !byName.has(nm)) byName.set(nm, { id })
    }

    const rows: EitjeStaffRow[] = []
    for (const doc of bestByKey.values()) {
      const employee_name = String(doc.employee_name ?? '').trim() || 'Unknown'
      const support_id = String(doc.support_id ?? '').trim()
      const contract_type = String(doc.contract_type ?? '').trim() || '—'
      const contract_location = String(doc.contract_location ?? '').trim() || '—'
      const startdatum = ymdFromValue(doc.start_date)
      const einddatum = ymdFromValue(doc.end_date)
      const hourly_rate = toNum(doc.hourly_rate)
      const cost_per_hour = toNum(doc.cost_per_hour)

      if (locationFilter && !normStr(contract_location).includes(locationFilter) && normStr(contract_location) !== locationFilter) {
        continue
      }
      if (search) {
        const hay = `${normStr(employee_name)} ${normStr(contract_location)} ${support_id.toLowerCase()}`
        if (!hay.includes(search)) continue
      }

      let match_confidence: MatchConfidence = 'none'
      let matched_member_id: string | undefined

      if (support_id && bySupport.has(support_id)) {
        match_confidence = 'high'
        matched_member_id = bySupport.get(support_id)!.id
      } else {
        const em = String(doc.email ?? '').trim().toLowerCase()
        if (em && byEmail.has(em)) {
          match_confidence = 'medium'
          matched_member_id = byEmail.get(em)!.id
        } else {
          const nm = normStr(employee_name)
          if (nm && byName.has(nm)) {
            match_confidence = 'medium'
            matched_member_id = byName.get(nm)!.id
          }
        }
      }

      rows.push({
        support_id: support_id || '—',
        employee_name,
        contract_type,
        contract_location,
        startdatum,
        einddatum,
        hourly_rate,
        cost_per_hour,
        ...(matched_member_id ? { matched_member_id } : {}),
        match_confidence,
      })
    }

    rows.sort((a, b) => {
      const order = { none: 0, medium: 1, high: 2 }
      if (order[a.match_confidence] !== order[b.match_confidence]) {
        return order[a.match_confidence] - order[b.match_confidence]
      }
      return a.employee_name.localeCompare(b.employee_name, 'nl')
    })

    const total = rows.length
    const matched = rows.filter((r) => r.match_confidence !== 'none').length
    const unmatched = total - matched
    const distinct_contract_locations = [
      ...new Set(rows.map((r) => r.contract_location.trim()).filter((s) => s && s !== '—')),
    ].sort((a, b) => a.localeCompare(b, 'nl'))
    const page = rows.slice(skip, skip + limit)

    return {
      success: true as const,
      data: page,
      pagination: { skip, limit, total },
      summary: {
        total_staff: total,
        matched,
        unmatched,
        distinct_contract_locations,
      },
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load Eitje staff',
    })
  }
})
