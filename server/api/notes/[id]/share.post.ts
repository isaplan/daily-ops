import { ObjectId } from 'mongodb'
import { getNotesCollection, getUnifiedUsersCollection } from '../../../utils/db'

function isMongoId(str: string): boolean {
  return /^[0-9a-f]{24}$/i.test(str)
}

/**
 * Share note: returns list of recipients (attending + mentioned) with email for use by a mailer.
 * Wire actual email sending (Resend, nodemailer, etc.) here when configured.
 */
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
  if ((note as Record<string, unknown>).deleted_at != null) {
    throw createError({ statusCode: 400, message: 'Cannot share a note that is in trash' })
  }

  const noteObj = note as Record<string, unknown>
  const mentionedIds = (noteObj.mentioned_unified_user_ids as ObjectId[] | undefined) ?? []
  const attendingIds = (noteObj.attending_unified_user_ids as ObjectId[] | undefined) ?? []
  const allIds = [...new Set([...mentionedIds, ...attendingIds].map((x) => x.toString()))].map((x) => new ObjectId(x))
  if (allIds.length === 0) {
    return { success: true, data: { recipients: [], noteTitle: noteObj.title } }
  }

  const usersColl = await getUnifiedUsersCollection()
  const users = await usersColl
    .find({ _id: { $in: allIds } })
    .project({ _id: 1, canonicalName: 1, primaryEmail: 1 })
    .toArray() as { _id: ObjectId; canonicalName?: string; primaryEmail?: string }[]

  const recipients = users
    .filter((u) => typeof u.primaryEmail === 'string' && u.primaryEmail.trim() !== '')
    .map((u) => ({ _id: String(u._id), name: u.canonicalName ?? '', email: (u.primaryEmail as string).trim() }))

  return {
    success: true,
    data: {
      recipients,
      noteTitle: noteObj.title,
      noteId: id,
    },
  }
})
