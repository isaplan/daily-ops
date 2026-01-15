/**
 * @registry-id: noteService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Note API service - CRUD operations for notes
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useNoteViewModel.ts => Uses noteService for API calls
 */

import { ApiService, type ApiResponse } from './base'

export interface Note {
  _id: string
  title: string
  content: string
  slug?: string
  author_id?: string | { _id: string; name: string; email: string }
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
}

export interface NoteFilters {
  location_id?: string
  team_id?: string
  member_id?: string
  archived?: boolean
  viewing_member_id?: string
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

export interface UpdateNoteDto extends Partial<CreateNoteDto> {}

class NoteService extends ApiService {
  constructor() {
    super('/api')
  }

  async getAll(filters?: NoteFilters): Promise<ApiResponse<Note[]>> {
    const params = new URLSearchParams()
    if (filters?.location_id) params.append('location_id', filters.location_id)
    if (filters?.team_id) params.append('team_id', filters.team_id)
    if (filters?.member_id) params.append('member_id', filters.member_id)
    if (filters?.archived !== undefined) params.append('archived', String(filters.archived))
    if (filters?.viewing_member_id) params.append('viewing_member_id', filters.viewing_member_id)

    const query = params.toString()
    return this.get<Note[]>(`/notes${query ? `?${query}` : ''}`)
  }

  async getById(id: string): Promise<ApiResponse<Note>> {
    return this.get<Note>(`/notes/${id}`)
  }

  async getBySlug(slug: string): Promise<ApiResponse<Note>> {
    return this.get<Note>(`/notes?slug=${slug}`)
  }

  async create(data: CreateNoteDto): Promise<ApiResponse<Note>> {
    return this.post<Note>('/notes', data)
  }

  async update(id: string, data: UpdateNoteDto): Promise<ApiResponse<Note>> {
    return this.put<Note>(`/notes/${id}`, data)
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/notes/${id}`)
  }

  async parseTodos(id: string): Promise<ApiResponse<{ todos: any[] }>> {
    return this.post<{ todos: any[] }>(`/notes/${id}/parse-todos`, {})
  }

  async getMembers(id: string): Promise<ApiResponse<any[]>> {
    return this.get<any[]>(`/notes/${id}/members`)
  }
}

export const noteService = new NoteService()
