import { ObjectId } from 'mongodb'
import { getNotesCollection } from '../../utils/db'

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
    location_id?: string
    team_id?: string
    member_id?: string
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
  if (body.content !== undefined) update.content = String(body.content)
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
  if (body.is_pinned !== undefined) update.is_pinned = Boolean(body.is_pinned)
  if (body.is_archived !== undefined) update.is_archived = Boolean(body.is_archived)

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
