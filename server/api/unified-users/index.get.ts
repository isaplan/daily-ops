import { getUnifiedUsersCollection } from '../../utils/db'

const NAME_KEYS = ['canonicalName', 'primaryName', 'name', 'displayName', 'eitjeNames']

function getDisplayName(doc: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    const v = doc[k]
    if (typeof v === 'string' && v.trim().length > 0 && v.length < 200) return v.trim()
    if (Array.isArray(v) && typeof v[0] === 'string' && (v[0] as string).trim()) return (v[0] as string).trim()
  }
  const allIds = doc.allIds as Array<{ name?: string }> | undefined
  if (Array.isArray(allIds) && allIds[0] && typeof (allIds[0] as { name?: string }).name === 'string') {
    const n = (allIds[0] as { name: string }).name.trim()
    if (n) return n
  }
  for (const [key, val] of Object.entries(doc)) {
    if (key === '_id' || key.startsWith('$') || key === 'allIds' || key === 'allIdValues') continue
    if (typeof val === 'string' && val.trim().length > 0 && val.length < 200 && !/^[0-9a-f]{24}$/i.test(val)) return val.trim()
    if (Array.isArray(val) && typeof val[0] === 'string' && (val[0] as string).length < 200) return (val[0] as string).trim()
  }
  return ''
}

/** Returns all active unified users (no location filter). Used e.g. for Attending dropdown. */
export default defineEventHandler(async () => {
  try {
    const coll = await getUnifiedUsersCollection()
    const list = await coll
      .find({
        $or: [
          { isActive: true },
          { is_active: true },
          { isActive: { $exists: false }, is_active: { $exists: false } },
        ],
      })
      .sort({ canonicalName: 1 })
      .toArray() as Record<string, unknown>[]

    const data = list.map((u) => {
      const display = getDisplayName(u) || `User ${String(u._id).slice(-6)}`
      const slack = typeof u.slackUsername === 'string' ? u.slackUsername : (typeof (u as Record<string, unknown>).slackusername === 'string' ? (u as Record<string, unknown>).slackusername : null)
      const locId = u.location_id ?? u.locationId ?? (u as Record<string, unknown>).primaryLocationId
      const location_id = locId != null ? String(locId) : null
      return {
        _id: String(u._id),
        canonicalName: display,
        primaryName: display,
        primaryEmail: (typeof u.primaryEmail === 'string' ? u.primaryEmail : '') || '',
        slackUsername: slack ?? null,
        location_id,
      }
    })

    return { success: true, data }
  } catch {
    return { success: true, data: [] }
  }
})
