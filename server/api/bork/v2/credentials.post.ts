import { ObjectId } from 'mongodb'
import { getDb } from '../../../utils/db'

type Body = {
  _id?: string
  locationId?: string
  baseUrl?: string
  apiKey?: string
  delete?: boolean
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const db = await getDb()

  if (body.delete) {
    if (!body._id) throw createError({ statusCode: 400, statusMessage: '_id is required for delete' })
    const deleteQuery = ObjectId.isValid(body._id) ? { _id: new ObjectId(body._id) } : { _id: body._id }
    await db.collection('api_credentials').deleteOne(deleteQuery)
    return { success: true, message: 'Credential deleted' }
  }

  if (!body.locationId || !body.baseUrl) {
    throw createError({ statusCode: 400, statusMessage: 'locationId and baseUrl are required' })
  }

  let locationObjectId: ObjectId
  try {
    locationObjectId = new ObjectId(body.locationId)
  } catch {
    const loc = await db.collection('locations').findOne({
      'systemMappings.externalId': body.locationId,
      'systemMappings.system': 'bork',
    })
    if (!loc) {
      throw createError({ statusCode: 404, statusMessage: 'Location not found' })
    }
    locationObjectId = loc._id
  }

  const hasApiKey = typeof body.apiKey === 'string' && body.apiKey.trim() !== ''

  let locationName: string | null = null
  const loc = await db.collection('locations').findOne({ _id: locationObjectId })
  if (loc && typeof (loc as any).name === 'string') locationName = (loc as any).name

  const update: Record<string, unknown> = {
    provider: 'bork',
    locationId: locationObjectId,
    baseUrl: body.baseUrl.trim(),
    isActive: true,
    updatedAt: new Date(),
  }
  if (locationName) update.locationName = locationName
  if (hasApiKey) update.apiKey = (body.apiKey as string).trim()

  if (body._id) {
    const existing = await db.collection('api_credentials').findOne(
      ObjectId.isValid(body._id) ? { _id: new ObjectId(body._id) } : { _id: body._id }
    )
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Credential not found' })
    }
    if (!hasApiKey && !existing.apiKey) {
      throw createError({ statusCode: 400, statusMessage: 'API key is required' })
    }
    await db.collection('api_credentials').updateOne(
      ObjectId.isValid(body._id) ? { _id: new ObjectId(body._id) } : { _id: body._id },
      { $set: update }
    )
    return { success: true, message: 'Credential updated' }
  }

  if (!hasApiKey) {
    throw createError({ statusCode: 400, statusMessage: 'API key is required when adding a new location' })
  }

  await db.collection('api_credentials').insertOne({
    ...update,
    locationName: locationName ?? undefined,
    apiKey: (body.apiKey as string).trim(),
    createdAt: new Date(),
  })

  return { success: true, message: 'Credential created' }
})
