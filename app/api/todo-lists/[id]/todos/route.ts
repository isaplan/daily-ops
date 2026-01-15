/**
 * @registry-id: todoListTodosAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Add/remove todos from a todo list
 * @last-fix: [2026-01-15] Initial implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TodoList from '@/models/TodoList';
import Todo from '@/models/Todo';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id } = await params;
    const { todo_id } = body;
    
    if (!todo_id) {
      return NextResponse.json(
        { success: false, error: 'todo_id is required' },
        { status: 400 }
      );
    }
    
    const list = await TodoList.findById(id);
    if (!list) {
      return NextResponse.json(
        { success: false, error: 'Todo list not found' },
        { status: 404 }
      );
    }
    
    const todo = await Todo.findById(todo_id);
    if (!todo) {
      return NextResponse.json(
        { success: false, error: 'Todo not found' },
        { status: 404 }
      );
    }
    
    if (!list.todos.includes(todo_id as any)) {
      list.todos.push(todo_id as any);
      await list.save();
    }
    
    todo.list_id = id as any;
    await todo.save();
    
    await list.populate('todos');
    
    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    console.error('Error adding todo to list:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add todo to list' },
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
    const { searchParams } = new URL(request.url);
    const todo_id = searchParams.get('todo_id');
    
    if (!todo_id) {
      return NextResponse.json(
        { success: false, error: 'todo_id is required' },
        { status: 400 }
      );
    }
    
    const list = await TodoList.findById(id);
    if (!list) {
      return NextResponse.json(
        { success: false, error: 'Todo list not found' },
        { status: 404 }
      );
    }
    
    list.todos = list.todos.filter(
      (id) => id.toString() !== todo_id
    ) as any;
    await list.save();
    
    await Todo.findByIdAndUpdate(todo_id, { $unset: { list_id: 1 } });
    
    await list.populate('todos');
    
    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    console.error('Error removing todo from list:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove todo from list' },
      { status: 400 }
    );
  }
}
