/**
 * @registry-id: dailyOpsBorkStaffUnifiedUsersGet
 * @created: 2026-05-19T14:00:00.000Z
 * @last-modified: 2026-05-19T14:00:00.000Z
 * @description: Search unified_user for manual Bork waiter linking
 * @last-fix: [2026-05-19] Initial picker search for Bork staff hub
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/bork-staff.vue
 */

import { getDb } from '../../../utils/db'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = String(query.search ?? '').trim()
  const limit = Math.min(50, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20))

  const db = await getDb()
  const filter: Record<string, unknown> = {}
  if (search.length >= 2) {
    const re = { $regex: escapeRegex(search), $options: 'i' }
    filter.$or = [{ canonicalName: re }, { primaryName: re }, { eitjeNames: re }]
  }

  const docs = await db
    .collection('unified_user')
    .find(filter)
    .project({ canonicalName: 1, primaryName: 1, support_id: 1 })
    .sort({ canonicalName: 1 })
    .limit(limit)
    .toArray()

  const data = docs.map((u) => {
    const d = u as Record<string, unknown>
    const name =
      (typeof d.canonicalName === 'string' && d.canonicalName.trim()) ||
      (typeof d.primaryName === 'string' && d.primaryName.trim()) ||
      'Unknown'
    return {
      _id: String(u._id),
      name,
      support_id: typeof d.support_id === 'string' || typeof d.support_id === 'number' ? String(d.support_id) : undefined,
    }
  })

  return { success: true as const, data }
})
