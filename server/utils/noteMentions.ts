import { ObjectId } from 'mongodb'
import { getUnifiedUsersCollection } from './db'

/** Extract @member slug from todo text (last @word, ignore @todo). */
export function extractMentionSlug(text: string): string | undefined {
  const match = text.match(/@([a-zA-Z0-9_-]+)/g)
  if (!match?.length) return undefined
  const slugs = match.map((m) => m.slice(1).toLowerCase()).filter((s) => s !== 'todo')
  return slugs[slugs.length - 1]
}

/** Collect unique mention slugs from block note content (from todos). */
export function collectMentionSlugsFromContent(content: string): string[] {
  const raw = (content ?? '').trim()
  if (!raw.startsWith('{"version":2') || !raw.includes('"blocks"')) return []
  try {
    const doc = JSON.parse(raw) as { version: number; blocks?: { todos?: { text?: string; assignedTo?: string }[] }[] }
    if (doc.version !== 2 || !Array.isArray(doc.blocks)) return []
    const slugs = new Set<string>()
    for (const block of doc.blocks) {
      const todos = block.todos ?? []
      for (const t of todos) {
        const slug = t.assignedTo ?? extractMentionSlug(t.text ?? '')
        if (slug) slugs.add(slug)
      }
    }
    return Array.from(slugs)
  } catch {
    return []
  }
}

/** Resolve mention slugs to unified_user _ids (match slackUsername, canonicalName, primaryName). */
export async function resolveSlugsToUnifiedUserIds(slugs: string[]): Promise<ObjectId[]> {
  if (!slugs.length) return []
  const coll = await getUnifiedUsersCollection()
  const users = await coll.find({ isActive: true }).project({ _id: 1, canonicalName: 1, primaryName: 1, slackUsername: 1 }).toArray() as { _id: ObjectId; canonicalName?: string; primaryName?: string; slackUsername?: string | null }[]
  const ids: ObjectId[] = []
  const seen = new Set<string>()
  for (const slug of slugs) {
    const low = slug.toLowerCase()
    const u = users.find(
      (x) =>
        (x.slackUsername?.toLowerCase() === low) ||
        (x.canonicalName?.toLowerCase() === low) ||
        (x.primaryName?.toLowerCase() === low) ||
        ((x.canonicalName ?? x.primaryName ?? '').toLowerCase().split(/\s+/)[0] === low)
    )
    if (u && !seen.has(u._id.toString())) {
      seen.add(u._id.toString())
      ids.push(u._id)
    }
  }
  return ids
}
