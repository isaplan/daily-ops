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
  /** When true, note is readable by users in a team with the same name at any location (e.g. all "Kitchen" teams). */
  visible_to_same_team_name?: boolean
  tags?: string[]
  is_pinned: boolean
  is_archived: boolean
  status?: 'draft' | 'published'
  created_at: string
  updated_at: string
  /** Set when note is in trash (soft-delete). Omitted or null = active. */
  deleted_at?: string | null
  /** Populated from unified_users when fetching a single note */
  mentioned_members?: { _id: string; canonicalName: string }[]
  /** Populated when fetching a single note; IDs of users attending/collaborating (notified on share). */
  attending_members?: { _id: string; canonicalName: string }[]
  /** Member IDs connected to this note (from members collection). Populated when fetching; may be empty if only legacy member_id exists. */
  connected_member_ids?: string[]
}

export interface NotesListResponse {
  success: boolean
  data: Note[]
}

export interface NoteResponse {
  success: boolean
  data: Note
}
