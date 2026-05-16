/**
 * @registry-id: membersIdPutApi
 * @created: 2026-03-01T00:00:00.000Z
 * @last-modified: 2026-05-16T12:00:00.000Z
 * @description: PUT /api/members/[id] — profile + optional compensation revision (manual_ui)
 * @last-fix: [2026-05-16] Compensation fields open revision via memberCompensationRevisions (ADR-001)
 *
 * @architecture-ref: ARCHITECTURE.md#5-business-rules
 * @adr-ref: ADR-001, ADR-002
 *
 * @exports-to:
 * ✓ pages/members/[id].vue
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../../utils/db'
import { openNewRevision, toNum } from '../../utils/memberCompensationRevisions'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }
  const body = await readBody<{
    name?: string
    email?: string
    slack_username?: string
    location_id?: string
    team_id?: string
    contract_type?: string
    hourly_rate?: number
    cost_per_hour?: number
  }>(event)
  const db = await getDb()
  const update: Record<string, unknown> = { updated_at: new Date() }
  if (body?.name !== undefined) update.name = body.name.trim()
  if (body?.email !== undefined) update.email = body.email.trim().toLowerCase()
  if (body?.slack_username !== undefined) update.slack_username = body.slack_username.trim() || undefined
  if (body?.location_id !== undefined) {
    if (body.location_id) {
      try {
        update.location_id = new ObjectId(body.location_id)
      } catch {
        throw createError({ statusCode: 400, statusMessage: 'Invalid location_id' })
      }
    } else {
      update.location_id = null
    }
  }
  if (body?.team_id !== undefined) {
    if (body.team_id) {
      try {
        update.team_id = new ObjectId(body.team_id)
      } catch {
        throw createError({ statusCode: 400, statusMessage: 'Invalid team_id' })
      }
    } else {
      update.team_id = null
    }
  }

  const hasCompensationEdit =
    body?.contract_type !== undefined || body?.hourly_rate !== undefined || body?.cost_per_hour !== undefined

  if (hasCompensationEdit) {
    const existing = await db.collection('members').findOne({ _id: oid })
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Member not found' })
    const ex = existing as Record<string, unknown>
    const contractType =
      body?.contract_type !== undefined
        ? String(body.contract_type).trim()
        : String(ex.contract_type ?? '').trim()
    const hourlyRate =
      body?.hourly_rate !== undefined ? toNum(body.hourly_rate) : toNum(ex.hourly_rate)
    const costPerHour =
      body?.cost_per_hour !== undefined ? toNum(body.cost_per_hour) : toNum(ex.cost_per_hour)

    await openNewRevision(
      db,
      oid,
      { contract_type: contractType, hourly_rate: hourlyRate, cost_per_hour: costPerHour },
      'manual_ui',
      new Date()
    )
  }

  if (Object.keys(update).length > 1) {
    await db.collection('members').updateOne({ _id: oid }, { $set: update })
  }

  const result = await db.collection('members').findOne({ _id: oid })
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }

  const m = result as Record<string, unknown>
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
  const data = {
    _id: String(result._id),
    name: name || `Member ${String(result._id).slice(-6)}`,
    email: (typeof m.email === 'string' ? m.email : '') || '',
    slack_username: typeof m.slack_username === 'string' ? m.slack_username : undefined,
    location_id: locationId ? String(locationId) : undefined,
    team_id: teamId ? String(teamId) : undefined,
    location_name: locationName,
    team_name: teamName,
    is_active: m.is_active !== false && m.isActive !== false,
    contract_type: typeof m.contract_type === 'string' ? m.contract_type : undefined,
    hourly_rate: typeof m.hourly_rate === 'number' ? m.hourly_rate : undefined,
    cost_per_hour: typeof m.cost_per_hour === 'number' ? m.cost_per_hour : undefined,
    compensation_status: typeof m.compensation_status === 'string' ? m.compensation_status : undefined,
  }
  return { success: true, data }
})
