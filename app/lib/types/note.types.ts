/**
 * @registry-id: noteTypes
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Note type definitions - DTOs, filters, form data
 * @last-fix: [2026-01-24] Extended Note/Update DTO to match API response shape
 * 
 * @exports-to:
 *   ✓ app/lib/services/noteService.ts => Uses Note types
 *   ✓ app/lib/viewmodels/useNoteViewModel.ts => Uses Note types
 *   ✓ app/components/NoteForm.tsx => Uses Note types
 */

export interface Note {
  _id: string
  title: string
  content: string
  slug?: string
  author_id?: string | { _id: string; name: string; email: string }
  connected_members?: NoteMember[]
  linked_todos?: string[]
  connected_to?: {
    location_id?: string | { _id: string; name: string }
    team_id?: string | { _id: string; name: string }
    member_id?: string | { _id: string; name: string }
  }
  tags?: string[]
  is_pinned: boolean
  is_archived: boolean
  status?: 'draft' | 'published'
  published_at?: string
  created_at: string
  updated_at: string
}

export interface NoteMember {
  _id: string
  member_id: { _id: string; name: string; email?: string } | string
  role?: 'responsible' | 'attending' | 'reviewer' | 'contributor'
  added_at?: string
}

export interface CreateNoteDto {
  title: string
  content: string
  author_id?: string
  location_id?: string
  team_id?: string
  member_id?: string
  tags?: string[]
  is_pinned?: boolean
}

export type UpdateNoteDto = Partial<CreateNoteDto> & {
  is_archived?: boolean
  publish?: boolean
}

export interface NoteFilters {
  location_id?: string
  team_id?: string
  member_id?: string
  archived?: boolean
  viewing_member_id?: string
}

export interface NoteFormData {
  title: string
  content: string
  location_id: string
  team_id: string
  member_id: string
  tags: string
  is_pinned: boolean
}
