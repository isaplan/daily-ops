import { ObjectId } from 'mongodb'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string; location_id: string; description?: string }>(event)
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (!body?.location_id) {
    throw createError({ statusCode: 400, statusMessage: 'location_id is required' })
  }
  let locationOid: ObjectId
  try {
    locationOid = new ObjectId(body.location_id)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'invalid location_id' })
  }
  const db = await getDb()
  const now = new Date()
  const doc = {
    name: body.name.trim(),
    location_id: locationOid,
    description: body.description?.trim() || undefined,
    is_active: true,
    created_at: now,
    updated_at: now,
  }
  const result = await db.collection('teams').insertOne(doc)
  const inserted = await db.collection('teams').findOne({ _id: result.insertedId })
  const data = inserted
    ? { _id: String(inserted._id), name: inserted.name, location_id: String(inserted.location_id), description: inserted.description, is_active: inserted.is_active }
    : { _id: String(result.insertedId), ...doc, location_id: body.location_id }
  return { success: true, data }
})
