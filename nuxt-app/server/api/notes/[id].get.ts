import { ObjectId } from 'mongodb'
import { getNotesCollection } from '../../utils/db'

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

  return { success: true, data: note }
})
