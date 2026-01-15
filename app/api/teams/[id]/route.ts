/**
 * @registry-id: teamAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Single team API route - GET, PUT, DELETE
 * @last-fix: [2026-01-15] Initial POC setup
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Team from '@/models/Team';
import Location from '@/models/Location';
import Member from '@/models/Member';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    // Ensure all models are registered
    if (!mongoose.models.Location) {
      await import('@/models/Location');
    }
    if (!mongoose.models.Member) {
      await import('@/models/Member');
    }
    
    const { id } = await params;
    const team = await Team.findById(id)
      .populate('location_id', 'name')
      .populate('members', 'name email');
    
    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: team });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id } = await params;
    
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.location_id !== undefined) updateData.location_id = body.location_id;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    
    const team = await Team.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('location_id', 'name');
    
    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: team });
  } catch (error: any) {
    console.error('Error updating team:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update team' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const team = await Team.findByIdAndUpdate(id, { is_active: false }, { new: true });
    
    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'Team deactivated' });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete team' },
      { status: 500 }
    );
  }
}
