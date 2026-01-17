/**
 * @registry-id: searchAPI
 * @created: 2026-01-16T22:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: Search API route - search across notes, todos, decisions, events with pagination
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/models/Note.ts => Note model
 *   - app/models/Todo.ts => Todo model
 *   - app/models/Decision.ts => Decision model
 *   - app/models/Event.ts => Event model
 *   - app/lib/types/errors.ts => Error handling utilities
 * 
 * @exports-to:
 *   ✓ app/lib/services/searchService.ts => Search service calls this endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Note from '@/models/Note'
import Todo from '@/models/Todo'
import Decision from '@/models/Decision'
import Event from '@/models/Event'
import { getErrorMessage } from '@/lib/types/errors'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const types = searchParams.get('types')?.split(',') || ['note', 'todo', 'decision', 'event']
    const skip = parseInt(searchParams.get('skip') || '0', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            results: [],
            total: 0,
            skip: 0,
            limit,
          },
        },
        { status: 200 }
      )
    }

    const searchRegex = new RegExp(query.trim(), 'i')
    const results: Array<{
      type: string
      id: string
      title: string
      content?: string
      description?: string
      slug?: string
      status?: string
    }> = []

    // Search Notes
    if (types.includes('note')) {
      const notes = await Note.find({
        $or: [
          { title: searchRegex },
          { content: searchRegex },
          { tags: { $in: [searchRegex] } },
        ],
        is_archived: false,
      })
        .select('_id title content slug status')
        .skip(skip)
        .limit(limit)
        .lean()

      results.push(
        ...notes.map((note) => ({
          type: 'note',
          id: note._id.toString(),
          title: note.title,
          content: note.content,
          slug: note.slug,
          status: note.status,
        }))
      )
    }

    // Search Todos
    if (types.includes('todo')) {
      const todos = await Todo.find({
        $or: [{ title: searchRegex }, { description: searchRegex }],
      })
        .select('_id title description status')
        .skip(skip)
        .limit(limit)
        .lean()

      results.push(
        ...todos.map((todo) => ({
          type: 'todo',
          id: todo._id.toString(),
          title: todo.title,
          description: todo.description,
          status: todo.status,
        }))
      )
    }

    // Search Decisions
    if (types.includes('decision')) {
      const decisions = await Decision.find({
        $or: [{ title: searchRegex }, { description: searchRegex }],
      })
        .select('_id title description status')
        .skip(skip)
        .limit(limit)
        .lean()

      results.push(
        ...decisions.map((decision) => ({
          type: 'decision',
          id: decision._id.toString(),
          title: decision.title,
          description: decision.description,
          status: decision.status,
        }))
      )
    }

    // Search Events
    if (types.includes('event')) {
      const events = await Event.find({
        $or: [{ name: searchRegex }, { client_name: searchRegex }],
      })
        .select('_id name client_name status')
        .skip(skip)
        .limit(limit)
        .lean()

      results.push(
        ...events.map((event) => ({
          type: 'event',
          id: event._id.toString(),
          title: event.name,
          description: event.client_name,
          status: event.status,
        }))
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        total: results.length,
        skip,
        limit,
      },
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}
