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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const filter = slugToFilter(id);
    
    const note = await Note.findOne(filter)
      .populate('author_id', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email');
    
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
    
    const updateData: any = {
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
    if (body.publish === true) {
      updateData.status = 'published';
      updateData.published_at = new Date();
    } else if (body.publish === false) {
      updateData.status = 'draft';
      updateData.published_at = undefined;
    }
    
    const note = await Note.findOneAndUpdate(filter, updateData, { new: true, runValidators: true })
      .populate('author_id', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email');
    
    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: note });
  } catch (error: any) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update note' },
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
