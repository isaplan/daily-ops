/**
 * @registry-id: membersAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Members API route - GET and POST
 * @last-fix: [2026-01-15] Updated to use M:M associations
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import MemberTeamAssociation from '@/models/MemberTeamAssociation';
import MemberLocationAssociation from '@/models/MemberLocationAssociation';
import { getErrorMessage } from '@/lib/types/errors';
import type { IMember } from '@/models/Member';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');
    const locationId = searchParams.get('location_id');
    const locationName = searchParams.get('location_name');

    let memberIds: mongoose.Types.ObjectId[] | null = null;
    let resolvedLocationId: string | null = locationId || null;

    if (locationName && !locationId) {
      const location = await Location.findOne({ name: locationName, is_active: true });
      if (location) {
        resolvedLocationId = location._id.toString();
      } else {
        return NextResponse.json({ success: true, data: [] });
      }
    }

    // If filtering by team_id, get member IDs from associations
    if (teamId) {
      const associations = await MemberTeamAssociation.find({
        team_id: teamId,
        is_active: true
      }).select('member_id');
      memberIds = associations.map(a => a.member_id);
    }

    // If filtering by location_id, get member IDs from associations
    if (resolvedLocationId) {
      const associations = await MemberLocationAssociation.find({
        location_id: resolvedLocationId,
        is_active: true
      }).select('member_id');
      const locationMemberIds = associations.map(a => a.member_id);
      
      // If we already have team member IDs, intersect them
      if (memberIds) {
        memberIds = memberIds.filter(id => locationMemberIds.some(lid => lid.equals(id)));
      } else {
        memberIds = locationMemberIds;
      }
    }

    // Build query
    const query: any = { is_active: true };
    if (memberIds && memberIds.length > 0) {
      query._id = { $in: memberIds };
    } else if (memberIds && memberIds.length === 0) {
      // No members match the filter
      return NextResponse.json({ success: true, data: [] });
    }

    const members = await Member.find(query)
      .populate('location_id', 'name')
      .populate('team_id', 'name')
      .sort({ created_at: -1 })
      .limit(100);

    // Populate associations for each member
    const membersWithAssociations = await Promise.all(
      members.map(async (member) => {
        const [teams, locations] = await Promise.all([
          MemberTeamAssociation.find({ member_id: member._id, is_active: true })
            .populate('team_id', 'name'),
          MemberLocationAssociation.find({ member_id: member._id, is_active: true })
            .populate('location_id', 'name')
        ]);

        return {
          ...member.toObject(),
          teams: teams.map(a => ({
            _id: a.team_id,
            name: typeof a.team_id === 'object' ? a.team_id.name : null
          })),
          locations: locations.map(a => ({
            _id: a.location_id,
            name: typeof a.location_id === 'object' ? a.location_id.name : null
          }))
        };
      })
    );
    
    return NextResponse.json({ success: true, data: membersWithAssociations });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

interface CreateMemberBody {
  name: string;
  email: string;
  slack_id?: string;
  slack_username?: string;
  location_id?: string;
  team_id?: string;
  roles?: IMember['roles'];
  is_active?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = (await request.json()) as CreateMemberBody;
    
    // Create member (without team_id/location_id for now, using associations instead)
    const member = await Member.create({
      name: body.name,
      email: body.email,
      slack_id: body.slack_id,
      slack_username: body.slack_username,
      // Keep deprecated fields for backward compatibility
      location_id: body.location_id,
      team_id: body.team_id,
      roles: body.roles || [],
      is_active: body.is_active !== undefined ? body.is_active : true,
    });

    // Create team association if team_id provided
    if (body.team_id) {
      await MemberTeamAssociation.create({
        member_id: member._id,
        team_id: body.team_id,
        is_active: true,
        assigned_at: new Date()
      });
    }

    // Create location association if location_id provided
    if (body.location_id) {
      await MemberLocationAssociation.create({
        member_id: member._id,
        location_id: body.location_id,
        is_active: true,
        assigned_at: new Date()
      });
    }

    // Populate associations for response
    const [teams, locations] = await Promise.all([
      MemberTeamAssociation.find({ member_id: member._id, is_active: true })
        .populate('team_id', 'name'),
      MemberLocationAssociation.find({ member_id: member._id, is_active: true })
        .populate('location_id', 'name')
    ]);

    const memberWithAssociations = {
      ...member.toObject(),
      teams: teams.map(a => ({
        _id: a.team_id,
        name: typeof a.team_id === 'object' ? a.team_id.name : null
      })),
      locations: locations.map(a => ({
        _id: a.location_id,
        name: typeof a.location_id === 'object' ? a.location_id.name : null
      }))
    };
    
    return NextResponse.json({ success: true, data: memberWithAssociations }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
