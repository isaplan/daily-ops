import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = await getDb()
  const locations = await db
    .collection('locations')
    .find({ $or: [{ is_active: true }, { is_active: { $exists: false } }] })
    .sort({ name: 1 })
    .toArray()
  const data = locations.map((l: Record<string, unknown>) => ({
    _id: String(l._id),
    name: l.name,
    address: l.address,
    city: l.city,
    country: l.country,
    is_active: l.is_active !== false,
  }))
  return { success: true, data }
})
