/**
 * @registry-id: membersAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Members API route - GET and POST
 * @last-fix: [2026-01-15] Initial POC setup
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';

export async function GET() {
  try {
    await dbConnect();
    const members = await Member.find({ is_active: true })
      .populate('location_id', 'name')
      .populate('team_id', 'name')
      .sort({ created_at: -1 })
      .limit(100);
    
    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const member = await Member.create({
      name: body.name,
      email: body.email,
      slack_id: body.slack_id,
      slack_username: body.slack_username,
      location_id: body.location_id,
      team_id: body.team_id,
      roles: body.roles || [],
      is_active: body.is_active !== undefined ? body.is_active : true,
    });
    
    return NextResponse.json({ success: true, data: member }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating member:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create member' },
      { status: 400 }
    );
  }
}
