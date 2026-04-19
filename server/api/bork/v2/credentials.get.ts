import { getDb } from '../../../utils/db'
import { ObjectId } from 'mongodb'

type CredentialRow = {
  _id: ObjectId
  provider: string
  locationId: ObjectId
  locationName?: string
  baseUrl: string
  apiKey?: string
  isActive?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export default defineEventHandler(async () => {
  const db = await getDb()
  const creds = await db
    .collection<CredentialRow>('api_credentials')
    .find({ provider: { $in: ['bork', 'Bork'] } })
    .sort({ createdAt: -1 })
    .toArray()

  const list: { _id: string; locationId: string; locationName: string | null; baseUrl: string; hasApiKey: boolean }[] = []
  for (const c of creds) {
    const locationId = c.locationId instanceof ObjectId ? c.locationId : new ObjectId(String(c.locationId))
    const loc = await db.collection('locations').findOne({ _id: locationId })
    const storedName = c.locationName
    const locationName = storedName ?? (loc && typeof (loc as any).name === 'string' ? (loc as any).name : null)
    list.push({
      _id: c._id.toString(),
      locationId: locationId.toString(),
      locationName,
      baseUrl: c.baseUrl ?? '',
      hasApiKey: !!c.apiKey,
    })
  }

  return {
    success: true,
    credentials: list,
  }
})
