/**
 * @registry-id: teamConnectionsAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Get all connections for a team (aggregated from members)
 * @last-fix: [2026-01-15] Updated to use M:M associations
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Member from '@/models/Member';
import MemberTeamAssociation from '@/models/MemberTeamAssociation';
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
    const teamId = id;
    
    // Get all members in this team via associations
    const teamAssociations = await MemberTeamAssociation.find({
      team_id: teamId,
      is_active: true
    }).select('member_id');
    
    const memberIds = teamAssociations.map(a => a.member_id);
    
    // Get member details
    const teamMembers = await Member.find({
      _id: { $in: memberIds },
      is_active: true
    });
    
    const [notes, todos, decisions, channels, memberCount] = await Promise.all([
      Note.find({
        $or: [
          { 'connected_to.team_id': teamId },
          { author_id: { $in: memberIds } },
        ],
        is_archived: false,
      })
        .populate('author_id', 'name email')
        .limit(5)
        .sort({ created_at: -1 }),
      
      Todo.find({
        $or: [
          { 'connected_to.team_id': teamId },
          { assigned_to: { $in: memberIds } },
          { created_by: { $in: memberIds } },
        ],
      })
        .populate('assigned_to', 'name email')
        .limit(5)
        .sort({ created_at: -1 }),
      
      Decision.find({
        $or: [
          { 'connected_to.team_id': teamId },
          { created_by: { $in: memberIds } },
          { involved_members: { $in: memberIds } },
        ],
      })
        .populate('created_by', 'name email')
        .limit(5)
        .sort({ created_at: -1 }),
      
      Channel.find({
        $or: [
          { 'connected_to.team_id': teamId },
          { members: { $in: memberIds } },
        ],
        is_archived: false,
      })
        .populate('members', 'name email')
        .limit(5)
        .sort({ created_at: -1 }),
      
      Promise.resolve(teamMembers.length),
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        members: memberCount,
        notes: notes.length,
        todos: todos.length,
        decisions: decisions.length,
        channels: channels.length,
        details: {
          notes: notes,
          todos: todos,
          decisions: decisions,
          channels: channels,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching team connections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}
