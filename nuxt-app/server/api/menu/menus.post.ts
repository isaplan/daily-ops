import { ObjectId } from 'mongodb'
import { getMenusCollection } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  const now = new Date()
  const coll = await getMenusCollection()
  const doc = {
    _id: new ObjectId(),
    name,
    createdAt: now,
    updatedAt: now,
  }
  await coll.insertOne(doc)
  return {
    success: true,
    data: {
      _id: doc._id.toString(),
      name: doc.name,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
  }
})
