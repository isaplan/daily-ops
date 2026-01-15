/**
 * @registry-id: teamsAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Teams API route - GET and POST
 * @last-fix: [2026-01-15] Initial POC setup
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Team from '@/models/Team';
import Location from '@/models/Location';

export async function GET() {
  try {
    await dbConnect();
    const teams = await Team.find({ is_active: true })
      .populate('location_id', 'name')
      .sort({ name: 1 });
    
    return NextResponse.json({ success: true, data: teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const team = await Team.create({
      name: body.name,
      location_id: body.location_id,
      description: body.description,
      is_active: body.is_active !== undefined ? body.is_active : true,
    });
    
    return NextResponse.json({ success: true, data: team }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating team:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create team' },
      { status: 400 }
    );
  }
}
