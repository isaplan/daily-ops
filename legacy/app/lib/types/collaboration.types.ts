/**
 * @registry-id: collaborationTypes
 * @created: 2026-01-16T15:45:00.000Z
 * @last-modified: 2026-01-16T15:45:00.000Z
 * @description: Type definitions for Collaboration dashboard data
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Collaboration dashboard
 * 
 * @exports-to:
 *   ✓ app/lib/services/collaborationService.ts => Uses Collaboration types
 *   ✓ app/lib/viewmodels/useCollaborationViewModel.ts => Uses Collaboration types
 *   ✓ app/api/collaboration/** => API routes use Collaboration types
 */

import type { Note } from '@/lib/types/note.types'
import type { Todo } from '@/lib/types/todo.types'

export interface CollaborationDashboardData {
  notes: Note[]
  todos: Todo[]
  decisions: Array<{
    _id: string
    title: string
    description: string
    status: 'proposed' | 'approved' | 'rejected' | 'implemented'
    created_at: string
    connected_to?: {
      location_id?: string | { _id: string; name: string }
      team_id?: string | { _id: string; name: string }
    }
  }>
  events: Array<{
    _id: string
    name: string
    date: string
    status: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
    connected_to?: {
      location_id?: string | { _id: string; name: string }
    }
  }>
  summary: {
    total_notes: number
    total_todos: number
    total_decisions: number
    total_events: number
  }
}

export interface CollaborationFilters {
  location_id?: string
  team_id?: string
  member_id?: string
  archived?: boolean
}

export interface CollaborationPagination {
  skip: number
  limit: number
}
