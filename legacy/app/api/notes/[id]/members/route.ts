/**
 * @registry-id: noteMembersAPI
 * @created: 2026-01-15T15:00:00.000Z
 * @last-modified: 2026-01-15T15:00:00.000Z
 * @description: Manage connected members for a note
 * @last-fix: [2026-01-15] Initial implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Note from '@/models/Note';
import { slugToFilter } from '@/lib/utils/slug';
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
    
    const body = await request.json();
    const { member_id, role = 'contributor' } = body;
    
    if (!member_id) {
      return NextResponse.json(
        { success: false, error: 'member_id is required' },
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
    
    // Check if member is already connected
    const existingIndex = note.connected_members.findIndex(
      (cm) => cm.member_id.toString() === member_id
    );
    
    if (existingIndex >= 0) {
      // Update role if different
      if (note.connected_members[existingIndex].role !== role) {
        note.connected_members[existingIndex].role = role;
        await note.save();
      }
    } else {
      // Add new member
      note.connected_members.push({
        member_id: new mongoose.Types.ObjectId(member_id),
        role,
        added_at: new Date(),
      });
      await note.save();
    }
    
    await note.populate('connected_members.member_id', 'name email');
    await note.populate('author_id', 'name email');
    await note.populate('connected_to.location_id', 'name');
    await note.populate('connected_to.team_id', 'name');
    await note.populate('connected_to.member_id', 'name email');
    
    return NextResponse.json({ success: true, data: note });
  } catch (error: unknown) {
    console.error('Error adding member to note:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
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
    
    if (!id || id === 'undefined' || id.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid note identifier' },
        { status: 400 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const member_id = searchParams.get('member_id');
    
    if (!member_id) {
      return NextResponse.json(
        { success: false, error: 'member_id is required' },
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
    
    // Remove member
    note.connected_members = note.connected_members.filter(
      (cm) => cm.member_id.toString() !== member_id
    );
    
    await note.save();
    
    await note.populate('connected_members.member_id', 'name email');
    await note.populate('author_id', 'name email');
    await note.populate('connected_to.location_id', 'name');
    await note.populate('connected_to.team_id', 'name');
    await note.populate('connected_to.member_id', 'name email');
    
    return NextResponse.json({ success: true, data: note });
  } catch (error: unknown) {
    console.error('Error removing member from note:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
