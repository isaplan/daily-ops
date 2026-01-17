/**
 * @registry-id: todoAPI
 * @created: 2026-01-16T22:30:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Single todo API route - GET, PUT, DELETE
 * @last-fix: [2026-01-16] Initial implementation with full CRUD
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import mongoose from 'mongoose'
import Todo from '@/models/Todo'
import Member from '@/models/Member'
import Location from '@/models/Location'
import Team from '@/models/Team'
import { getErrorMessage } from '@/lib/types/errors'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()

    // Ensure all models are registered
    if (!mongoose.models.Member) {
      await import('@/models/Member')
    }
    if (!mongoose.models.Location) {
      await import('@/models/Location')
    }
    if (!mongoose.models.Team) {
      await import('@/models/Team')
    }

    const { id } = await params
    const todo = await Todo.findById(id)
      .populate('assigned_to', 'name email')
      .populate('created_by', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email')
      .populate('list_id', 'name')
      .populate('linked_note', 'title')
      .populate('linked_chat', 'text')

    if (!todo) {
      return NextResponse.json(
        { success: false, error: 'Todo not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: todo })
  } catch (error: unknown) {
    console.error('Error fetching todo:', error)
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const body = await request.json()
    const { id } = await params

    const updateData: Record<string, unknown> = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.status !== undefined) updateData.status = body.status
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.due_date !== undefined) updateData.due_date = body.due_date
    if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to
    if (body.connected_to !== undefined) updateData.connected_to = body.connected_to
    if (body.list_id !== undefined) updateData.list_id = body.list_id

    const todo = await Todo.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('assigned_to', 'name email')
      .populate('created_by', 'name email')

    if (!todo) {
      return NextResponse.json(
        { success: false, error: 'Todo not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: todo })
  } catch (error: unknown) {
    console.error('Error updating todo:', error)
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params

    const todo = await Todo.findByIdAndDelete(id)

    if (!todo) {
      return NextResponse.json(
        { success: false, error: 'Todo not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: 'Todo deleted' })
  } catch (error: unknown) {
    console.error('Error deleting todo:', error)
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
