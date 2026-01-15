/**
 * @registry-id: authMeRoute
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: GET /api/auth/me - Return current user with role and permissions
 * @last-fix: [2026-01-15] Updated to include M:M associations
 * 
 * @exports-to:
 * ✓ app/lib/hooks/useAuth.ts => Fetch current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import { Member } from '@/models/Member';
import MemberTeamAssociation from '@/models/MemberTeamAssociation';
import MemberLocationAssociation from '@/models/MemberLocationAssociation';
import { determineRole } from '@/lib/api-middleware';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await dbConnect();

    const member = await Member.findOne({ email: session.user.email })
      .populate('location_id team_id')
      .lean();

    if (!member) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get associations
    const [teams, locations] = await Promise.all([
      MemberTeamAssociation.find({ member_id: member._id, is_active: true })
        .populate('team_id', 'name')
        .lean(),
      MemberLocationAssociation.find({ member_id: member._id, is_active: true })
        .populate('location_id', 'name')
        .lean()
    ]);

    // Determine role from member's roles array
    const role = determineRole(member.roles);

    // Get primary team/location (first active association, or fallback to deprecated fields)
    const primaryTeam = teams.length > 0 
      ? (typeof teams[0].team_id === 'object' ? teams[0].team_id._id : teams[0].team_id)
      : (member.team_id?._id || member.team_id);
    
    const primaryLocation = locations.length > 0
      ? (typeof locations[0].location_id === 'object' ? locations[0].location_id._id : locations[0].location_id)
      : (member.location_id?._id || member.location_id);

    // Return user with role and permissions
    return NextResponse.json({
      id: member._id,
      name: member.name,
      email: member.email,
      role,
      location_id: primaryLocation,
      team_id: primaryTeam,
      teams: teams.map(t => ({
        _id: typeof t.team_id === 'object' ? t.team_id._id : t.team_id,
        name: typeof t.team_id === 'object' ? t.team_id.name : null
      })),
      locations: locations.map(l => ({
        _id: typeof l.location_id === 'object' ? l.location_id._id : l.location_id,
        name: typeof l.location_id === 'object' ? l.location_id.name : null
      })),
      slack_avatar: member.slack_avatar,
      is_active: member.is_active,
    });
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
