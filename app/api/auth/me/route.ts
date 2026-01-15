/**
 * @registry-id: authMeRoute
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T12:00:00.000Z
 * @description: GET /api/auth/me - Return current user with role and permissions
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/lib/hooks/useAuth.ts => Fetch current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import { Member } from '@/models/Member';
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

    // Determine role from member's roles array
    const role = determineRole(member.roles);

    // Return user with role and permissions
    return NextResponse.json({
      id: member._id,
      name: member.name,
      email: member.email,
      role,
      location_id: member.location_id?._id || member.location_id,
      team_id: member.team_id?._id || member.team_id,
      slack_avatar: member.slack_avatar,
      is_active: member.is_active,
    });
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
