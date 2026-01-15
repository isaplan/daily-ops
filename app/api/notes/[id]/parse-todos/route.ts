/**
 * @registry-id: noteParseTodosAPI
 * @created: 2026-01-15T15:30:00.000Z
 * @last-modified: 2026-01-15T15:30:00.000Z
 * @description: Parse todos from note content and create them
 * @last-fix: [2026-01-15] Initial implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Note from '@/models/Note';
import Todo from '@/models/Todo';
import Member from '@/models/Member';
import { slugToFilter } from '@/lib/utils/slug';
import { parseTodosFromText } from '@/lib/utils/todoParser';
import { getErrorMessage } from '@/lib/types/errors';
import mongoose from 'mongoose';

export async function POST(
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
    const note = await Note.findOne(filter);
    
    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }
    
    // Get all members for parsing
    const members = await Member.find({ is_active: true }).select('name email').lean();
    
    // Parse todos from note content
    const parsedTodos = parseTodosFromText(note.content, members);
    
    if (parsedTodos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No todos found in note content',
        data: { todos: [], count: 0 },
      });
    }
    
    // Create todos
    const createdTodos = [];
    const todoIds = [];
    
    for (const parsedTodo of parsedTodos) {
      if (!parsedTodo.memberId) continue;
      
      // Check if todo already exists (same title, same member, linked to same note)
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
        createdTodos.push(existingTodo);
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
        
        await todo.populate('assigned_to', 'name email');
        await todo.populate('created_by', 'name email');
        
        createdTodos.push(todo);
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
    
    return NextResponse.json({
      success: true,
      message: `Created ${createdTodos.length} todo(s) from note content`,
      data: {
        todos: createdTodos,
        count: createdTodos.length,
      },
    });
  } catch (error: unknown) {
    console.error('Error parsing todos from note:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
