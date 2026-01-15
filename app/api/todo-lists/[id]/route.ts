/**
 * @registry-id: todoListByIdAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Individual TodoList API route - GET, PATCH, DELETE
 * @last-fix: [2026-01-15] Initial implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TodoList from '@/models/TodoList';
import Todo from '@/models/Todo';
import { getErrorMessage } from '@/lib/types/errors';
import type { ITodoList } from '@/models/TodoList';
import mongoose from 'mongoose';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const list = await TodoList.findById(id)
      .populate('created_by', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate({
        path: 'todos',
        populate: [
          { path: 'assigned_to', select: 'name email' },
          { path: 'created_by', select: 'name email' },
        ],
      });
    
    if (!list) {
      return NextResponse.json(
        { success: false, error: 'Todo list not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching todo list:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch todo list' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id } = await params;
    
    const updateData: Partial<ITodoList> & { connected_to?: { location_id?: string; team_id?: string } } = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.is_public !== undefined) updateData.is_public = body.is_public;
    if (body.is_archived !== undefined) updateData.is_archived = body.is_archived;
    if (body.location_id !== undefined || body.team_id !== undefined) {
      updateData.connected_to = {};
      if (body.location_id !== undefined) {
        updateData.connected_to.location_id = body.location_id;
      }
      if (body.team_id !== undefined) {
        updateData.connected_to.team_id = body.team_id;
      }
    }
    
    const list = await TodoList.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('created_by', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name');
    
    if (!list) {
      return NextResponse.json(
        { success: false, error: 'Todo list not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: list });
  } catch (error: unknown) {
    console.error('Error updating todo list:', error);
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
    
    const list = await TodoList.findById(id);
    if (!list) {
      return NextResponse.json(
        { success: false, error: 'Todo list not found' },
        { status: 404 }
      );
    }
    
    await Todo.updateMany(
      { list_id: id },
      { $unset: { list_id: 1 } }
    );
    
    await TodoList.findByIdAndDelete(id);
    
    return NextResponse.json({ success: true, message: 'Todo list deleted' });
  } catch (error) {
    console.error('Error deleting todo list:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete todo list' },
      { status: 500 }
    );
  }
}
