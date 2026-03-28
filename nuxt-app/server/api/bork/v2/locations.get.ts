import { getDb } from '../../../utils/db'

export default defineEventHandler(async () => {
  const db = await getDb()
  const unifiedLocations = await db
    .collection('unified_location')
    .find({}, { projection: { primaryId: 1, name: 1 } })
    .sort({ name: 1 })
    .toArray()

  const fallbackLocations = unifiedLocations.length
    ? []
    : await db.collection('locations').find({}, { projection: { _id: 1, name: 1 } }).sort({ name: 1 }).toArray()

  const locations = unifiedLocations.length
    ? unifiedLocations.map(row => ({
        _id: String(row.primaryId ?? row._id),
        name: String(row.name ?? row.primaryId ?? row._id),
      }))
    : fallbackLocations.map(row => ({
        _id: String(row._id),
        name: String(row.name ?? row._id),
      }))

  return { success: true, locations }
})
