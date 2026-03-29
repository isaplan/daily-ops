import { ObjectId } from 'mongodb'
import { getDb } from '../../utils/db'

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
  const result = await db.collection('members').findOneAndUpdate(
    { _id: oid },
    { $set: update },
    { returnDocument: 'after' }
  )
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
  }
  return { success: true, data }
})
