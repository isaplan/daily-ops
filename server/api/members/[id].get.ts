/**
 * @registry-id: membersIdGetApi
 * @created: 2026-03-01T00:00:00.000Z
 * @last-modified: 2026-05-16T12:00:00.000Z
 * @description: GET /api/members/[id] — member profile (compensation from members only)
 * @last-fix: [2026-05-16] Removed inbox-contracts fallback; compensation_status + history (ADR-001)
 *
 * @architecture-ref: ARCHITECTURE.md#4-canonical-entities
 * @adr-ref: ADR-001
 *
 * @exports-to:
 * ✓ pages/members/[id].vue
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../../utils/db'
import { fetchMemberEitjePlaces } from '../../utils/memberEitjeContext'
import {
  compensationStatusFromFields,
  toNum,
} from '../../utils/memberCompensationRevisions'
import type { CompensationRevision } from '../../../types/member-compensation'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }
  const db = await getDb()
  const member = await db.collection('members').findOne({
    _id: oid,
  })
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }
  const m = member as Record<string, unknown>
  const nameVal = m.name ?? m.Name ?? m.naam ?? m.displayName ?? m.full_name ?? m.title
  const name = typeof nameVal === 'string' ? nameVal.trim() : ''
  const locationId = m.location_id as unknown
  const teamId = m.team_id as unknown
  let locationName: string | undefined
  let teamName: string | undefined
  if (locationId) {
    try {
      const loc = await db.collection('locations').findOne({ _id: new ObjectId(String(locationId)) })
      locationName = loc ? (loc as Record<string, unknown>).name as string : undefined
    } catch {
      // ignore
    }
  }
  if (teamId) {
    try {
      const team = await db.collection('teams').findOne({ _id: new ObjectId(String(teamId)) })
      teamName = team ? (team as Record<string, unknown>).name as string : undefined
    } catch {
      // ignore
    }
  }

  const contractTypeStr = typeof m.contract_type === 'string' ? m.contract_type : ''
  const hourlyNum = typeof m.hourly_rate === 'number' && Number.isFinite(m.hourly_rate) ? m.hourly_rate : undefined
  const storedCost = toNum(m.cost_per_hour)
  const costPerHour = storedCost ?? undefined

  const compensation_status =
    typeof m.compensation_status === 'string' && (m.compensation_status === 'ok' || m.compensation_status === 'missing')
      ? m.compensation_status
      : compensationStatusFromFields(contractTypeStr, hourlyNum ?? null, storedCost)

  const rawHistory = (m.compensationHistory as CompensationRevision[] | undefined) ?? []
  const compensationHistory = rawHistory
    .map((r) => ({
      effective_from: r.effective_from instanceof Date ? r.effective_from.toISOString() : String(r.effective_from),
      effective_to:
        r.effective_to instanceof Date ? r.effective_to.toISOString() : r.effective_to != null ? String(r.effective_to) : null,
      contract_type: r.contract_type,
      hourly_rate: r.hourly_rate,
      cost_per_hour: r.cost_per_hour,
      cost_model: r.cost_model,
      source: r.source,
      source_ref: r.source_ref,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }))
    .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())

  const supportIdStr = typeof m.support_id === 'string' ? m.support_id.trim() : undefined
  const eitje_places = await fetchMemberEitjePlaces(db, {
    supportId: supportIdStr,
    userName: name,
    monthsBack: 36,
  })
  const merged = eitje_places.merged
  const eitje_totals = {
    worked_hours: merged.reduce((s, r) => s + r.worked_hours, 0),
    planned_hours: merged.reduce((s, r) => s + r.planned_hours, 0),
    places_count: merged.length,
  }

  const unifiedUserId =
    m.unified_user_id instanceof ObjectId
      ? String(m.unified_user_id)
      : typeof m.unified_user_id === 'string'
        ? m.unified_user_id
        : undefined

  const data = {
    _id: String(member._id),
    name: name || `Member ${String(member._id).slice(-6)}`,
    email: (typeof m.email === 'string' ? m.email : '') || '',
    slack_username: typeof m.slack_username === 'string' ? m.slack_username : undefined,
    location_id: locationId ? String(locationId) : undefined,
    team_id: teamId ? String(teamId) : undefined,
    location_name: locationName,
    team_name: teamName,
    is_active: m.is_active !== false && m.isActive !== false,
    unified_user_id: unifiedUserId,
    contract_type: contractTypeStr || undefined,
    contract_start_date: m.contract_start_date ? new Date(m.contract_start_date as string).toISOString() : undefined,
    contract_end_date: m.contract_end_date ? new Date(m.contract_end_date as string).toISOString() : undefined,
    hourly_rate: hourlyNum,
    cost_per_hour: costPerHour,
    compensation_status,
    compensationHistory,
    weekly_hours: typeof m.weekly_hours === 'number' ? m.weekly_hours : undefined,
    monthly_hours: typeof m.monthly_hours === 'number' ? m.monthly_hours : undefined,
    phone: typeof m.phone === 'string' ? m.phone : undefined,
    age: typeof m.age === 'number' ? m.age : undefined,
    birthday: typeof m.birthday === 'string' ? m.birthday : undefined,
    postcode: typeof m.postcode === 'string' ? m.postcode : undefined,
    city: typeof m.city === 'string' ? m.city : undefined,
    street: typeof m.street === 'string' ? m.street : undefined,
    nmbrs_id: typeof m.nmbrs_id === 'string' ? m.nmbrs_id : undefined,
    support_id: supportIdStr,
    eitje_places: {
      months_back: eitje_places.months_back,
      range_start: eitje_places.range_start,
      range_end: eitje_places.range_end,
      merged: eitje_places.merged,
      data_source: eitje_places.source,
    },
    eitje_totals,
  }
  return { success: true, data }
})
