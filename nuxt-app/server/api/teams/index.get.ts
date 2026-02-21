import { ObjectId } from 'mongodb'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const locationId = query.location_id as string | undefined
  const db = await getDb()
  const filter: Record<string, unknown> = { is_active: true }
  if (locationId) filter.location_id = new ObjectId(locationId)
  const teams = await db
    .collection('teams')
    .find(filter)
    .sort({ name: 1 })
    .project({ _id: 1, name: 1, location_id: 1 })
    .toArray()
  return { success: true, data: teams }
})
