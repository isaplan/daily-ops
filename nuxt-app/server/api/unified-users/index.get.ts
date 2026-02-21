import { getUnifiedUsersCollection } from '../../utils/db'

type UnifiedUserDoc = {
  _id: unknown
  canonicalName?: string
  primaryName?: string
  primaryEmail?: string
  slackUsername?: string | null
  isActive?: boolean
}

export default defineEventHandler(async () => {
  try {
    const coll = await getUnifiedUsersCollection()
    const list = await coll
      .find({ $or: [{ isActive: true }, { isActive: { $exists: false } }] })
      .sort({ canonicalName: 1 })
      .project({
        _id: 1,
        canonicalName: 1,
        primaryName: 1,
        primaryEmail: 1,
        slackUsername: 1,
      })
      .toArray() as UnifiedUserDoc[]

    const data = list.map((u) => ({
      _id: String(u._id),
      canonicalName: u.canonicalName ?? u.primaryName ?? '',
      primaryName: u.primaryName ?? '',
      primaryEmail: u.primaryEmail ?? '',
      slackUsername: u.slackUsername ?? null,
    }))

    return { success: true, data }
  } catch {
    return { success: true, data: [] }
  }
})
