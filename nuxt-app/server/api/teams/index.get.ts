import { ObjectId } from 'mongodb'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const locationId = query.location_id as string | undefined
  const db = await getDb()
  const filter: Record<string, unknown> = {
    $or: [
      { is_active: true },
      { isActive: true },
      { is_active: { $exists: false }, isActive: { $exists: false } },
    ],
  }
  if (locationId && /^[0-9a-f]{24}$/i.test(locationId)) {
    filter.location_id = new ObjectId(locationId)
  }
  const teams = await db
    .collection('teams')
    .find(filter)
    .sort({ name: 1 })
    .toArray()
  const data = teams.map((t: Record<string, unknown>) => {
    const locId = t.location_id ?? t.locationId
    return {
      _id: String(t._id),
      name: t.name ?? (t as Record<string, unknown>).Name ?? '',
      location_id: locId ? String(locId) : undefined,
      description: t.description,
      is_active: t.is_active !== false && (t as Record<string, unknown>).isActive !== false,
    }
  })
  return { success: true, data }
})
