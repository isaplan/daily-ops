import { ObjectId } from 'mongodb'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name: string
    email: string
    slack_username?: string
    location_id?: string
    team_id?: string
  }>(event)
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (!body?.email?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'email is required' })
  }
  const db = await getDb()
  const now = new Date()
  const doc: Record<string, unknown> = {
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    slack_username: body.slack_username?.trim() || undefined,
    roles: [{ role: 'kitchen_staff', scope: 'team', grantedAt: now }],
    is_active: true,
    created_at: now,
    updated_at: now,
  }
  if (body.location_id) {
    try {
      doc.location_id = new ObjectId(body.location_id)
    } catch {
      // ignore invalid id
    }
  }
  if (body.team_id) {
    try {
      doc.team_id = new ObjectId(body.team_id)
    } catch {
      // ignore invalid id
    }
  }
  const result = await db.collection('members').insertOne(doc)
  const inserted = await db.collection('members').findOne({ _id: result.insertedId })
  const data = inserted
    ? {
        _id: String(inserted._id),
        name: inserted.name,
        email: inserted.email,
        slack_username: inserted.slack_username,
        location_id: inserted.location_id ? String(inserted.location_id) : undefined,
        team_id: inserted.team_id ? String(inserted.team_id) : undefined,
        is_active: inserted.is_active,
      }
    : { _id: String(result.insertedId), name: doc.name, email: doc.email }
  return { success: true, data }
})
