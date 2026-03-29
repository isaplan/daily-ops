/**
 * @registry-id: channelsAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Channels API route - GET and POST with pagination
 * @last-fix: [2026-01-16] Added pagination (skip/limit) and fixed error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Channel from '@/models/Channel';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import { getErrorMessage } from '@/lib/types/errors';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    
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
    
    const channels = await Channel.find({ is_archived: false })
      .populate('members', 'name email')
      .populate('created_by', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Channel.countDocuments({ is_archived: false });
    
    return NextResponse.json({
      success: true,
      data: channels,
      pagination: { skip, limit, total },
    });
  } catch (error: unknown) {
    console.error('Error fetching channels:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const channel = await Channel.create({
      name: body.name,
      description: body.description,
      type: body.type,
      connected_to: {
        location_id: body.location_id,
        team_id: body.team_id,
        member_id: body.member_id,
      },
      members: body.members || [],
      created_by: body.created_by,
    });
    
    await channel.populate('members', 'name email');
    await channel.populate('created_by', 'name email');
    
    return NextResponse.json({ success: true, data: channel }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating channel:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
