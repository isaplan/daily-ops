import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = await getDb()
  const locations = await db
    .collection('locations')
    .find({ is_active: true })
    .sort({ name: 1 })
    .project({ _id: 1, name: 1 })
    .toArray()
  return { success: true, data: locations }
})
