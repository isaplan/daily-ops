import { ObjectId } from 'mongodb'
import { getNotesCollection } from '../../utils/db'
import { activeNotesMatch, trashedNotesMatch } from '../../utils/noteDeletedFilter'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const archived = query.archived === 'true'
  const teamId = query.team_id as string | undefined
  const locationId = query.location_id as string | undefined
  const memberId = query.member_id as string | undefined
  const scope = query.scope as string | undefined
  const tag = query.tag as string | undefined
  const skip = Math.max(0, Number(query.skip) || 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT))

  const scopeTrash = scope === 'trash'

  const filter: Record<string, unknown> = { is_archived: archived }
  if (scopeTrash) {
    Object.assign(filter, trashedNotesMatch())
  } else {
    Object.assign(filter, activeNotesMatch())
  }
  if (teamId) filter['connected_to.team_id'] = new ObjectId(teamId)
  if (locationId) filter['connected_to.location_id'] = new ObjectId(locationId)
  if (memberId && /^[0-9a-f]{24}$/i.test(memberId)) {
    const oid = new ObjectId(memberId)
    filter.$or = [
      { 'connected_to.member_id': oid },
      { connected_member_ids: oid },
    ]
  }

  if (!scopeTrash && scope === 'private') {
    filter.$or = [
      { connected_to: { $exists: false } },
      { connected_to: null },
      { 'connected_to.team_id': null, 'connected_to.location_id': null },
    ]
  } else if (!scopeTrash && scope === 'public') {
    filter.$or = [
      { 'connected_to.team_id': { $exists: true, $nin: [null, ''] } },
      { 'connected_to.location_id': { $exists: true, $nin: [null, ''] } },
    ]
  } else if (!scopeTrash && scope === 'drafts') {
    filter.$or = [
      { status: { $exists: false } },
      { status: null },
      { status: 'draft' },
      { status: { $ne: 'published' } },
    ]
  } else if (!scopeTrash && scope === 'published') {
    filter.status = 'published'
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
