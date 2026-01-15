/**
 * @registry-id: todosAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Todos API route - GET and POST with manager role filtering and public visibility
 * @last-fix: [2026-01-15] Added manager role filtering, public visibility, list_id, linked_note, linked_chat support
 * 
 * @exports-to:
 * ✓ app/components/todos/** => Todo display components
 * ✓ app/pages/todos/** => Todo pages
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Todo from '@/models/Todo';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import { getErrorMessage } from '@/lib/types/errors';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const list_id = searchParams.get('list_id');
    const location_id = searchParams.get('location_id');
    const team_id = searchParams.get('team_id');
    const linked_note = searchParams.get('linked_note');
    const linked_chat = searchParams.get('linked_chat');
    const is_public = searchParams.get('is_public');
    const current_user_id = searchParams.get('current_user_id');
    
    interface TodoQuery {
      status?: string;
      list_id?: string;
      'connected_to.location_id'?: string;
      'connected_to.team_id'?: string;
      linked_note?: string;
      linked_chat?: string;
      is_public?: boolean;
      $or?: Array<Record<string, unknown>>;
    }
    
    const query: TodoQuery = {};
    
    if (status) {
      query.status = status;
    }
    if (list_id) {
      query.list_id = list_id;
    }
    if (location_id) {
      query['connected_to.location_id'] = location_id;
    }
    if (team_id) {
      query['connected_to.team_id'] = team_id;
    }
    if (linked_note) {
      query.linked_note = linked_note;
    }
    if (linked_chat) {
      query.linked_chat = linked_chat;
    }
    
    let isOverallManager = false;
    if (current_user_id) {
      const currentUser = await Member.findById(current_user_id);
      if (currentUser) {
        isOverallManager = currentUser.roles.some(
          (r) => r.role === 'overall_manager' && r.scope === 'company'
        );
      }
    }
    
    if (isOverallManager) {
      if (is_public === 'true') {
        query.is_public = true;
      }
    } else {
      if (current_user_id) {
        query.$or = [
          { assigned_to: current_user_id },
          { created_by: current_user_id },
          { 'connected_to.member_id': current_user_id },
          { is_public: true },
        ];
      } else if (is_public === 'true') {
        query.is_public = true;
      }
    }
    
    // Ensure all models are registered before populating
    if (!mongoose.models.Member) {
      await import('@/models/Member');
    }
    if (!mongoose.models.Location) {
      await import('@/models/Location');
    }
    if (!mongoose.models.Team) {
      await import('@/models/Team');
    }
    if (!mongoose.models.TodoList) {
      await import('@/models/TodoList');
    }
    
    const todos = await Todo.find(query)
      .populate('assigned_to', 'name email')
      .populate('created_by', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email')
      .populate('list_id', 'name')
      .populate('linked_note', 'title')
      .populate('linked_chat', 'text')
      .sort({ created_at: -1 })
      .limit(100);
    
    return NextResponse.json({ success: true, data: todos });
  } catch (error) {
    console.error('Error fetching todos:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch todos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const todo = await Todo.create({
      title: body.title,
      description: body.description,
      status: body.status || 'pending',
      priority: body.priority || 'medium',
      assigned_to: body.assigned_to,
      created_by: body.created_by,
      connected_to: {
        location_id: body.location_id,
        team_id: body.team_id,
        member_id: body.member_id,
      },
      list_id: body.list_id,
      linked_note: body.linked_note,
      linked_chat: body.linked_chat,
      is_public: body.is_public || false,
      due_date: body.due_date,
    });
    
    if (body.list_id) {
      const TodoList = (await import('@/models/TodoList')).default;
      await TodoList.findByIdAndUpdate(body.list_id, {
        $addToSet: { todos: todo._id },
      });
    }
    
    if (body.linked_note) {
      const Note = (await import('@/models/Note')).default;
      await Note.findByIdAndUpdate(body.linked_note, {
        $addToSet: { linked_todos: todo._id },
      });
    }
    
    await todo.populate('assigned_to', 'name email');
    await todo.populate('created_by', 'name email');
    await todo.populate('list_id', 'name');
    await todo.populate('linked_note', 'title');
    await todo.populate('linked_chat', 'text');
    
    return NextResponse.json({ success: true, data: todo }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating todo:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
