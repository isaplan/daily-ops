/**
 * @registry-id: todoListsAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: TodoLists API route - GET and POST
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/components/todos/** => TodoList display components
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TodoList from '@/models/TodoList';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const location_id = searchParams.get('location_id');
    const team_id = searchParams.get('team_id');
    const is_archived = searchParams.get('is_archived');
    
    const query: any = {};
    if (location_id) {
      query['connected_to.location_id'] = location_id;
    }
    if (team_id) {
      query['connected_to.team_id'] = team_id;
    }
    if (is_archived !== null && is_archived !== undefined) {
      query.is_archived = is_archived === 'true';
    }
    
    const lists = await TodoList.find(query)
      .populate('created_by', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('todos')
      .sort({ created_at: -1 })
      .limit(100);
    
    return NextResponse.json({ success: true, data: lists });
  } catch (error) {
    console.error('Error fetching todo lists:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch todo lists' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const list = await TodoList.create({
      name: body.name,
      description: body.description,
      created_by: body.created_by,
      connected_to: {
        location_id: body.location_id,
        team_id: body.team_id,
      },
      is_public: body.is_public || false,
      todos: body.todos || [],
    });
    
    await list.populate('created_by', 'name email');
    await list.populate('connected_to.location_id', 'name');
    await list.populate('connected_to.team_id', 'name');
    
    return NextResponse.json({ success: true, data: list }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating todo list:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create todo list' },
      { status: 400 }
    );
  }
}
