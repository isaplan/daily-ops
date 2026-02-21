import { ObjectId } from 'mongodb'
import { getNotesCollection } from '../../utils/db'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const archived = query.archived === 'true'
  const teamId = query.team_id as string | undefined
  const locationId = query.location_id as string | undefined
  const scope = query.scope as string | undefined
  const skip = Math.max(0, Number(query.skip) || 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT))

  const filter: Record<string, unknown> = { is_archived: archived }
  if (teamId) filter['connected_to.team_id'] = new ObjectId(teamId)
  if (locationId) filter['connected_to.location_id'] = new ObjectId(locationId)

  if (scope === 'private') {
    filter.$or = [
      { connected_to: { $exists: false } },
      { connected_to: null },
      { 'connected_to.team_id': null, 'connected_to.location_id': null },
    ]
  } else if (scope === 'public') {
    filter.$or = [
      { 'connected_to.team_id': { $exists: true, $nin: [null, ''] } },
      { 'connected_to.location_id': { $exists: true, $nin: [null, ''] } },
    ]
  } else if (scope === 'drafts') {
    filter.$or = [
      { status: { $exists: false } },
      { status: null },
      { status: 'draft' },
      { status: { $ne: 'published' } },
    ]
  }

  const coll = await getNotesCollection()
  const notes = await coll
    .find(filter)
    .sort({ is_pinned: -1, created_at: -1 })
    .skip(skip)
    .limit(limit)
    .toArray()

  return { success: true, data: notes }
})
