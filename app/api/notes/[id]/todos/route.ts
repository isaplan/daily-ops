/**
 * @registry-id: noteTodosAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Add/remove todos from a note
 * @last-fix: [2026-01-15] Initial implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Note from '@/models/Note';
import Todo from '@/models/Todo';
import { getErrorMessage } from '@/lib/types/errors';
import mongoose from 'mongoose';

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
    
    const note = await Note.findById(id);
    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
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
    
    const todoObjectId = new mongoose.Types.ObjectId(todo_id);
    if (!note.linked_todos.some(t => t.toString() === todo_id)) {
      note.linked_todos.push(todoObjectId);
      await note.save();
    }
    
    todo.linked_note = new mongoose.Types.ObjectId(id);
    await todo.save();
    
    await note.populate('linked_todos');
    await note.populate('author_id', 'name email');
    
    return NextResponse.json({ success: true, data: note });
  } catch (error: unknown) {
    console.error('Error adding todo to note:', error);
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
    const { searchParams } = new URL(request.url);
    const todo_id = searchParams.get('todo_id');
    
    if (!todo_id) {
      return NextResponse.json(
        { success: false, error: 'todo_id is required' },
        { status: 400 }
      );
    }
    
    const note = await Note.findById(id);
    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }
    
    note.linked_todos = note.linked_todos.filter(
      (linkedId) => linkedId.toString() !== todo_id
    );
    await note.save();
    
    await Todo.findByIdAndUpdate(todo_id, { $unset: { linked_note: 1 } });
    
    await note.populate('linked_todos');
    await note.populate('author_id', 'name email');
    
    return NextResponse.json({ success: true, data: note });
  } catch (error: unknown) {
    console.error('Error removing todo from note:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
