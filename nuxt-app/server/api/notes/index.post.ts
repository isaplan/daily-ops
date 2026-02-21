import { ObjectId } from 'mongodb'
import { getNotesCollection } from '../../utils/db'
import { collectMentionSlugsFromContent, resolveSlugsToUnifiedUserIds } from '../../utils/noteMentions'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    title?: string
    content?: string
    slug?: string
    author_id?: string
    location_id?: string
    team_id?: string
    member_id?: string
    tags?: string[]
    is_pinned?: boolean
  }>(event)

  const title = (body?.title && String(body.title).trim()) || 'Untitled'
  const content = body?.content != null ? String(body.content) : ''
  const slug = body?.slug?.trim() || generateSlug(title)
  const authorId = body?.author_id?.trim()
  const locationId = body?.location_id?.trim()
  const teamId = body?.team_id?.trim()
  const memberId = body?.member_id?.trim()
  const tags = Array.isArray(body?.tags) ? body.tags : []
  const isPinned = Boolean(body?.is_pinned)

  const now = new Date()
  const connectedTo: Record<string, unknown> = {}
  if (locationId) connectedTo.location_id = new ObjectId(locationId)
  if (teamId) connectedTo.team_id = new ObjectId(teamId)
  if (memberId) connectedTo.member_id = new ObjectId(memberId)

  const mentioned_unified_user_ids = content
    ? await resolveSlugsToUnifiedUserIds(collectMentionSlugsFromContent(content))
    : []

  const doc = {
    title,
    content,
    slug,
    author_id: authorId ? new ObjectId(authorId) : null,
    connected_to: connectedTo,
    connected_members: [],
    linked_todos: [],
    mentioned_unified_user_ids,
    tags,
    is_pinned: isPinned,
    is_archived: false,
    status: 'draft',
    created_at: now,
    updated_at: now,
  }

  const coll = await getNotesCollection()
  const { insertedId } = await coll.insertOne(doc)
  const note = await coll.findOne({ _id: insertedId })

  return { success: true, data: note }
})
