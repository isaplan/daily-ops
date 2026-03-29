import { ObjectId } from 'mongodb'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Location not found' })
  }
  const db = await getDb()
  const result = await db.collection('locations').updateOne(
    { _id: oid },
    { $set: { is_active: false, updated_at: new Date() } }
  )
  if (result.matchedCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Location not found' })
  }
  return { success: true, message: 'Location deactivated' }
})
