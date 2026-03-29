/**
 * @registry-id: noteSchema
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Note Zod validation schemas
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/types/note.types.ts => Note types
 * 
 * @exports-to:
 *   ✓ app/components/NoteForm.tsx => Uses schema for form validation
 */

import { z } from 'zod'

export const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  author_id: z.string().optional(),
  location_id: z.string().optional(),
  team_id: z.string().optional(),
  member_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_pinned: z.boolean().optional(),
})

export const updateNoteSchema = createNoteSchema.partial()

export type CreateNoteInput = z.infer<typeof createNoteSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
