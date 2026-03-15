import { getDb } from '../utils/db'
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const db = await getDb()
    const query = getQuery(event)
    const date = query.date as string | undefined
    const locationIdParam = query.locationId as string | undefined
    const endpoint = (query.endpoint as string) || 'time_registration_shifts'

    if (!date) {
      throw createError({ statusCode: 400, message: 'date is required' })
    }

    const q: Record<string, unknown> = {
      period_type: 'day',
      period: date,
    }
    if (locationIdParam) {
      try {
        q.locationId = new ObjectId(locationIdParam)
      } catch {
        q.locationId = locationIdParam
      }
    }

    const collectionName = endpoint === 'planning_shifts' ? 'eitje_planning_registration_aggregation' : 'eitje_time_registration_aggregation'
    const docs = await db.collection(collectionName).find(q).sort({ user_name: 1, team_name: 1 }).toArray()

    const records = docs.map((d: Record<string, unknown>) => ({
      worker_name: d.user_name ?? 'Unknown',
      team_name: d.team_name ?? 'Unknown',
      total_hours: d.total_hours ?? 0,
      total_cost: d.total_cost ?? 0,
      record_count: d.record_count ?? 0,
    }))

    return { success: true, data: records }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[hours-row-detail]', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch row detail' })
  }
})
