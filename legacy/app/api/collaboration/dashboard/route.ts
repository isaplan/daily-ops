/**
 * @registry-id: collaborationDashboardAPI
 * @created: 2026-01-16T15:45:00.000Z
 * @last-modified: 2026-01-16T15:45:00.000Z
 * @description: API route for Collaboration dashboard data aggregation
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Collaboration dashboard
 * 
 * @imports-from:
 *   - app/lib/types/collaboration.types.ts => CollaborationDashboardData, CollaborationFilters types
 *   - app/models/Note.ts => Note model
 *   - app/models/Todo.ts => Todo model
 *   - app/models/Decision.ts => Decision model
 *   - app/models/Event.ts => Event model
 * 
 * @exports-to:
 *   ✓ app/lib/services/collaborationService.ts => Calls this API route
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Note from '@/models/Note'
import Todo from '@/models/Todo'
import Decision from '@/models/Decision'
import Event from '@/models/Event'
import type { CollaborationDashboardData, CollaborationFilters } from '@/lib/types/collaboration.types'

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location_id')
    const teamId = searchParams.get('team_id')
    const memberId = searchParams.get('member_id')
    const archived = searchParams.get('archived') === 'true'
    const skip = parseInt(searchParams.get('skip') || '0', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

    const filters: Record<string, unknown> = {}
    if (locationId) {
      filters['connected_to.location_id'] = locationId
    }
    if (teamId) {
      filters['connected_to.team_id'] = teamId
    }
    if (memberId) {
      filters['connected_to.member_id'] = memberId
    }
    if (archived !== undefined) {
      filters.is_archived = archived
    }

    const [notes, todos, decisions, events, notesTotal, todosTotal, decisionsTotal, eventsTotal] = await Promise.all([
      Note.find(filters).skip(skip).limit(limit).sort({ created_at: -1 }).lean(),
      Todo.find(filters).skip(skip).limit(limit).sort({ created_at: -1 }).lean(),
      Decision.find(filters).skip(skip).limit(limit).sort({ created_at: -1 }).lean(),
      Event.find(filters).skip(skip).limit(limit).sort({ start_date: -1 }).lean(),
      Note.countDocuments(filters),
      Todo.countDocuments(filters),
      Decision.countDocuments(filters),
      Event.countDocuments(filters),
    ])

    const dashboardData: CollaborationDashboardData = {
      notes: notes.map((note) => ({
        _id: note._id.toString(),
        title: note.title,
        content: note.content,
        slug: note.slug,
        author_id: note.author_id?.toString(),
        connected_to: note.connected_to,
        tags: note.tags,
        is_pinned: note.is_pinned,
        is_archived: note.is_archived,
        status: note.status,
        created_at: note.created_at?.toISOString() || new Date().toISOString(),
        updated_at: note.updated_at?.toISOString() || new Date().toISOString(),
      })),
      todos: todos.map((todo) => ({
        _id: todo._id.toString(),
        title: todo.title,
        description: todo.description,
        status: todo.status,
        priority: todo.priority,
        assigned_to: todo.assigned_to?.toString(),
        created_by: todo.created_by?.toString(),
        created_at: todo.created_at?.toISOString() || new Date().toISOString(),
        updated_at: todo.updated_at?.toISOString() || new Date().toISOString(),
      })),
      decisions: decisions.map((decision) => ({
        _id: decision._id.toString(),
        title: decision.title,
        description: decision.description,
        status: decision.status,
        created_at: decision.created_at?.toISOString() || new Date().toISOString(),
        connected_to: decision.connected_to
          ? {
              location_id: decision.connected_to.location_id?.toString(),
              team_id: decision.connected_to.team_id?.toString(),
            }
          : undefined,
      })),
      events: events.map((event) => ({
        _id: event._id.toString(),
        name: event.name,
        date: event.date?.toISOString() || new Date().toISOString(),
        status: event.status,
        connected_to: event.location_id
          ? {
              location_id: event.location_id.toString(),
            }
          : undefined,
      })),
      summary: {
        total_notes: notesTotal,
        total_todos: todosTotal,
        total_decisions: decisionsTotal,
        total_events: eventsTotal,
      },
    }

    return NextResponse.json({ success: true, data: dashboardData })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch collaboration dashboard data' },
      { status: 500 }
    )
  }
}
