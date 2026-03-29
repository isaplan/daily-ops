/**
 * @registry-id: locationConnectionsAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Get all connections for a location (aggregated from teams and members)
 * @last-fix: [2026-01-15] Updated to use M:M associations
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Team from '@/models/Team';
import Member from '@/models/Member';
import MemberTeamAssociation from '@/models/MemberTeamAssociation';
import MemberLocationAssociation from '@/models/MemberLocationAssociation';
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
    const locationId = id;
    
    // Get all teams in this location
    const locationTeams = await Team.find({ location_id: locationId, is_active: true });
    const teamIds = locationTeams.map(t => t._id);
    
    // Get all members associated with this location via associations
    const locationAssociations = await MemberLocationAssociation.find({
      location_id: locationId,
      is_active: true
    }).select('member_id');
    
    const locationMemberIds = locationAssociations.map(a => a.member_id);
    
    // Get all members in teams at this location
    const teamAssociations = await MemberTeamAssociation.find({
      team_id: { $in: teamIds },
      is_active: true
    }).select('member_id');
    
    const teamMemberIds = teamAssociations.map(a => a.member_id);
    
    // Combine member IDs (union) - convert to ObjectIds
    const allMemberIdStrings = [...new Set([
      ...locationMemberIds.map(id => id.toString()),
      ...teamMemberIds.map(id => id.toString())
    ])];
    
    const memberIds = allMemberIdStrings.map(id => new mongoose.Types.ObjectId(id));
    
    const [notes, todos, decisions, channels, teamCount, memberCount] = await Promise.all([
      Note.find({
        $or: [
          { 'connected_to.location_id': locationId },
          { author_id: { $in: memberIds } },
        ],
        is_archived: false,
      })
        .populate('author_id', 'name email')
        .limit(5)
        .sort({ created_at: -1 }),
      
      Todo.find({
        $or: [
          { 'connected_to.location_id': locationId },
          { 'connected_to.team_id': { $in: teamIds } },
          { assigned_to: { $in: memberIds } },
        ],
      })
        .populate('assigned_to', 'name email')
        .limit(5)
        .sort({ created_at: -1 }),
      
      Decision.find({
        $or: [
          { 'connected_to.location_id': locationId },
          { 'connected_to.team_id': { $in: teamIds } },
          { created_by: { $in: memberIds } },
        ],
      })
        .populate('created_by', 'name email')
        .limit(5)
        .sort({ created_at: -1 }),
      
      Channel.find({
        $or: [
          { 'connected_to.location_id': locationId },
          { 'connected_to.team_id': { $in: teamIds } },
          { members: { $in: memberIds } },
        ],
        is_archived: false,
      })
        .populate('members', 'name email')
        .limit(5)
        .sort({ created_at: -1 }),
      
      Promise.resolve(locationTeams.length),
      Promise.resolve(memberIds.length),
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        teams: teamCount,
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
    console.error('Error fetching location connections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}
