/**
 * @registry-id: teamsAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-16T16:25:00.000Z
 * @description: Teams API route - GET and POST
 * @last-fix: [2026-01-16] Added location_name filtering support for workspace-based filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Team from '@/models/Team';
import Location from '@/models/Location';
import { getErrorMessage } from '@/lib/types/errors';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('location_id');
    const locationName = searchParams.get('location_name');
    const isActive = searchParams.get('is_active');

    let filterLocationId: string | null = locationId || null;

    if (locationName && !locationId) {
      const location = await Location.findOne({ name: locationName, is_active: true });
      if (location) {
        filterLocationId = location._id.toString();
      } else {
        return NextResponse.json({ success: true, data: [] });
      }
    }

    const query: Record<string, unknown> = { is_active: isActive !== 'false' };
    if (filterLocationId) {
      query.location_id = filterLocationId;
    }

    const teams = await Team.find(query)
      .populate('location_id', 'name')
      .sort({ name: 1 });
    
    return NextResponse.json({ success: true, data: teams });
  } catch (error) {
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
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
