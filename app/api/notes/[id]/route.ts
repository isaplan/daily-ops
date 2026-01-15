/**
 * @registry-id: noteAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T14:30:00.000Z
 * @description: Single note API route - GET, PUT, DELETE with slug lookup
 * @last-fix: [2026-01-15] Added slug resolution and publish/unpublish action
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Note from '@/models/Note';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import mongoose from 'mongoose';
import { slugToFilter, generateSlug } from '@/lib/utils/slug';
import { getErrorMessage } from '@/lib/types/errors';
import type { INote } from '@/models/Note';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    if (!id || id === 'undefined' || id.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid note identifier' },
        { status: 400 }
      );
    }
    
    const filter = slugToFilter(id);
    
    // Try to find by the primary filter (slug or _id)
    let note = await Note.findOne(filter)
      .populate('author_id', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email')
      .populate('connected_members.member_id', 'name email');
    
    // If not found and we searched by slug, try by ID as fallback
    if (!note && !filter._id) {
      note = await Note.findById(id)
        .populate('author_id', 'name email')
        .populate('connected_to.location_id', 'name')
        .populate('connected_to.team_id', 'name')
        .populate('connected_to.member_id', 'name email')
        .populate('connected_members.member_id', 'name email');
    }
    
    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: note });
  } catch (error) {
    console.error('Error fetching note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch note' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id } = await params;
    const filter = slugToFilter(id);
    
    interface UpdateNoteData extends Partial<Pick<INote, 'title' | 'content' | 'tags' | 'is_pinned' | 'is_archived' | 'status' | 'published_at'>> {
      slug?: string;
      connected_to?: {
        location_id?: string;
        team_id?: string;
        member_id?: string;
      };
    }
    
    const updateData: UpdateNoteData = {
      title: body.title,
      content: body.content,
      connected_to: {
        location_id: body.location_id,
        team_id: body.team_id,
        member_id: body.member_id,
      },
      tags: body.tags,
      is_pinned: body.is_pinned,
      is_archived: body.is_archived,
    };
    
    // If title changed, regenerate slug
    if (body.title) {
      updateData.slug = generateSlug(body.title);
    }
    
    // Handle publish/unpublish
    const wasPublishing = body.publish === true;
    const wasUnpublishing = body.publish === false;
    
    if (wasPublishing) {
      updateData.status = 'published';
      updateData.published_at = new Date();
    } else if (wasUnpublishing) {
      updateData.status = 'draft';
      updateData.published_at = undefined;
    }
    
    const note = await Note.findOneAndUpdate(filter, updateData, { new: true, runValidators: true })
      .populate('author_id', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email')
      .populate('connected_members.member_id', 'name email');
    
    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }
    
    // Auto-parse todos when note is published
    if (wasPublishing && note.content) {
      try {
        // Import parse todos function dynamically to avoid circular dependencies
        const { parseTodosFromText } = await import('@/lib/utils/todoParser');
        const Member = (await import('@/models/Member')).default;
        const Todo = (await import('@/models/Todo')).default;
        
        const members = await Member.find({ is_active: true }).select('name email').lean();
        const parsedTodos = parseTodosFromText(note.content, members);
        
        if (parsedTodos.length > 0) {
          const todoIds = [];
          
          for (const parsedTodo of parsedTodos) {
            if (!parsedTodo.memberId) continue;
            
            // Check if todo already exists
            const existingTodo = await Todo.findOne({
              title: parsedTodo.title,
              assigned_to: parsedTodo.memberId,
              linked_note: note._id,
            });
            
            if (existingTodo) {
              // Update existing todo if needed
              if (parsedTodo.dueDate && (!existingTodo.due_date || existingTodo.due_date.getTime() !== parsedTodo.dueDate.getTime())) {
                existingTodo.due_date = parsedTodo.dueDate;
              }
              if (parsedTodo.priority !== existingTodo.priority) {
                existingTodo.priority = parsedTodo.priority;
              }
              await existingTodo.save();
              todoIds.push(existingTodo._id);
            } else {
              // Create new todo
              const todo = await Todo.create({
                title: parsedTodo.title,
                description: `Auto-generated from note: ${note.title}`,
                assigned_to: parsedTodo.memberId,
                created_by: note.author_id,
                priority: parsedTodo.priority,
                due_date: parsedTodo.dueDate,
                linked_note: note._id,
                connected_to: {
                  location_id: note.connected_to?.location_id,
                  team_id: note.connected_to?.team_id,
                  member_id: parsedTodo.memberId,
                },
                status: 'pending',
              });
              todoIds.push(todo._id);
            }
          }
          
          // Update note's linked_todos array
          const existingTodoIds = note.linked_todos.map((tid) => tid.toString());
          const newTodoIds = todoIds.filter((tid) => !existingTodoIds.includes(tid.toString()));
          
          if (newTodoIds.length > 0) {
            note.linked_todos = [...note.linked_todos, ...newTodoIds];
            await note.save();
          }
        }
      } catch (parseError) {
        // Log error but don't fail the publish operation
        console.error('Error auto-parsing todos on publish:', parseError);
      }
    }
    
    return NextResponse.json({ success: true, data: note });
  } catch (error: unknown) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const filter = slugToFilter(id);
    const note = await Note.findOneAndDelete(filter);
    
    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'Note deleted' });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
