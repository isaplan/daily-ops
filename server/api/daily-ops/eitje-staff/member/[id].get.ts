/**
 * @registry-id: dailyOpsEitjeStaffMemberPanelGet
 * @created: 2026-06-09T12:00:00.000Z
 * @last-modified: 2026-06-09T12:00:00.000Z
 * @description: Lightweight member payload for Eitje staff hub side panel (no Bork, 6mo Eitje)
 * @last-fix: [2026-06-09] Created to avoid full GET /api/members/[id] on panel open
 *
 * @exports-to:
 * ✓ components/daily-ops/inbox/EitjeStaffMemberProfilePanel.vue
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../../../../utils/db'
import { fetchMemberEitjePlaces } from '../../../../utils/memberEitjeContext'
import {
  compensationStatusFromFields,
  resolveCostPerHour,
  toNum,
} from '../../../../utils/memberCompensationRevisions'
import type { CompensationRevision } from '../../../../../types/member-compensation'

const PANEL_EITJE_MONTHS = 6

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
  const member = await db.collection('members').findOne(
    { _id: oid },
    {
      projection: {
        name: 1,
        email: 1,
        location_id: 1,
        team_id: 1,
        contract_type: 1,
        contract_start_date: 1,
        contract_end_date: 1,
        hourly_rate: 1,
        cost_per_hour: 1,
        compensation_status: 1,
        support_id: 1,
        compensationHistory: 1,
      },
    }
  )
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }

  const m = member as Record<string, unknown>
  const name = typeof m.name === 'string' ? m.name.trim() : ''
  const locationId = m.location_id
  const teamId = m.team_id

  const [locationName, teamName, eitje_places] = await Promise.all([
    locationId
      ? db
          .collection('locations')
          .findOne({ _id: new ObjectId(String(locationId)) }, { projection: { name: 1 } })
          .then((loc) => (loc ? (String((loc as Record<string, unknown>).name ?? '') || undefined) : undefined))
          .catch(() => undefined)
      : Promise.resolve(undefined),
    teamId
      ? db
          .collection('teams')
          .findOne({ _id: new ObjectId(String(teamId)) }, { projection: { name: 1 } })
          .then((team) => (team ? (String((team as Record<string, unknown>).name ?? '') || undefined) : undefined))
          .catch(() => undefined)
      : Promise.resolve(undefined),
    fetchMemberEitjePlaces(db, {
      supportId: typeof m.support_id === 'string' ? m.support_id.trim() : undefined,
      userName: name,
      monthsBack: PANEL_EITJE_MONTHS,
    }),
  ])

  const contractTypeStr = typeof m.contract_type === 'string' ? m.contract_type : ''
  const hourlyNum = typeof m.hourly_rate === 'number' && Number.isFinite(m.hourly_rate) ? m.hourly_rate : undefined
  const storedCost = toNum(m.cost_per_hour)
  const costPerHour = resolveCostPerHour(contractTypeStr, hourlyNum ?? null, storedCost) ?? undefined
  const compensation_status =
    typeof m.compensation_status === 'string' &&
    (m.compensation_status === 'ok' || m.compensation_status === 'missing')
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
      source: r.source,
      source_ref: r.source_ref,
    }))
    .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())

  const merged = eitje_places.merged
  const eitje_totals = {
    worked_hours: merged.reduce((s, r) => s + r.worked_hours, 0),
    planned_hours: merged.reduce((s, r) => s + r.planned_hours, 0),
    places_count: merged.length,
  }

  return {
    success: true as const,
    data: {
      _id: String(member._id),
      name: name || `Member ${String(member._id).slice(-6)}`,
      email: typeof m.email === 'string' ? m.email : undefined,
      location_name: locationName,
      team_name: teamName,
      contract_type: contractTypeStr || undefined,
      contract_start_date: m.contract_start_date
        ? new Date(m.contract_start_date as string).toISOString()
        : undefined,
      contract_end_date: m.contract_end_date
        ? new Date(m.contract_end_date as string).toISOString()
        : undefined,
      hourly_rate: hourlyNum,
      cost_per_hour: costPerHour,
      compensation_status,
      compensationHistory,
      support_id: typeof m.support_id === 'string' ? m.support_id.trim() : undefined,
      eitje_places: {
        months_back: eitje_places.months_back,
        range_start: eitje_places.range_start,
        range_end: eitje_places.range_end,
        merged: eitje_places.merged,
      },
      eitje_totals,
    },
  }
})
