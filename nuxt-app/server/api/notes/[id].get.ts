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

  const coll = await getNotesCollection()
  const filter = isMongoId(id) ? { _id: new ObjectId(id) } : { slug: id }
  const note = await coll.findOne(filter)

  if (!note) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  const noteObj = note as Record<string, unknown>
  let mentioned_members: { _id: string; canonicalName: string }[] = []
  const mentionedIds = noteObj.mentioned_unified_user_ids as ObjectId[] | undefined
  if (Array.isArray(mentionedIds) && mentionedIds.length > 0) {
    const usersColl = await getUnifiedUsersCollection()
    const users = await usersColl
      .find({ _id: { $in: mentionedIds } })
      .project({ _id: 1, canonicalName: 1 })
      .toArray() as { _id: ObjectId; canonicalName?: string }[]
    mentioned_members = users.map((u) => ({
      _id: String(u._id),
      canonicalName: u.canonicalName ?? 'Unknown',
    }))
  }

  return {
    success: true,
    data: {
      ...noteObj,
      mentioned_members,
    },
  }
})
