/**
 * @registry-id: notesAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Notes API route - GET and POST
 * @last-fix: [2026-01-15] Initial POC setup
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Note from '@/models/Note';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Ensure all models are registered
    if (!mongoose.models.Member) {
      await import('@/models/Member');
    }
    if (!mongoose.models.Location) {
      await import('@/models/Location');
    }
    if (!mongoose.models.Team) {
      await import('@/models/Team');
    }
    const { searchParams } = new URL(request.url);
    
    const location_id = searchParams.get('location_id');
    const team_id = searchParams.get('team_id');
    const member_id = searchParams.get('member_id');
    const archived = searchParams.get('archived');
    
    const query: any = { is_archived: archived === 'true' };
    
    if (location_id) {
      query['connected_to.location_id'] = location_id;
    }
    if (team_id) {
      query['connected_to.team_id'] = team_id;
    }
    if (member_id) {
      query['connected_to.member_id'] = member_id;
    }
    
    const notes = await Note.find(query)
      .populate('author_id', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email')
      .sort({ is_pinned: -1, created_at: -1 })
      .limit(100);
    
    return NextResponse.json({ success: true, data: notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const note = await Note.create({
      title: body.title,
      content: body.content,
      author_id: body.author_id,
      connected_to: {
        location_id: body.location_id,
        team_id: body.team_id,
        member_id: body.member_id,
      },
      tags: body.tags || [],
      is_pinned: body.is_pinned || false,
    });
    
    await note.populate('author_id', 'name email');
    await note.populate('connected_to.location_id', 'name');
    await note.populate('connected_to.team_id', 'name');
    await note.populate('connected_to.member_id', 'name email');
    
    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create note' },
      { status: 400 }
    );
  }
}
