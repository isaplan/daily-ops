/**
 * @registry-id: dailyOpsEitjeStaffHubGet
 * @created: 2026-05-11T17:50:00.000Z
 * @last-modified: 2026-05-12T01:00:00.000Z
 * @description: Lists deduped Eitje contract rows from inbox-eitje-contracts with member match hints
 * @last-fix: [2026-05-18] ZZP rows: cost_per_hour = hourly_rate only
 *
 * @adr-ref: ADR-001
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/eitje-staff.vue (GET hub data)
 */

import { getDb } from '../../utils/db'
import { ObjectId } from 'mongodb'
import {
  compensationStatusFromFields,
  isNulUrenContract,
  isZzpContract,
} from '../../utils/memberCompensationRevisions'

type MatchConfidence = 'high' | 'medium' | 'none'

export type EitjeStaffRow = {
  support_ids: string[]
  employee_name: string
  contract_type: string
  contract_location: string
  startdatum: string | null
  einddatum: string | null
  hourly_rate: number | null
  cost_per_hour: number | null
  matched_member_id?: string
  match_confidence: MatchConfidence
  /** From members SSOT when matched (ADR-001) */
  compensation_status?: 'ok' | 'missing'
}

function normStr(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** YYYY-MM-DD using local calendar (matches parseDate DD/MM/YYYY → local Date). */
function ymdFromValue(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof v === 'string' && v.trim()) {
    const ddmmyyyy = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy
      return `${year}-${month}-${day}`
    }
    const dt = new Date(v)
    if (!Number.isNaN(dt.getTime())) {
      const y = dt.getFullYear()
      const m = String(dt.getMonth() + 1).padStart(2, '0')
      const d = String(dt.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  return null
}

function ymdStartFromDoc(doc: Record<string, unknown>): string | null {
  return (
    ymdFromValue(doc.start_date)
    ?? ymdFromValue(doc.contract_start_date)
    ?? ymdFromValue(doc.startdatum)
    ?? ymdFromValue(doc.StartDate)
  )
}

function ymdEndFromDoc(doc: Record<string, unknown>): string | null {
  return (
    ymdFromValue(doc.end_date)
    ?? ymdFromValue(doc.contract_end_date)
    ?? ymdFromValue(doc.einddatum)
    ?? ymdFromValue(doc.EndDate)
  )
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function dedupeKey(doc: Record<string, unknown>): string {
  const name = normStr(doc.employee_name)
  const loc = normStr(doc.contract_location)
  return `${name}|${loc}`
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

    const bestByKey = new Map<string, Record<string, unknown>[]>()
    for (const doc of raw) {
      const k = dedupeKey(doc)
      if (!bestByKey.has(k)) bestByKey.set(k, [])
      bestByKey.get(k)!.push(doc)
    }

    const members = (await db
      .collection('members')
      .find({})
      .project({
        support_id: 1,
        email: 1,
        name: 1,
        compensation_status: 1,
        contract_type: 1,
        hourly_rate: 1,
        cost_per_hour: 1,
      })
      .toArray()) as {
      _id: ObjectId
      support_id?: string
      email?: string
      name?: string
      compensation_status?: 'ok' | 'missing'
      contract_type?: string
      hourly_rate?: number
      cost_per_hour?: number
    }[]

    /** Newest inbox-eitje-hours row per support_id (daily export stores contract dates here). */
    const hoursDateBySupport = new Map<string, { start: string | null; end: string | null }>()
    const hoursAgg = await db
      .collection('inbox-eitje-hours')
      .aggregate<{
        _id: string
        contract_start_date?: unknown
        contract_end_date?: unknown
      }>([
        {
          $match: {
            support_id: { $exists: true, $nin: [null, ''] },
          },
        },
        { $sort: { _id: -1 } },
        {
          $group: {
            _id: { $toString: '$support_id' },
            contract_start_date: { $first: '$contract_start_date' },
            contract_end_date: { $first: '$contract_end_date' },
          },
        },
      ])
      .toArray()
    for (const h of hoursAgg) {
      const sid = String(h._id ?? '').trim()
      if (!sid) continue
      hoursDateBySupport.set(sid, {
        start: ymdFromValue(h.contract_start_date),
        end: ymdFromValue(h.contract_end_date),
      })
    }

    const bySupport = new Map<string, { id: string; compensation_status?: 'ok' | 'missing' }>()
    const byEmail = new Map<string, { id: string; compensation_status?: 'ok' | 'missing' }>()
    const byName = new Map<string, { id: string; compensation_status?: 'ok' | 'missing' }>()
    for (const m of members) {
      const id = String(m._id)
      const ct = typeof m.contract_type === 'string' ? m.contract_type : ''
      const hr = toNum(m.hourly_rate)
      const cph = toNum(m.cost_per_hour)
      const status =
        m.compensation_status === 'ok' || m.compensation_status === 'missing'
          ? m.compensation_status
          : compensationStatusFromFields(ct, hr, cph)
      const entry = { id, compensation_status: status }
      const sup = String(m.support_id ?? '').trim()
      if (sup) bySupport.set(sup, entry)
      const em = String(m.email ?? '').trim().toLowerCase()
      if (em && !byEmail.has(em)) byEmail.set(em, entry)
      const nm = normStr(m.name)
      if (nm && !byName.has(nm)) byName.set(nm, entry)
    }

    const rows: EitjeStaffRow[] = []
    for (const group of bestByKey.values()) {
      if (!group.length) continue

      const sorted = [...group].sort((a, b) => {
        const ta = a._id instanceof ObjectId ? a._id.getTimestamp().getTime() : 0
        const tb = b._id instanceof ObjectId ? b._id.getTimestamp().getTime() : 0
        return tb - ta
      })
      const primary = sorted[0]!

      const support_ids = [
        ...new Set(group.map((d) => String(d.support_id ?? '').trim()).filter(Boolean)),
      ].sort()

      const employee_name = String(primary.employee_name ?? '').trim() || 'Unknown'
      const contract_type = String(primary.contract_type ?? '').trim() || '—'
      const contract_location = String(primary.contract_location ?? '').trim() || '—'

      let startdatum: string | null = null
      let einddatum: string | null = null
      for (const d of group) {
        const s = ymdStartFromDoc(d)
        const e = ymdEndFromDoc(d)
        if (s && (!startdatum || s < startdatum)) startdatum = s
        if (e && (!einddatum || e > einddatum)) einddatum = e
      }

      if (!startdatum || !einddatum) {
        for (const sid of support_ids) {
          const h = hoursDateBySupport.get(sid)
          if (!h) continue
          if (!startdatum && h.start) startdatum = h.start
          if (!einddatum && h.end) einddatum = h.end
        }
      }

      let hourly_rate: number | null = null
      for (const d of sorted) {
        const hr = toNum(d.hourly_rate)
        if (hr != null) {
          hourly_rate = hr
          break
        }
      }

      let cost_per_hour: number | null = null
      if (isZzpContract(contract_type) && hourly_rate != null) {
        cost_per_hour = hourly_rate
      } else if (isNulUrenContract(contract_type) && hourly_rate != null) {
        cost_per_hour = hourly_rate * 1.36
      } else {
        for (const d of sorted) {
          const c = toNum(d.cost_per_hour)
          if (c != null) {
            cost_per_hour = c
            break
          }
        }
      }

      if (locationFilter && !normStr(contract_location).includes(locationFilter) && normStr(contract_location) !== locationFilter) {
        continue
      }
      if (search) {
        const sidHay = support_ids.join(' ').toLowerCase()
        const hay = `${normStr(employee_name)} ${normStr(contract_location)} ${sidHay}`
        if (!hay.includes(search)) continue
      }

      let match_confidence: MatchConfidence = 'none'
      let matched_member_id: string | undefined
      let compensation_status: 'ok' | 'missing' | undefined

      for (const sid of support_ids) {
        if (bySupport.has(sid)) {
          match_confidence = 'high'
          const hit = bySupport.get(sid)!
          matched_member_id = hit.id
          compensation_status = hit.compensation_status
          break
        }
      }
      if (!matched_member_id) {
        let hitEmail = false
        for (const d of group) {
          const em = String(d.email ?? '').trim().toLowerCase()
          if (em && byEmail.has(em)) {
            match_confidence = 'medium'
            const hit = byEmail.get(em)!
            matched_member_id = hit.id
            compensation_status = hit.compensation_status
            hitEmail = true
            break
          }
        }
        if (!hitEmail) {
          const nm = normStr(employee_name)
          if (nm && byName.has(nm)) {
            match_confidence = 'medium'
            const hit = byName.get(nm)!
            matched_member_id = hit.id
            compensation_status = hit.compensation_status
          }
        }
      }

      rows.push({
        support_ids,
        employee_name,
        contract_type,
        contract_location,
        startdatum,
        einddatum,
        hourly_rate,
        cost_per_hour,
        ...(matched_member_id ? { matched_member_id } : {}),
        match_confidence,
        ...(compensation_status ? { compensation_status } : {}),
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
    const missing_compensation = rows.filter((r) => r.compensation_status === 'missing').length
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
        missing_compensation,
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
