import { ObjectId } from 'mongodb'
import { getNotesCollection } from '../../../../utils/db'

function isMongoId(str: string): boolean {
  return /^[0-9a-f]{24}$/i.test(str)
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const todoId = getRouterParam(event, 'todoId')
  if (!id?.trim() || !todoId?.trim()) {
    throw createError({ statusCode: 400, message: 'Invalid note or todo id' })
  }

  const body = await readBody<{ checked: boolean; doneBy?: string; doneAt?: string }>(event)
  if (!body || typeof body.checked !== 'boolean') {
    throw createError({ statusCode: 400, message: 'Body must include checked: boolean' })
  }

  const coll = await getNotesCollection()
  const filter = isMongoId(id) ? { _id: new ObjectId(id) } : { slug: id }
  const note = await coll.findOne(filter)
  if (!note) throw createError({ statusCode: 404, message: 'Note not found' })

  const raw = (note.content ?? '').trim()
  if (!raw.startsWith('{"version":2') || !raw.includes('"blocks"')) {
    throw createError({ statusCode: 400, message: 'Note content is not block format' })
  }

  let doc: { version: number; blocks: Array<{ id?: string; todos?: Array<{ id: string; text?: string; checked?: boolean; doneBy?: string; doneAt?: string }> }> }
  try {
    doc = JSON.parse(raw) as typeof doc
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid note content JSON' })
  }
  if (doc.version !== 2 || !Array.isArray(doc.blocks)) {
    throw createError({ statusCode: 400, message: 'Invalid block document' })
  }

  let found = false
  for (const block of doc.blocks) {
    const todos = block.todos ?? []
    for (let i = 0; i < todos.length; i++) {
      if (todos[i].id === todoId) {
        found = true
        todos[i].checked = body.checked
        if (body.checked) {
          todos[i].doneBy = typeof body.doneBy === 'string' ? body.doneBy.trim() : undefined
          todos[i].doneAt = typeof body.doneAt === 'string' ? body.doneAt : new Date().toISOString()
        } else {
          todos[i].doneBy = undefined
          todos[i].doneAt = undefined
        }
        break
      }
    }
    if (found) break
  }

  if (!found) throw createError({ statusCode: 404, message: 'Todo not found in note' })

  const newContent = JSON.stringify(doc)
  await coll.updateOne(filter, { $set: { content: newContent, updated_at: new Date() } })

  return { success: true }
})
