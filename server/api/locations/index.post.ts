import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string; address?: string; city?: string; country?: string }>(event)
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  const db = await getDb()
  const now = new Date()
  const doc = {
    name: body.name.trim(),
    address: body.address?.trim() || undefined,
    city: body.city?.trim() || undefined,
    country: body.country?.trim() || undefined,
    is_active: true,
    created_at: now,
    updated_at: now,
  }
  const result = await db.collection('locations').insertOne(doc)
  const inserted = await db.collection('locations').findOne({ _id: result.insertedId })
  const data = inserted
    ? { _id: String(inserted._id), name: inserted.name, address: inserted.address, city: inserted.city, country: inserted.country, is_active: inserted.is_active }
    : { _id: String(result.insertedId), ...doc }
  return { success: true, data }
})
