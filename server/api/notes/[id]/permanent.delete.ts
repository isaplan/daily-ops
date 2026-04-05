import { ObjectId } from 'mongodb'
import { getNotesCollection } from '../../../utils/db'

function isMongoId(str: string): boolean {
  return /^[0-9a-f]{24}$/i.test(str)
}

/** Permanently delete a note (only allowed when it is already in trash). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || id.trim() === '') {
    throw createError({ statusCode: 400, message: 'Invalid note identifier' })
  }

  const coll = await getNotesCollection()
  const filter = isMongoId(id) ? { _id: new ObjectId(id) } : { slug: id }

  const existing = await coll.findOne(filter)
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  const del = (existing as Record<string, unknown>).deleted_at
  if (del == null) {
    throw createError({
      statusCode: 400,
      message: 'Move the note to trash before deleting permanently',
    })
  }

  const result = await coll.deleteOne(filter)
  if (result.deletedCount === 0) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  return { success: true, message: 'Note permanently deleted' }
})
