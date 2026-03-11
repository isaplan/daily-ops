import { getNotesCollection } from '../../utils/db'

/** Returns distinct tag strings from notes (and can be extended for todos, events, etc.). */
export default defineEventHandler(async () => {
  const coll = await getNotesCollection()
  const tags = await coll.distinct('tags', { tags: { $exists: true, $ne: [] } })
  const normalized = (tags as string[])
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    .map((t) => t.trim().toLowerCase())
  const unique = [...new Set(normalized)].sort((a, b) => a.localeCompare(b))
  return { success: true, data: unique }
})
