import { ObjectId } from 'mongodb'
import { getNotesCollection, getUnifiedUsersCollection } from '../../utils/db'

function isMongoId(str: string): boolean {
  return /^[0-9a-f]{24}$/i.test(str)
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || id.trim() === '') {
    throw createError({ statusCode: 400, message: 'Invalid note identifier' })
  }

  const fromTrash = getQuery(event).fromTrash === '1' || getQuery(event).fromTrash === 'true'

  const coll = await getNotesCollection()
  const filter = isMongoId(id) ? { _id: new ObjectId(id) } : { slug: id }
  const note = await coll.findOne(filter)

  if (!note) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  const delAt = (note as Record<string, unknown>).deleted_at
  if (delAt != null && !fromTrash) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  const noteObj = note as Record<string, unknown>
  const usersColl = await getUnifiedUsersCollection()
  let mentioned_members: { _id: string; canonicalName: string }[] = []
  let attending_members: { _id: string; canonicalName: string }[] = []
  const mentionedIds = noteObj.mentioned_unified_user_ids as ObjectId[] | undefined
  const attendingIds = noteObj.attending_unified_user_ids as ObjectId[] | undefined
  const allUserIds = [...(Array.isArray(mentionedIds) ? mentionedIds : []), ...(Array.isArray(attendingIds) ? attendingIds : [])]
  const uniqueIds = allUserIds.length ? [...new Set(allUserIds.map((id) => id.toString()))].map((id) => new ObjectId(id)) : []
  if (uniqueIds.length > 0) {
    const users = await usersColl
      .find({ _id: { $in: uniqueIds } })
      .project({ _id: 1, canonicalName: 1 })
      .toArray() as { _id: ObjectId; canonicalName?: string }[]
    const byId = Object.fromEntries(users.map((u) => [String(u._id), { _id: String(u._id), canonicalName: u.canonicalName ?? 'Unknown' }]))
    if (Array.isArray(mentionedIds) && mentionedIds.length > 0) {
      mentioned_members = mentionedIds.map((id) => byId[String(id)]).filter(Boolean)
    }
    if (Array.isArray(attendingIds) && attendingIds.length > 0) {
      attending_members = attendingIds.map((id) => byId[String(id)]).filter(Boolean)
    }
  }

  const fromArray = (noteObj.connected_member_ids as ObjectId[] | undefined) ?? []
  const legacyId = noteObj.connected_to && typeof (noteObj.connected_to as Record<string, unknown>).member_id !== 'undefined'
    ? (noteObj.connected_to as { member_id?: ObjectId }).member_id
    : null
  const idsSet = new Set(fromArray.map((id) => String(id)))
  if (legacyId) idsSet.add(String(legacyId))
  const connected_member_ids = [...idsSet]

  return {
    success: true,
    data: {
      ...noteObj,
      mentioned_members,
      attending_members,
      connected_member_ids,
    },
  }
})
