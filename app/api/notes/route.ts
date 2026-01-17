/**
 * @registry-id: notesAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T14:30:00.000Z
 * @description: Notes API route - GET and POST with slug generation
 * @last-fix: [2026-01-15] Added slug generation and status field for individual pages
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Note from '@/models/Note';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import MemberTeamAssociation from '@/models/MemberTeamAssociation';
import MemberLocationAssociation from '@/models/MemberLocationAssociation';
import { generateSlug } from '@/lib/utils/slug';
import { getErrorMessage } from '@/lib/types/errors';

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
    const viewing_member_id = searchParams.get('viewing_member_id'); // For team/location visibility
    const archived = searchParams.get('archived');
    
    interface NoteQuery {
      is_archived: boolean;
      $or?: Array<{
        'connected_to.location_id'?: string | mongoose.Types.ObjectId;
        'connected_to.team_id'?: string | mongoose.Types.ObjectId;
        'connected_to.member_id'?: string | mongoose.Types.ObjectId;
        'connected_to.location_id'?: { $exists: false };
        'connected_to.team_id'?: { $exists: false };
        'connected_to.member_id'?: { $exists: false };
      }>;
      'connected_to.location_id'?: string;
      'connected_to.team_id'?: string;
      'connected_to.member_id'?: string;
    }
    
    const query: NoteQuery = { is_archived: archived === 'true' };
    
    // If viewing_member_id is provided, show notes for that member's team and location
    if (viewing_member_id && !location_id && !team_id && !member_id) {
      const viewingMember = await Member.findById(viewing_member_id).lean();
      
      if (viewingMember) {
        // Get member's teams and locations from associations
        const [teamAssociations, locationAssociations] = await Promise.all([
          MemberTeamAssociation.find({ 
            member_id: viewing_member_id, 
            is_active: true 
          }).select('team_id').lean(),
          MemberLocationAssociation.find({ 
            member_id: viewing_member_id, 
            is_active: true 
          }).select('location_id').lean()
        ]);

        const teamIds = teamAssociations.map(a => 
          typeof a.team_id === 'object' ? a.team_id._id : a.team_id
        );
        const locationIds = locationAssociations.map(a => 
          typeof a.location_id === 'object' ? a.location_id._id : a.location_id
        );

        // Fallback to deprecated fields if no associations found
        if (teamIds.length === 0 && viewingMember.team_id) {
          teamIds.push(
            typeof viewingMember.team_id === 'object' 
              ? viewingMember.team_id._id 
              : viewingMember.team_id
          );
        }
        if (locationIds.length === 0 && viewingMember.location_id) {
          locationIds.push(
            typeof viewingMember.location_id === 'object' 
              ? viewingMember.location_id._id 
              : viewingMember.location_id
          );
        }

        const orConditions: Array<Record<string, unknown>> = [
          { 'connected_to.member_id': new mongoose.Types.ObjectId(viewing_member_id) },
        ];
        
        // Add notes connected to member's teams
        if (teamIds.length > 0) {
          orConditions.push({
            'connected_to.team_id': { $in: teamIds.map(id => new mongoose.Types.ObjectId(id)) },
          });
        }
        
        // Add notes connected to member's locations
        if (locationIds.length > 0) {
          orConditions.push({
            'connected_to.location_id': { $in: locationIds.map(id => new mongoose.Types.ObjectId(id)) },
          });
        }
        
        // Also show notes with no connections (global notes)
        orConditions.push({
          $and: [
            { 'connected_to.location_id': { $exists: false } },
            { 'connected_to.team_id': { $exists: false } },
            { 'connected_to.member_id': { $exists: false } },
          ],
        });
        
        query.$or = orConditions;
      }
    } else {
      // Direct filtering by location, team, or member
      if (location_id) {
        query['connected_to.location_id'] = location_id;
      }
      if (team_id) {
        query['connected_to.team_id'] = team_id;
      }
      if (member_id) {
        query['connected_to.member_id'] = member_id;
      }
    }
    
    let notesQuery = Note.find(query)
      .populate('author_id', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email');
    
    // Only populate connected_members if the field exists (for backward compatibility)
    try {
      notesQuery = notesQuery.populate({
        path: 'connected_members.member_id',
        select: 'name email',
        model: 'Member',
        strictPopulate: false,
      });
    } catch (populateError) {
      console.warn('Could not populate connected_members (may not exist on all notes):', populateError);
    }
    
    const notes = await notesQuery
      .sort({ is_pinned: -1, created_at: -1 })
      .limit(100);
    
    return NextResponse.json({ success: true, data: notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });
    return NextResponse.json(
      { success: false, error: `Failed to fetch notes: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const slug = generateSlug(body.title);
    const note = await Note.create({
      title: body.title,
      content: body.content,
      slug,
      author_id: body.author_id,
      connected_to: {
        location_id: body.location_id,
        team_id: body.team_id,
        member_id: body.member_id,
      },
      tags: body.tags || [],
      is_pinned: body.is_pinned || false,
      status: 'draft',
    });
    
    await note.populate('author_id', 'name email');
    await note.populate('connected_to.location_id', 'name');
    await note.populate('connected_to.team_id', 'name');
    await note.populate('connected_to.member_id', 'name email');
    await note.populate({
      path: 'connected_members.member_id',
      select: 'name email',
      model: 'Member',
    });
    
    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
