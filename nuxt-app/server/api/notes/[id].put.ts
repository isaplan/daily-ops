import { ObjectId } from 'mongodb'
import { getNotesCollection } from '../../utils/db'
import { collectMentionSlugsFromContent, resolveSlugsToUnifiedUserIds } from '../../utils/noteMentions'

function isMongoId(str: string): boolean {
  return /^[0-9a-f]{24}$/i.test(str)
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || id.trim() === '') {
    throw createError({ statusCode: 400, message: 'Invalid note identifier' })
  }

  const body = await readBody<{
    title?: string
    content?: string
    slug?: string
    status?: 'draft' | 'published'
    location_id?: string
    team_id?: string
    member_id?: string
    member_ids?: string[]
    visible_to_same_team_name?: boolean
    attending_unified_user_ids?: string[]
    tags?: string[]
    is_pinned?: boolean
    is_archived?: boolean
  }>(event)

  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Invalid body' })
  }

  const coll = await getNotesCollection()
  const filter = isMongoId(id) ? { _id: new ObjectId(id) } : { slug: id }

  const update: Record<string, unknown> = { updated_at: new Date() }
  if (body.title !== undefined) update.title = String(body.title).trim() || 'Untitled'
  if (body.content !== undefined) {
    update.content = String(body.content)
    const slugs = collectMentionSlugsFromContent(body.content)
    update.mentioned_unified_user_ids = await resolveSlugsToUnifiedUserIds(slugs)
  }
  if (body.slug !== undefined) update.slug = String(body.slug).trim()
  if (
    body.location_id !== undefined ||
    body.team_id !== undefined ||
    body.member_id !== undefined
  ) {
    const existing = await coll.findOne(filter)
    const existingCt = (existing?.connected_to as Record<string, unknown>) || {}
    update.connected_to = {
      ...existingCt,
      ...(body.location_id !== undefined && {
        location_id: body.location_id ? new ObjectId(body.location_id) : null,
      }),
      ...(body.team_id !== undefined && {
        team_id: body.team_id ? new ObjectId(body.team_id) : null,
      }),
      ...(body.member_id !== undefined && {
        member_id: body.member_id ? new ObjectId(body.member_id) : null,
      }),
    }
  }
  if (body.tags !== undefined) update.tags = Array.isArray(body.tags) ? body.tags : []
  if (body.visible_to_same_team_name !== undefined) update.visible_to_same_team_name = Boolean(body.visible_to_same_team_name)
  if (body.attending_unified_user_ids !== undefined) {
    const ids = Array.isArray(body.attending_unified_user_ids)
      ? body.attending_unified_user_ids.filter((id): id is string => typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id))
      : []
    update.attending_unified_user_ids = ids.map((id) => new ObjectId(id))
  }
  if (body.member_ids !== undefined) {
    const ids = Array.isArray(body.member_ids)
      ? body.member_ids.filter((id): id is string => typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id))
      : []
    update.connected_member_ids = ids.map((id) => new ObjectId(id))
  }
  if (body.is_pinned !== undefined) update.is_pinned = Boolean(body.is_pinned)
  if (body.is_archived !== undefined) update.is_archived = Boolean(body.is_archived)
  if (body.status !== undefined && (body.status === 'draft' || body.status === 'published')) {
    update.status = body.status
  }

  const result = await coll.findOneAndUpdate(
    filter,
    { $set: update },
    { returnDocument: 'after' }
  )

  if (!result) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  return { success: true, data: result }
})
