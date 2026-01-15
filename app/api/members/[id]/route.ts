/**
 * @registry-id: memberAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Single member API route - GET, PUT, DELETE
 * @last-fix: [2026-01-15] Initial POC setup
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import { getErrorMessage } from '@/lib/types/errors';
import type { IMember } from '@/models/Member';

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
    if (!mongoose.models.Team) {
      await import('@/models/Team');
    }
    
    const { id } = await params;
    const member = await Member.findById(id)
      .populate('location_id', 'name')
      .populate('team_id', 'name');
    
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    console.error('Error fetching member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch member' },
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
    
    const updateData: Partial<IMember> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.slack_id !== undefined) updateData.slack_id = body.slack_id;
    if (body.slack_username !== undefined) updateData.slack_username = body.slack_username;
    if (body.location_id !== undefined) updateData.location_id = body.location_id;
    if (body.team_id !== undefined) updateData.team_id = body.team_id;
    if (body.roles !== undefined) updateData.roles = body.roles;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    
    const member = await Member.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('location_id', 'name')
      .populate('team_id', 'name');
    
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: member });
  } catch (error: unknown) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
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
    const member = await Member.findByIdAndUpdate(id, { is_active: false }, { new: true });
    
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'Member deactivated' });
  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete member' },
      { status: 500 }
    );
  }
}
