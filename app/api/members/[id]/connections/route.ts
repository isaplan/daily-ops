/**
 * @registry-id: memberConnectionsAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Get all connections for a member
 * @last-fix: [2026-01-15] Initial POC setup
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Note from '@/models/Note';
import Todo from '@/models/Todo';
import Decision from '@/models/Decision';
import Channel from '@/models/Channel';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const memberId = id;
    
    const [notes, todos, decisions, channels] = await Promise.all([
      Note.find({
        $or: [
          { 'connected_to.member_id': memberId },
          { author_id: memberId },
        ],
        is_archived: false,
      })
        .populate('author_id', 'name email')
        .populate('connected_to.location_id', 'name')
        .populate('connected_to.team_id', 'name')
        .limit(10)
        .sort({ created_at: -1 }),
      
      Todo.find({
        $or: [
          { 'connected_to.member_id': memberId },
          { assigned_to: memberId },
          { created_by: memberId },
        ],
      })
        .populate('assigned_to', 'name email')
        .populate('created_by', 'name email')
        .populate('connected_to.location_id', 'name')
        .populate('connected_to.team_id', 'name')
        .limit(10)
        .sort({ created_at: -1 }),
      
      Decision.find({
        $or: [
          { 'connected_to.member_id': memberId },
          { created_by: memberId },
          { involved_members: memberId },
        ],
      })
        .populate('created_by', 'name email')
        .populate('approved_by', 'name email')
        .populate('involved_members', 'name email')
        .populate('connected_to.location_id', 'name')
        .populate('connected_to.team_id', 'name')
        .limit(10)
        .sort({ created_at: -1 }),
      
      Channel.find({
        $or: [
          { 'connected_to.member_id': memberId },
          { members: memberId },
        ],
        is_archived: false,
      })
        .populate('members', 'name email')
        .populate('created_by', 'name email')
        .populate('connected_to.location_id', 'name')
        .populate('connected_to.team_id', 'name')
        .limit(10)
        .sort({ created_at: -1 }),
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        notes: notes.length,
        todos: todos.length,
        decisions: decisions.length,
        channels: channels.length,
        details: {
          notes: notes.slice(0, 5),
          todos: todos.slice(0, 5),
          decisions: decisions.slice(0, 5),
          channels: channels.slice(0, 5),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching member connections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}
