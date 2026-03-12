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
  const db = await getDb()
  const member = await db.collection('members').findOne({
    _id: oid,
    $or: [
      { is_active: true },
      { isActive: true },
      { is_active: { $exists: false }, isActive: { $exists: false } },
    ],
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
  }
  return { success: true, data }
})
