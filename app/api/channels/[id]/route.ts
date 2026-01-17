/**
 * @registry-id: channelAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Single channel API route - GET, PUT, DELETE
 * @last-fix: [2026-01-16] Fixed error handling to use unknown and getErrorMessage
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Channel from '@/models/Channel';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import { getErrorMessage } from '@/lib/types/errors';
import type { IChannel } from '@/models/Channel';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params;
    const channel = await Channel.findById(id)
      .populate('members', 'name email')
      .populate('created_by', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email');
    
    if (!channel) {
      return NextResponse.json(
        { success: false, error: 'Channel not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: channel });
  } catch (error: unknown) {
    console.error('Error fetching channel:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
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
    
    const updateData: Partial<IChannel> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.members !== undefined) updateData.members = body.members;
    if (body.connected_to !== undefined) updateData.connected_to = body.connected_to;
    
    const channel = await Channel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('members', 'name email')
      .populate('created_by', 'name email');
    
    if (!channel) {
      return NextResponse.json(
        { success: false, error: 'Channel not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: channel });
  } catch (error: unknown) {
    console.error('Error updating channel:', error);
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
    const channel = await Channel.findByIdAndUpdate(id, { is_archived: true }, { new: true });
    
    if (!channel) {
      return NextResponse.json(
        { success: false, error: 'Channel not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'Channel archived' });
  } catch (error: unknown) {
    console.error('Error deleting channel:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
