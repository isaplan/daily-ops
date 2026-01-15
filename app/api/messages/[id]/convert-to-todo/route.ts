/**
 * @registry-id: convertMessageToTodoAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Convert a chat message to a todo
 * @last-fix: [2026-01-15] Initial implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Message from '@/models/Message';
import Todo from '@/models/Todo';
import Channel from '@/models/Channel';
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
    
    const message = await Message.findById(id)
      .populate('channel_id')
      .populate('member_id');
    
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }
    
    const channel = await Channel.findById(message.channel_id);
    if (!channel) {
      return NextResponse.json(
        { success: false, error: 'Channel not found' },
        { status: 404 }
      );
    }
    
    const todo = await Todo.create({
      title: body.title || message.text.substring(0, 100),
      description: body.description || message.text,
      status: body.status || 'pending',
      priority: body.priority || 'medium',
      assigned_to: body.assigned_to || message.member_id,
      created_by: body.created_by || message.member_id,
      connected_to: {
        location_id: body.location_id || channel.location_id,
        team_id: body.team_id || channel.team_id,
      },
      linked_chat: message._id,
      is_public: body.is_public || false,
      due_date: body.due_date,
    });
    
    message.linked_todo = todo._id;
    await message.save();
    
    await todo.populate('assigned_to', 'name email');
    await todo.populate('created_by', 'name email');
    await todo.populate('linked_chat', 'text');
    
    if (body.list_id) {
      const TodoList = (await import('@/models/TodoList')).default;
      await TodoList.findByIdAndUpdate(body.list_id, {
        $addToSet: { todos: todo._id },
      });
      todo.list_id = new mongoose.Types.ObjectId(body.list_id);
      await todo.save();
      await todo.populate('list_id', 'name');
    }
    
    return NextResponse.json({ success: true, data: todo }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error converting message to todo:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
