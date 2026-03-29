import { ObjectId } from 'mongodb'
import { getMenusCollection } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name: string
    startDate?: string
    location?: string
  }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  const now = new Date()
  const startDate = typeof body?.startDate === 'string' ? body.startDate.trim() || undefined : undefined
  const location = typeof body?.location === 'string' ? body.location.trim() || undefined : undefined

  const coll = await getMenusCollection()
  const doc = {
    _id: new ObjectId(),
    name,
    startDate,
    location,
    menuSections: [],
    createdAt: now,
    updatedAt: now,
  }
  await coll.insertOne(doc)
  return {
    success: true,
    data: {
      _id: doc._id.toString(),
      name: doc.name,
      startDate: doc.startDate,
      location: doc.location,
      menuSections: doc.menuSections,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
  }
})
