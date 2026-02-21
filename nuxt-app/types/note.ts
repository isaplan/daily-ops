export interface Note {
  _id: string
  title: string
  content: string
  slug?: string
  author_id?: string | { _id: string; name: string; email?: string }
  connected_to?: {
    location_id?: string | { _id: string; name: string }
    team_id?: string | { _id: string; name: string }
    member_id?: string | { _id: string; name: string }
  }
  tags?: string[]
  is_pinned: boolean
  is_archived: boolean
  status?: 'draft' | 'published'
  created_at: string
  updated_at: string
  /** Populated from unified_users when fetching a single note */
  mentioned_members?: { _id: string; canonicalName: string }[]
}

export interface NotesListResponse {
  success: boolean
  data: Note[]
}

export interface NoteResponse {
  success: boolean
  data: Note
}
