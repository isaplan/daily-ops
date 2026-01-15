/**
 * @registry-id: locationsAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Locations API route - GET and POST
 * @last-fix: [2026-01-15] Initial POC setup
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Location from '@/models/Location';
import { getErrorMessage } from '@/lib/types/errors';

export async function GET() {
  try {
    await dbConnect();
    const locations = await Location.find({ is_active: true })
      .sort({ name: 1 });
    
    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const location = await Location.create({
      name: body.name,
      address: body.address,
      city: body.city,
      country: body.country,
      is_active: body.is_active !== undefined ? body.is_active : true,
    });
    
    return NextResponse.json({ success: true, data: location }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating location:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
