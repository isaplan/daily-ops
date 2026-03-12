/**
 * Member connections: notes connected to this member, with todos and decisions (agrees) parsed from note content.
 * Matches Next.js GET /api/members/[id]/connections shape for ConnectionsDisplay-style UI.
 */

import { ObjectId } from 'mongodb'
import { getNotesCollection } from '../../../utils/db'
import { parseBlockNoteContent } from '../../../../types/noteBlock'

const NOTES_LIMIT = 50
const DETAIL_SLICE = 5

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f]{24}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid member id' })
  }
  const oid = new ObjectId(id)
  const coll = await getNotesCollection()
  const notes = await coll
    .find({
      is_archived: { $ne: true },
      $or: [{ 'connected_to.member_id': oid }, { connected_member_ids: oid }],
    })
    .sort({ is_pinned: -1, created_at: -1 })
    .limit(NOTES_LIMIT)
    .toArray()

  const notesList = notes.map((n: Record<string, unknown>) => ({
    _id: String(n._id),
    slug: n.slug,
    title: (n.title as string) || 'Untitled',
    content: typeof n.content === 'string' ? (n.content as string).slice(0, 200) : '',
    created_at: (n.created_at as string) ?? null,
  }))

  type TodoItem = { _id: string; text: string; checked: boolean; noteId: string; noteSlug?: string; noteTitle: string }
  type DecisionItem = { _id: string; text: string; noteId: string; noteSlug?: string; noteTitle: string }
  const todosList: TodoItem[] = []
  const decisionsList: DecisionItem[] = []

  for (const note of notes) {
    const content = note.content as string | undefined
    if (!content) continue
    const blocks = parseBlockNoteContent(content)
    if (!blocks?.length) continue
    const noteId = String(note._id)
    const noteSlug = note.slug as string | undefined
    const noteTitle = (note.title as string) || 'Untitled'
    for (const block of blocks) {
      for (const t of block.todos ?? []) {
        todosList.push({
          _id: t.id,
          text: t.text,
          checked: t.checked ?? false,
          noteId,
          noteSlug,
          noteTitle,
        })
      }
      for (const a of block.agrees ?? []) {
        decisionsList.push({
          _id: a.id,
          text: a.text,
          noteId,
          noteSlug,
          noteTitle,
        })
      }
    }
  }

  return {
    success: true,
    data: {
      notes: notesList.length,
      todos: todosList.length,
      decisions: decisionsList.length,
      channels: 0,
      details: {
        notes: notesList.slice(0, DETAIL_SLICE),
        todos: todosList.slice(0, DETAIL_SLICE),
        decisions: decisionsList.slice(0, DETAIL_SLICE),
        channels: [],
      },
    },
  }
})
